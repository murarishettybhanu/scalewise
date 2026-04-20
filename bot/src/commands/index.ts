import { Context } from "grammy";
import { User, Profile, DailyLog, WeightLog, ActivityLog } from "../models";
import type { BotContext } from "../types";
import { getRemainingPlan } from "../services/dietEngine";
import { generateRecipeFromPantry } from "../services/gemini";
import { parseActivityText, calculateActivityBurn } from "../services/activityService";
import { calculateStepTax, getUrgeSurfingGuide, checkSodiumSpike } from "../services/behavioralService";

// ─── /start command ──────────────────────────────────────

export async function startCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const firstName = ctx.from!.first_name;

  await User.findOneAndUpdate(
    { telegramId },
    {
      telegramId,
      firstName,
      lastName: ctx.from!.last_name,
      username: ctx.from!.username,
    },
    { upsert: true, new: true }
  );

  const profile = await Profile.findOne({ telegramId });

  if (profile) {
    await ctx.reply(
      `👋 Welcome back, *${firstName}*!\n\n` +
        `🎯 Daily Target: ${profile.targetCalories} kcal | ${profile.targetProtein}g protein\n\n` +
        `Use /help to see commands or /profile to view your full profile.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  await ctx.conversation.enter("onboarding");
}

// ─── /profile command ────────────────────────────────────

export async function profileCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const profile = await Profile.findOne({ telegramId });

  if (!profile) {
    await ctx.reply("You haven't set up your profile yet! Use /start to begin.");
    return;
  }

  const goalLabel = profile.goal === "deficit" ? "🔥 Fat Loss" : "💪 Weight Gain";
  const dietLabel = profile.dietType.charAt(0).toUpperCase() + profile.dietType.slice(1);
  const activityLabels: Record<string, string> = {
    sedentary: "Sedentary",
    light: "Lightly Active",
    moderate: "Moderately Active",
    active: "Very Active",
    very_active: "Extremely Active",
  };

  await ctx.reply(
    `📋 *Your ScaleWise Profile*\n\n` +
      `${goalLabel}\n` +
      `👤 ${profile.gender === "male" ? "Male" : "Female"}, ${profile.age}y\n` +
      `📏 ${profile.height} cm | ⚖️ ${profile.weight} kg\n` +
      `🏃 ${activityLabels[profile.activityLevel]}\n` +
      `🍽️ ${dietLabel}${profile.region ? ` (${profile.region})` : ""}\n\n` +
      `📦 *Cheat Day:* ${profile.cheatDay ? profile.cheatDay.charAt(0).toUpperCase() + profile.cheatDay.slice(1) : "Not set"}\n` +
      `💰 *Banked Calories:* ${profile.bankedCalories} kcal\n\n` +
      `─── *Nutrition Targets* ───\n` +
      `📊 BMR: ${profile.bmr} kcal\n` +
      `⚡ TDEE: ${profile.tdee} kcal\n` +
      `🎯 Daily Calories: ${profile.targetCalories} kcal\n` +
      `🥩 Daily Protein: ${profile.targetProtein}g\n\n` +
      `_Use /start to re-do onboarding_`,
    { parse_mode: "Markdown" }
  );
}

// ─── /update command ────────────────────────────────────

export async function updateCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const profile = await Profile.findOne({ telegramId });

  if (!profile) {
    await ctx.reply("You haven't set up your profile yet! Use /start to begin.");
    return;
  }

  await ctx.conversation.enter("updateProfile");
}

// ─── /delete command ────────────────────────────────────

export async function deleteCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "⚠️ *Warning: Danger Zone*\n\n" +
      "This will permanently delete your profile and all logged data. You will have to start over if you return.\n\n" +
      "Are you absolutely sure you want to proceed?",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Yes, delete everything", callback_data: "confirm_delete_all" },
            { text: "❌ No, cancel", callback_data: "cancel_delete" },
          ],
        ],
      },
    }
  );
}

// ─── /weight command ────────────────────────────────────

export async function weightCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const match = ctx.message?.text?.match(/\/weight\s+(\d+(\.\d+)?)/);
  
  if (!match) {
    await ctx.reply("Please provide your weight, e.g. `/weight 72.5`", { parse_mode: "Markdown" });
    return;
  }

  const weight = parseFloat(match[1]);
  const today = new Date().toISOString().split("T")[0];

  const spikeAlert = await checkSodiumSpike(telegramId, weight);

  await WeightLog.findOneAndUpdate(
    { telegramId, date: today },
    { weight },
    { upsert: true }
  );

  await Profile.findOneAndUpdate({ telegramId }, { weight });

  let response = `⚖️ *Weight Logged:* ${weight} kg\nYour profile has been updated!`;
  if (spikeAlert) {
    response += `\n\n${spikeAlert}`;
  }

  await ctx.reply(response, { parse_mode: "Markdown" });
}

// ─── /activity command (PHASE 3) ─────────────────────────

export async function activityCommand(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text?.replace("/activity", "").trim();
  if (!text) {
    await ctx.conversation.enter("logActivity");
    return;
  }

  const telegramId = ctx.from!.id;
  const profile = await Profile.findOne({ telegramId });
  if (!profile) return;

  const waitMsg = await ctx.reply("🏃 *Parsing your activity...*", { parse_mode: "Markdown" });

  const parsed = await parseActivityText(text);
  if (!parsed || parsed.duration <= 0) {
    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Sorry, I couldn't understand that activity. Try being more specific about what you did and for how long.");
    return;
  }

  const { calories, met } = calculateActivityBurn(profile.weight, parsed.activity, parsed.duration, parsed.intensity);

  const today = new Date().toISOString().split("T")[0];
  await ActivityLog.create({
    telegramId,
    date: today,
    activityName: parsed.activity,
    durationMinutes: parsed.duration,
    caloriesBurned: calories,
    metValue: met
  });

  const response = `
🏃 *Activity Logged!*
✅ Activity: ${parsed.activity}
⏱️ Duration: ${parsed.duration} mins
🔥 Burned: ${calories} kcal

_Your daily calorie budget has increased by ${calories} kcal!_
  `;

  await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, response, { parse_mode: "Markdown" });
}

// ─── /tax command (PHASE 3) ──────────────────────────────

export async function taxCommand(ctx: BotContext): Promise<void> {
  const food = ctx.message?.text?.replace("/tax", "").trim();
  if (!food) {
    await ctx.reply("What food do you want to calculate the 'tax' for? e.g. `/tax 1 samosa`", { parse_mode: "Markdown" });
    return;
  }

  const profile = await Profile.findOne({ telegramId: ctx.from!.id });
  const { calories, steps, durationMin } = await calculateStepTax(food, profile?.weight || 70);

  const response = `
🧾 *The Tax Negotiator*

🍴 Food: ${food}
🔥 Est. Calories: ${calories} kcal

🏃 *Walking Tax:*
👣 Approx. ${steps.toLocaleString()} brisk steps
⏱️ ~${durationMin} mins of brisk walking

_Is it worth it? Use /crave if the urge is too strong!_
  `;

  await ctx.reply(response, { parse_mode: "Markdown" });
}

// ─── /crave command (PHASE 3) ───────────────────────────

export async function craveCommand(ctx: BotContext): Promise<void> {
  const craving = ctx.message?.text?.replace("/crave", "").trim() || "something tasty";
  const guide = await getUrgeSurfingGuide(craving);
  
  await ctx.reply(`🌊 *Urge Surfing Intervention*\n\n${guide}`, { parse_mode: "Markdown" });
}

// ─── /cheat command (PHASE 3) ───────────────────────────

export async function cheatCommand(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text?.replace("/cheat", "").trim().toLowerCase();
  const telegramId = ctx.from!.id;
  
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  if (!text) {
    const profile = await Profile.findOne({ telegramId });
    if (!profile) return;

    await ctx.reply(
      `🎁 *Cheat Day Manager*\n\n` +
      `📅 Scheduled: ${profile.cheatDay ? profile.cheatDay.charAt(0).toUpperCase() + profile.cheatDay.slice(1) : "Not set"}\n` +
      `🏦 Banked: ${profile.bankedCalories} kcal\n\n` +
      `To set a day: \`/cheat set saturday\`\n` +
      `To toggle banking: \`/cheat banking on/off\``,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (text.startsWith("set ")) {
    const day = text.replace("set ", "").trim();
    if (!days.includes(day)) {
      await ctx.reply("Please specify a valid day (e.g., `/cheat set saturday`)", { parse_mode: "Markdown" });
      return;
    }

    await Profile.findOneAndUpdate({ telegramId }, { cheatDay: day, calorieBankingActive: true });
    await ctx.reply(`✅ Cheat day set to *${day.charAt(0).toUpperCase() + day.slice(1)}* and calorie banking activated!`, { parse_mode: "Markdown" });
  } else if (text === "banking on" || text === "banking off") {
    const active = text === "banking on";
    await Profile.findOneAndUpdate({ telegramId }, { calorieBankingActive: active });
    await ctx.reply(`🏦 Calorie banking is now *${active ? "ON" : "OFF"}*.`, { parse_mode: "Markdown" });
  }
}

// ─── /log command ───────────────────────────────────────

export async function logCommand(ctx: BotContext): Promise<void> {
  await ctx.reply("To log a meal, you can:\n\n1️⃣ Send a *photo* of your food 📸\n2️⃣ Use `/log <description>` (incoming Phase 3 update!) 📝", { parse_mode: "Markdown" });
}

// ─── /diet command ──────────────────────────────────────

export async function dietCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const plan = await getRemainingPlan(telegramId);
  await ctx.reply(plan, { parse_mode: "Markdown" });
}

