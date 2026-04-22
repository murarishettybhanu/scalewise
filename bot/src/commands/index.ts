import { Context } from "grammy";
import { User, Profile, DailyLog, WeightLog, ActivityLog } from "../models";
import type { BotContext } from "../types";
import { getRemainingPlan, getTodaysStatus } from "../services/dietEngine";
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

  const adj = profile.strategyAdjustment || 0;
  const adjLabel = adj > 0 ? "Surplus" : "Deficit";
  const adjText = `${adj > 0 ? "+" : ""}${adj} kcal (${adjLabel})`;

  await ctx.reply(
    `👤 *USER PROFILE: ${ctx.from?.first_name}*\n\n` +
      `📏 *Vitals*\n` +
      `• Age: ${profile.age}\n` +
      `• Height: ${profile.height} cm\n` +
      `• Weight: ${profile.weight} kg\n` +
      `• Goal Weight: ${profile.goalWeight} kg\n\n` +
      `🏃 *Activity Level:* ${profile.activityLevel.replace("_", " ")}\n` +
      `🍽️ *Diet:* ${profile.dietType} (${profile.region || "Global"})\n` +
      `💰 *Banked Calories:* ${profile.bankedCalories} kcal\n\n` +
      `─── *Nutrition Targets* ───\n` +
      `📊 BMR: ${profile.bmr} kcal\n` +
      `⚡ TDEE: ${profile.tdee} kcal\n` +
      `🤖 AI Strategy: ${adjText}\n` +
      `⏳ AI Duration: ${profile.estimatedGoalDays} days remaining\n` +
      `🎯 Daily Calories: ${profile.targetCalories} kcal\n` +
      `🥩 Daily Protein: ${profile.targetProtein}g\n\n` +
      `_Use /update to refresh your stats_`,
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
  const status = await getTodaysStatus(telegramId);
  
  if (!profile || !status) {
    await ctx.reply("❌ Please set up your /profile first!");
    return;
  }

  // 1. Determine Meal Type based on INDIA time (IST)
  const istDateString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istDateString);
  const hour = istDate.getHours();
  const minute = istDate.getMinutes();
  const timeStr = `${hour}:${minute < 10 ? '0' : ''}${minute} IST`;

  let mealType = "Dinner";
  if (hour >= 5 && hour < 11) mealType = "Breakfast";
  else if (hour >= 11 && hour < 16) mealType = "Lunch";
  else if (hour >= 16 && hour < 19) mealType = "Snack";

  // 2. Math for Savings (Same as dietEngine)
  const isDeficit = status.goal === "deficit";
  const savingsKcal = isDeficit 
    ? (status.tdee + status.activityBurned) - status.consumed
    : status.consumed - (status.tdee + status.activityBurned);

  // 3. Calculate smart calorie target for this meal
  let suggestedKcal = 500;
  if (mealType === "Breakfast") suggestedKcal = Math.round(profile.targetCalories * 0.25);
  else if (mealType === "Lunch") suggestedKcal = Math.round(profile.targetCalories * 0.35);
  else if (mealType === "Snack") suggestedKcal = 200;
  else suggestedKcal = Math.round(profile.targetCalories * 0.30);

  // Stay within reasonable bounds of the savings/allowance
  // If we have very little allowance, suggest a very small meal
  suggestedKcal = Math.min(suggestedKcal, status.remaining);
  
  if (suggestedKcal < 150 && status.remaining > 150) {
    suggestedKcal = 200; 
  } else if (suggestedKcal < 100) {
    suggestedKcal = Math.max(100, status.remaining);
  }

  const waitMsg = await ctx.reply(
    `👩‍🍳 <b>Strategic Kitchen Assistant</b>\n\n` +
    `🕒 <b>Time:</b> ${timeStr}\n` +
    `💰 <b>Daily Savings:</b> ${savingsKcal} kcal\n\n` +
    `🤖 Looking for a healthy <b>${mealType}</b> (~${suggestedKcal} kcal)...`, 
    { parse_mode: "HTML" }
  );
  
  const recipe = await generateRandomRecipeAI(
    profile.dietType || "non-veg",
    profile.region,
    suggestedKcal,
    mealType,
    status.remaining
  );
  
  await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, recipe, { parse_mode: "HTML" });
}

// ─── /help command ───────────────────────────────────────

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `🤖 *ScaleWise AI — Interactive Command Center*\n\n` +
      `🥗 *Diet & Tracking*\n` +
      `• /log — Start a guided meal log (Photo or Text)\n` +
      `• /diet — Check Daily Savings & Progress\n` +
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
