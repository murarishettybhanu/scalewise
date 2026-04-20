import { Context } from "grammy";
import { User, Profile, DailyLog, WeightLog } from "../models";
import type { BotContext } from "../types";
import { getRemainingPlan } from "../services/dietEngine";
import { generateRecipeFromPantry } from "../services/gemini";

// ─── /start command ──────────────────────────────────────

export async function startCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const firstName = ctx.from!.first_name;

  // Upsert user record
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

  // Check if already onboarded
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

  // Start onboarding
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

  await WeightLog.findOneAndUpdate(
    { telegramId, date: today },
    { weight },
    { upsert: true }
  );

  // Update current profile weight as well
  await Profile.findOneAndUpdate({ telegramId }, { weight });

  await ctx.reply(`⚖️ *Weight Logged:* ${weight} kg\nYour profile has been updated!`, { parse_mode: "Markdown" });
}

// ─── /log command ───────────────────────────────────────

export async function logCommand(ctx: BotContext): Promise<void> {
  await ctx.reply("To log a meal, you can:\n\n1️⃣ Send a *photo* of your food 📸\n2️⃣ Use `/log <description>` (e.g. `/log 2 eggs and toast`) 📝\n\n_Manual text logging coming soon in Phase 3 with full database parsing!_", { parse_mode: "Markdown" });
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
      `/start — Start onboarding or welcome back\n` +
      `/profile — View your profile & targets\n` +
      `/diet — See today's remaining budget\n` +
      `/weight <kg> — Log your daily weight\n` +
      `/log — Tips for logging meals\n` +
      `/update — Update specific profile attributes\n` +
      `/delete — Delete all your data\n` +
      `/help — Show this help message\n\n` +
      `📸 *Pro-tip:* Just send a photo of your food to auto-log macros!`,
    { parse_mode: "Markdown" }
  );
}