// ─── /pantry command ───────────────────────────────────

export async function pantryCommand(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text?.replace("/pantry", "").trim();
  if (!text) {
    await ctx.reply("Tell me what ingredients you have, e.g. `/pantry eggs, spinach, bread`", { parse_mode: "Markdown" });
    return;
  }

  const waitMsg = await ctx.reply("🍳 *Generating a recipe for you...*", { parse_mode: "Markdown" });
  
  const profile = await Profile.findOne({ telegramId: ctx.from!.id });
  const targetKcal = profile ? Math.round(profile.targetCalories / 4) : 500;
  
  const recipe = await generateRecipeFromPantry(text, targetKcal);
  await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, recipe, { parse_mode: "Markdown" });
}

// ─── /help command ───────────────────────────────────────

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `🤖 *ScaleWise AI — Commands*\n\n` +
      `/profile — View your targets & banking\n` +
      `/diet — See today's remaining budget\n` +
      `/activity — Log movement (e.g. 30min walk)\n` +
      `/weight — Log daily weight & check spikes\n` +
      `/tax <food> — Calculate Step Tax for a treat\n` +
      `/crave — Handle an urge mindfulness style\n` +
      `/cheat — Schedule cheat day & bank calories\n` +
      `/pantry — Recipe ideas from ingredients\n` +
      `/help — Show this message\n\n` +
      `📸 *Pro-tip:* Just send a photo of your food to auto-log macros!`,
    { parse_mode: "Markdown" }
  );
}
