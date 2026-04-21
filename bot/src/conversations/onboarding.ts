import { type Conversation } from "@grammyjs/conversations";
import { Context, InlineKeyboard } from "grammy";
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

  const goalMenu = new InlineKeyboard()
    .text("🔥 Fat Loss", "goal_deficit")
    .text("💪 Weight Gain", "goal_surplus");

  await ctx.reply(
    "🎯 *What's your goal?*\n\n" +
      "• *Fat Loss* — Calorie deficit to lose weight\n" +
      "• *Weight Gain / Bulking* — Calorie surplus to build muscle",
    { parse_mode: "Markdown", reply_markup: goalMenu }
  );

  const goalQuery = await conversation.waitForCallbackQuery(["goal_deficit", "goal_surplus"]);
  await goalQuery.answerCallbackQuery();
  const goal = goalQuery.callbackQuery.data === "goal_deficit" ? "deficit" : ("surplus" as Goal);

  await ctx.reply(
    goal === "deficit"
      ? "🔥 Fat Loss mode activated! Let's cut smart."
      : "💪 Bulking mode activated! Let's build muscle."
  );

  // ─── Step 2: Gender ────────────────────────────────────

  const genderMenu = new InlineKeyboard()
    .text("👨 Male", "gender_male")
    .text("👩 Female", "gender_female");

  await ctx.reply(
    "⚧ *What's your biological gender?*\n(This helps calculate your BMR accurately)",
    { parse_mode: "Markdown", reply_markup: genderMenu }
  );

  const genderQuery = await conversation.waitForCallbackQuery(["gender_male", "gender_female"]);
  await genderQuery.answerCallbackQuery();
  const gender = genderQuery.callbackQuery.data === "gender_male" ? "male" : ("female" as Gender);

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

  const actMenu = new InlineKeyboard()
    .text("Sedentary", "act_sedentary").row()
    .text("Lightly Active", "act_lightly_active").row()
    .text("Moderately Active", "act_moderately_active").row()
    .text("Very Active", "act_very_active").row()
    .text("Extra Active", "act_extra_active");

  await ctx.reply(
    "🏃 *How active are you?*\n\n" +
      "• *Sedentary* — Little to no exercise; desk job\n" +
      "• *Lightly Active* — Light exercise 1–3 days/week\n" +
      "• *Moderately Active* — Moderate exercise 3–5 days/week\n" +
      "• *Very Active* — Hard exercise 6–7 days/week\n" +
      "• *Extra Active* — Training twice a day",
    { parse_mode: "Markdown", reply_markup: actMenu }
  );

  const actQuery = await conversation.waitForCallbackQuery([
    "act_sedentary", "act_lightly_active", "act_moderately_active", "act_very_active", "act_extra_active"
  ]);
  await actQuery.answerCallbackQuery();
  const activityLevel = actQuery.callbackQuery.data.replace("act_", "") as ActivityLevel;

  // ─── Step 7: Diet Type ─────────────────────────────────

  const dietMenu = new InlineKeyboard()
    .text("Vegetarian", "diet_vegetarian")
    .text("Vegan", "diet_vegan")
    .row()
    .text("Jain", "diet_jain")
    .text("Non-Veg", "diet_non-veg");

  await ctx.reply(
    "🍽️ *What's your dietary preference?*",
    { parse_mode: "Markdown", reply_markup: dietMenu }
  );

  const dietQuery = await conversation.waitForCallbackQuery([
    "diet_vegetarian", "diet_vegan", "diet_jain", "diet_non-veg"
  ]);
  await dietQuery.answerCallbackQuery();
  const dietType = dietQuery.callbackQuery.data.replace("diet_", "") as DietType;

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

🎯 *Target:* ${aiRecommendation.targetCalories} kcal/day
🥩 *Protein:* ${aiRecommendation.targetProtein}g/day
⏳ *Estimated Time:* ${aiRecommendation.estimatedDays} days
🧠 *Reasoning:* ${aiRecommendation.reasoning}

*Do you accept this AI-guided strategy?*
    `;
    
    await ctx.reply(strategyMsg, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ 
            text: "✅ Accept AI Strategy", 
            callback_data: `accept_ai_strategy_${aiRecommendation.targetCalories}_${aiRecommendation.targetProtein}_${aiRecommendation.estimatedDays}` 
          }],
          [{ text: "❌ Use Standard Plan", callback_data: "use_standard_plan" }]
        ]
      }
    });

    const confirmation = await conversation.waitForCallbackQuery([/^accept_ai_strategy_/, "use_standard_plan"]);
    await confirmation.answerCallbackQuery();

    if (confirmation.callbackQuery.data.startsWith("accept_ai_strategy_")) {
      const parts = confirmation.callbackQuery.data.split("_");
      const confirmedKcal = parseInt(parts[3]);
      const confirmedProtein = parseInt(parts[4]);
      const confirmedDays = parseInt(parts[5]);

      await conversation.external(() => 
        Profile.findOneAndUpdate(
          { telegramId }, 
          { 
            targetCalories: confirmedKcal,
            targetProtein: confirmedProtein,
            estimatedGoalDays: confirmedDays,
            goalStartDate: new Date()
          }
        )
      );
      targets.targetCalories = confirmedKcal;
      targets.targetProtein = confirmedProtein;
      await ctx.reply("🚀 *AI Strategy Activated!* Your daily targets and countdown have been set.");
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
