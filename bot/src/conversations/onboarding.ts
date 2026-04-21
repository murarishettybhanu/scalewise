import { type Conversation } from "@grammyjs/conversations";
import { Context } from "grammy";
import { Goal, Gender, ActivityLevel, DietType, User, Profile } from "../models";
import { calculateAllTargets } from "../services/calculator";
import { calculateGoalCaloriesAI } from "../services/gemini";
import type { BotContext } from "../types";

// ─── Type for conversation inside the builder ───────────
// OC = outer context (with ConversationFlavor), C = inner context (plain Context)

export type BotConversation = Conversation<BotContext, Context>;

// ─── Onboarding Conversation ────────────────────────────

export async function onboardingConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  const telegramId = ctx.from!.id;

  await ctx.reply(
    "👋 *Welcome to ScaleWise AI!*\n\n" +
      "I'm your personal diet & fitness assistant. " +
      "Let's set up your profile so I can create a plan tailored just for you.\n\n" +
      "This will take about 2 minutes. Let's go! 💪",
    { parse_mode: "Markdown" }
  );

  // ─── Step 1: Goal ──────────────────────────────────────

  await ctx.reply(
    "🎯 *What's your goal?*\n\n" +
      "1️⃣ *Fat Loss* — Calorie deficit to lose weight\n" +
      "2️⃣ *Weight Gain / Bulking* — Calorie surplus to build muscle\n\n" +
      "Reply with `1` or `2`",
    { parse_mode: "Markdown" }
  );

  let goal: Goal;
  while (true) {
    const goalCtx = await conversation.waitFor("message:text");
    const input = goalCtx.message.text.trim();
    if (input === "1") {
      goal = "deficit";
      break;
    } else if (input === "2") {
      goal = "surplus";
      break;
    }
    await goalCtx.reply("Please reply with `1` for Fat Loss or `2` for Weight Gain.");
  }

  await ctx.reply(
    goal === "deficit"
      ? "🔥 Fat Loss mode activated! Let's cut smart."
      : "💪 Bulking mode activated! Let's build muscle."
  );

  // ─── Step 2: Gender ────────────────────────────────────

  await ctx.reply(
    "⚧ *What's your biological gender?*\n(This helps calculate your BMR accurately)\n\n" +
      "1️⃣ Male\n2️⃣ Female\n\nReply with `1` or `2`",
    { parse_mode: "Markdown" }
  );

  let gender: Gender;
  while (true) {
    const genderCtx = await conversation.waitFor("message:text");
    const input = genderCtx.message.text.trim();
    if (input === "1") {
      gender = "male";
      break;
    } else if (input === "2") {
      gender = "female";
      break;
    }
    await genderCtx.reply("Please reply with `1` for Male or `2` for Female.");
  }

  // ─── Step 3: Age ───────────────────────────────────────

  await ctx.reply("🎂 *How old are you?* (in years)", { parse_mode: "Markdown" });

  let age: number;
  while (true) {
    const ageCtx = await conversation.waitFor("message:text");
    const parsed = parseInt(ageCtx.message.text.trim(), 10);
    if (!isNaN(parsed) && parsed >= 13 && parsed <= 100) {
      age = parsed;
      break;
    }
    await ageCtx.reply("Please enter a valid age between 13 and 100.");
  }

  // ─── Step 4: Height ────────────────────────────────────

  await ctx.reply("📏 *What's your height?* (in cm, e.g. `170`)", {
    parse_mode: "Markdown",
  });

  let height: number;
  while (true) {
    const heightCtx = await conversation.waitFor("message:text");
    const parsed = parseFloat(heightCtx.message.text.trim());
    if (!isNaN(parsed) && parsed >= 100 && parsed <= 250) {
      height = parsed;
      break;
    }
    await heightCtx.reply("Please enter a valid height in cm (100–250).");
  }

  // ─── Step 5: Weight ────────────────────────────────────

  await ctx.reply("⚖️ *What's your current weight?* (in kg, e.g. `72.5`)", {
    parse_mode: "Markdown",
  });

  let weight: number;
  while (true) {
    const weightCtx = await conversation.waitFor("message:text");
    const parsed = parseFloat(weightCtx.message.text.trim());
    if (!isNaN(parsed) && parsed >= 30 && parsed <= 300) {
      weight = parsed;
      break;
    }
    await weightCtx.reply("Please enter a valid weight in kg (30–300).");
  }

  // ─── Step 5.5: Goal Weight ────────────────────────────

  await ctx.reply(`🎯 *What is your goal weight?* (in kg)`, {
    parse_mode: "Markdown",
  });

  let goalWeight: number;
  while (true) {
    const goalWeightCtx = await conversation.waitFor("message:text");
    const parsed = parseFloat(goalWeightCtx.message.text.trim());
    if (!isNaN(parsed) && parsed >= 30 && parsed <= 300) {
      goalWeight = parsed;
      break;
    }
    await goalWeightCtx.reply("Please enter a valid goal weight in kg (30–300).");
  }

  // ─── Step 6: Activity Level ────────────────────────────

  await ctx.reply(
    "🏃 *How active are you?*\n\n" +
      "1️⃣ *Sedentary* — Little to no exercise; desk job\n" +
      "2️⃣ *Lightly Active* — Light exercise or sports 1–3 days per week\n" +
      "3️⃣ *Moderately Active* — Moderate exercise or sports 3–5 days per week\n" +
      "4️⃣ *Very Active* — Hard exercise or sports 6–7 days per week\n" +
      "5️⃣ *Extra Active* — Very hard exercise, physical job, or training twice a day\n\n" +
      "Reply with a number (1–5)",
    { parse_mode: "Markdown" }
  );

  const activityMap: Record<string, ActivityLevel> = {
    "1": "sedentary",
    "2": "lightly_active",
    "3": "moderately_active",
    "4": "very_active",
    "5": "extra_active",
  };

  let activityLevel: ActivityLevel;
  while (true) {
    const activityCtx = await conversation.waitFor("message:text");
    const input = activityCtx.message.text.trim();
    if (activityMap[input]) {
      activityLevel = activityMap[input];
      break;
    }
    await activityCtx.reply("Please reply with a number from 1 to 5.");
  }

  // ─── Step 7: Diet Type ─────────────────────────────────

  await ctx.reply(
    "🍽️ *What's your dietary preference?*\n\n" +
      "1️⃣ Vegetarian\n" +
      "2️⃣ Vegan\n" +
      "3️⃣ Jain\n" +
      "4️⃣ Non-Veg\n\n" +
      "Reply with a number (1–4)",
    { parse_mode: "Markdown" }
  );

  const dietMap: Record<string, DietType> = {
    "1": "vegetarian",
    "2": "vegan",
    "3": "jain",
    "4": "non-veg",
  };

  let dietType: DietType;
  while (true) {
    const dietCtx = await conversation.waitFor("message:text");
    const input = dietCtx.message.text.trim();
    if (dietMap[input]) {
      dietType = dietMap[input];
      break;
    }
    await dietCtx.reply("Please reply with a number from 1 to 4.");
  }

  // ─── Step 8: Region (optional) ─────────────────────────

  await ctx.reply(
    "🌍 *What's your regional cuisine preference?* (optional)\n\n" +
      "e.g. `south-indian`, `punjabi`, `gujarati`, `bengali`, `maharashtrian`\n\n" +
      "Reply with your region or type `skip` to skip.",
    { parse_mode: "Markdown" }
  );

  const regionCtx = await conversation.waitFor("message:text");
  const region =
    regionCtx.message.text.trim().toLowerCase() === "skip"
      ? undefined
      : regionCtx.message.text.trim().toLowerCase();

  // ─── Calculate targets ─────────────────────────────────

  const targets = calculateAllTargets(weight, height, age, gender, activityLevel, goal);

  // ─── Save to database ──────────────────────────────────

  await conversation.external(async () => {
    await User.findOneAndUpdate(
      { telegramId },
      { isOnboarded: true },
      { new: true }
    );

    await Profile.findOneAndUpdate(
      { telegramId },
      {
        telegramId,
        goal,
        age,
        height,
        weight,
        goalWeight,
        gender,
        activityLevel,
        dietType,
        region,
        bmr: targets.bmr,
        tdee: targets.tdee,
        targetCalories: targets.targetCalories, // This will be updated by AI confirmation if user accepts
        targetProtein: targets.targetProtein,
      },
      { upsert: true, new: true }
    );
  });

  // ─── Step 10: AI Strategy Confirmation ──────────────────

  await ctx.reply("🤖 *Gemini is calculating your optimal strategy...*", { parse_mode: "Markdown" });
  
  const aiRecommendation = await conversation.external(() => 
    calculateGoalCaloriesAI(weight, goalWeight, age, height, gender, activityLevel, goal)
  );

  if (aiRecommendation) {
    const strategyMsg = `
💡 *AI Strategy Recommended*

🎯 *New Target:* ${aiRecommendation.targetCalories} kcal/day
🧠 *Reasoning:* ${aiRecommendation.reasoning}

*Do you accept this AI-guided strategy?*
    `;
    
    await ctx.reply(strategyMsg, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Accept AI Strategy", callback_data: `accept_ai_target_${aiRecommendation.targetCalories}` }],
          [{ text: "❌ Use Standard Plan", callback_data: "use_standard_plan" }]
        ]
      }
    });

    const confirmation = await conversation.waitForCallbackQuery([/^accept_ai_target_/, "use_standard_plan"]);
    await confirmation.answerCallbackQuery();

    if (confirmation.callbackQuery.data.startsWith("accept_ai_target_")) {
      const confirmedKcal = parseInt(confirmation.callbackQuery.data.split("_")[3]);
      await conversation.external(() => 
        Profile.findOneAndUpdate({ telegramId }, { targetCalories: confirmedKcal })
      );
      targets.targetCalories = confirmedKcal;
      await ctx.reply("🚀 *AI Strategy Activated!* Your daily target has been updated.");
    } else {
      await ctx.reply("✅ *Standard Plan used.* You can always update this via /profile.");
    }
  }

  // ─── Show results ──────────────────────────────────────

  const goalEmoji = goal === "deficit" ? "🔥" : "💪";
  const dietLabel = dietType.charAt(0).toUpperCase() + dietType.slice(1);

  await ctx.reply(
    `✅ *Profile Complete!* Here's your personalized target:\n\n` +
      `${goalEmoji} *Goal:* ${goal === "deficit" ? "Fat Loss" : "Weight Gain"}\n` +
      `🎯 *Daily Calories:* ${targets.targetCalories} kcal\n` +
      `🥩 *Daily Protein:* ${targets.targetProtein}g\n` +
      `🍽️ *Diet:* ${dietLabel}${region ? ` (${region})` : ""}\n\n` +
      `🚀 *ScaleWise AI Superpowers:*\n\n` +
      `📸 *AI Vision Auditor*: Just send a *photo* of your food to auto-log your calories and protein.\n\n` +
      `📊 *Daily Budget*: Use /diet to see what's left for your day.\n\n` +
      `⚖️ *Weight Tracker*: Use \`/weight <kg>\` daily to stay on track.\n\n` +
      `🍳 *Kitchen Assistant*: Need a recipe? Try \`/pantry paneer, spinach, tomato\` for high-protein ideas.\n\n` +
      `⏰ *Morning Blueprint*: Check back at *7:00 AM* every day for your customized meal plan nudge!`,
    { parse_mode: "Markdown" }
  );
}
