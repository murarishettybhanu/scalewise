import { Context } from "grammy";
import { User, Profile, DailyLog, WeightLog, ActivityLog } from "../models";
import type { BotContext } from "../types";
import { getRemainingPlan } from "../services/dietEngine";
import { generateRecipeFromPantry, parseFoodText, calculateGoalCaloriesAI, generateRandomRecipeAI } from "../services/gemini";
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

  const profile = await Profile.findOneAndUpdate({ telegramId }, { weight }, { new: true });
  
  let responseText = `⚖️ *Weight Logged:* ${weight} kg\nYour profile has been updated!`;
  
  if (profile?.goalStartDate && profile?.estimatedGoalDays) {
    const goalStart = new Date(profile.goalStartDate);
    const todayDate = new Date();
    const diffTime = todayDate.getTime() - goalStart.getTime();
    const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let daysRemaining = profile.estimatedGoalDays - daysPassed;
    if (daysRemaining < 0) daysRemaining = 0;
    
    responseText += `\n\n⏳ *Days Remaining:* ${daysRemaining} days`;
  }

  if (spikeAlert) {
    responseText += `\n\n⚠️ *Sodium Spike Detected!* ${spikeAlert}`;
  }

  await ctx.reply(responseText, { parse_mode: "Markdown" });

  // ─── AI Strategy Re-check ──────────────────────────────
  if (profile) {
    const aiRec = await calculateGoalCaloriesAI(
      weight,
      profile.goalWeight,
      profile.age,
      profile.height,
      profile.gender,
      profile.activityLevel,
      profile.goal
    );

    if (aiRec) {
      await ctx.reply(
        `🤖 <b>AI Strategy Check</b>\n\n` +
        `Based on your new weight, Gemini suggests:\n\n` +
        `🎯 <b>Target:</b> ${aiRec.targetCalories} kcal\n` +
        `🥩 <b>Protein:</b> ${aiRec.targetProtein}g\n` +
        `⏳ <b>Estimated Time:</b> ${aiRec.estimatedDays} days\n` +
        `🧠 <b>Reasoning:</b> ${aiRec.reasoning}\n\n` +
        `<i>Update your daily budget & strategy?</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ 
                text: `✅ Accept Strategy`, 
                callback_data: `accept_ai_strategy_${aiRec.targetCalories}_${aiRec.targetProtein}_${aiRec.estimatedDays}` 
              }],
              [{ text: "🔄 Generate Another Plan", callback_data: "regenerate_strategy" }],
              [{ text: "❌ Stick to Current", callback_data: "ignore_ai_target" }]
            ]
          }
        }
      );
    }
  }
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
  if (!parsed || !parsed.activity || parsed.duration <= 0) {
    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Sorry, I couldn't understand that activity. Try being more specific about what you did and for how long (e.g. '30 mins walk').");
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
    await ctx.conversation.enter("logTax");
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
  await ctx.conversation.enter("manageCheat");
}

// ─── /log command ───────────────────────────────────────

export async function logCommand(ctx: BotContext): Promise<void> {
  // Use regex to strip the command including optional @botname
  const text = ctx.message?.text?.replace(/^\/log(@\w+)?\s*/, "").trim();
  
  // If user provided text directly, process it instantly
  if (text) {
    const telegramId = ctx.from!.id;
    const waitMsg = await ctx.reply("🥗 *Analyzing your meal...*", { parse_mode: "Markdown" });
    const analysis = await parseFoodText(text);
    
    if (!analysis) {
      await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Sorry, I couldn't understand that meal description.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    await DailyLog.findOneAndUpdate(
      { telegramId, date: today },
      {
        $push: {
          meals: {
            name: "Manual",
            description: analysis.dishName,
            calories: analysis.calories,
            protein: analysis.protein,
            carbs: analysis.carbs,
            fat: analysis.fat,
            loggedAt: new Date()
          }
        },
        $inc: {
          totalCalories: analysis.calories,
          totalProtein: analysis.protein,
          totalCarbs: analysis.carbs,
          totalFat: analysis.fat
        }
      },
      { upsert: true, new: true }
    );

    const response = `🍱 *Meal Logged!*\n✅ Dish: ${analysis.dishName}\n🔥 Calories: ${analysis.calories} kcal\n🥩 Protein: ${analysis.protein}g`;
    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, response, { parse_mode: "Markdown" });
    return;
  }

  // Otherwise, show the interactive options menu
  await ctx.reply(
    "🍱 *How would you like to log your meal?*\n\n" +
    "1️⃣ *AI Vision Auditor* 📸\nJust send me a photo of your plate, and I'll estimate the macros automatically.\n\n" +
    "2️⃣ *Manual Text Log* ✍️\nType out what you ate (e.g., '2 idlis and a coffee').",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✍️ Write Description", callback_data: "start_manual_log" },
            { text: "📸 Photo Guide", callback_data: "photo_log_help" }
          ],
          [
            { text: "📊 View Today's Status", callback_data: "view_diet_status" }
          ]
        ]
      }
    }
  );
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
    await ctx.conversation.enter("logPantry");
    return;
  }

  const waitMsg = await ctx.reply("🍳 *Generating a recipe for you...*", { parse_mode: "Markdown" });
  
  const profile = await Profile.findOne({ telegramId: ctx.from!.id });
  const targetKcal = profile ? Math.round(profile.targetCalories / 4) : 500;
  
  const recipe = await generateRecipeFromPantry(text, targetKcal);
  await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, recipe, { parse_mode: "HTML" });
}

// ─── /recipe command ────────────────────────────────────

export async function recipeCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const profile = await Profile.findOne({ telegramId });
  
  const waitMsg = await ctx.reply("👩‍🍳 *Dreaming up a healthy recipe for you...*", { parse_mode: "Markdown" });
  
  const targetKcal = profile ? Math.round(profile.targetCalories / 3) : 600;
  
  const recipe = await generateRandomRecipeAI(
    profile?.dietType || "non-veg",
    profile?.region,
    targetKcal
  );
  
  await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, recipe, { parse_mode: "HTML" });
}

// ─── /help command ───────────────────────────────────────

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `🤖 *ScaleWise AI — Interactive Command Center*\n\n` +
      `🥗 *Diet & Tracking*\n` +
      `• /log — Start a guided meal log (Photo or Text)\n` +
      `• /diet — See today's remaining budget\n` +
      `• /weight <kg> — Log weight & check for spikes\n` +
      `• /pantry — Get AI recipe ideas from ingredients\n` +
      `• /recipe — Get a random healthy recipe idea\n\n` +
      `🏃 *Activity & Movement*\n` +
      `• /activity — Guided movement logger\n` +
      `• /tax — Calculate walking "tax" for any treat\n\n` +
      `🧠 *Mindfulness & Banking*\n` +
      `• /crave — Start an interactive urge-surfing session\n` +
      `• /cheat — Management menu for banked calories\n\n` +
      `⚙️ *Profile Management*\n` +
      `• /profile — View your targets & banking stats\n` +
      `• /update — Change your goals or stats\n` +
      `• /delete — Wipe all your data permanently\n\n` +
      `💡 *Tip:* You can just send a command and I'll ask you for the details in the next message!`,
    { parse_mode: "Markdown" }
  );
}
