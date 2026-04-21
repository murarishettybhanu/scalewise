import { type Conversation } from "@grammyjs/conversations";
import { Context, InlineKeyboard } from "grammy";
import { User, Profile, Goal, Gender, ActivityLevel, DietType } from "../models";
import { calculateAllTargets } from "../services/calculator";
import { calculateGoalCaloriesAI } from "../services/gemini";
import type { BotContext } from "../types";

export type BotConversation = Conversation<BotContext, Context>;

export async function updateProfileConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  const telegramId = ctx.from!.id;
  
  // Fetch current profile (using .lean() for a plain JS object)
  const profile = await conversation.external(() => Profile.findOne({ telegramId }).lean());
  if (!profile) {
    await ctx.reply("Profile not found. Please /start first.");
    return;
  }

  // 1. Ask what to update
  const menu = new InlineKeyboard()
    .text("⚖️ Weight", "update_weight")
    .text("📏 Height", "update_height")
    .row()
    .text("🎂 Age", "update_age")
    .text("🎯 Goal", "update_goal")
    .row()
    .text("🏃 Activity", "update_activity")
    .text("🍽️ Diet", "update_diet")
    .row()
    .text("🎯 Goal Weight", "update_goal_weight")
    .row()
    .text("❌ Cancel", "cancel_update");

  await ctx.reply("What would you like to update in your profile?", {
    reply_markup: menu,
  });

  // 2. Wait for selection
  const selection = await conversation.waitForCallbackQuery([
    "update_weight",
    "update_height",
    "update_age",
    "update_goal",
    "update_activity",
    "update_diet",
    "update_goal_weight",
    "cancel_update",
  ]);

  await selection.answerCallbackQuery();
  const action = selection.callbackQuery.data;

  if (action === "cancel_update") {
    await ctx.reply("Update canceled.");
    return;
  }

  // 3. Handle specific updates
  let updateData: Partial<any> = {};

  if (action === "update_weight") {
    await ctx.reply("⚖️ *Enter your new weight* (in kg, e.g. `75.5`)", { parse_mode: "Markdown" });
    while (true) {
      const weightCtx = await conversation.waitFor("message:text");
      const parsed = parseFloat(weightCtx.message.text.trim());
      if (!isNaN(parsed) && parsed >= 30 && parsed <= 300) {
        updateData.weight = parsed;
        break;
      }
      await weightCtx.reply("Please enter a valid weight in kg (30–300).");
    }
  } 
  
  else if (action === "update_height") {
    await ctx.reply("📏 *Enter your new height* (in cm, e.g. `180`)", { parse_mode: "Markdown" });
    while (true) {
      const heightCtx = await conversation.waitFor("message:text");
      const parsed = parseFloat(heightCtx.message.text.trim());
      if (!isNaN(parsed) && parsed >= 100 && parsed <= 250) {
        updateData.height = parsed;
        break;
      }
      await heightCtx.reply("Please enter a valid height in cm (100–250).");
    }
  }

  else if (action === "update_age") {
    await ctx.reply("🎂 *Enter your new age* (in years)", { parse_mode: "Markdown" });
    while (true) {
      const ageCtx = await conversation.waitFor("message:text");
      const parsed = parseInt(ageCtx.message.text.trim(), 10);
      if (!isNaN(parsed) && parsed >= 13 && parsed <= 100) {
        updateData.age = parsed;
        break;
      }
      await ageCtx.reply("Please enter a valid age (13–100).");
    }
  }

  else if (action === "update_goal") {
    await ctx.reply(
      "🎯 *What's your new goal?*\n1️⃣ Fat Loss\n2️⃣ Weight Gain\n\nReply with `1` or `2`",
      { parse_mode: "Markdown" }
    );
    while (true) {
      const goalCtx = await conversation.waitFor("message:text");
      const input = goalCtx.message.text.trim();
      if (input === "1") { updateData.goal = "deficit"; break; }
      else if (input === "2") { updateData.goal = "surplus"; break; }
      await goalCtx.reply("Please reply with `1` or `2`.");
    }
  }

  else if (action === "update_activity") {
    await ctx.reply(
      "🏃 *How active are you?*\n\n" +
        "1️⃣ *Sedentary* — Little to no exercise; desk job\n" +
        "2️⃣ *Lightly Active* — Light exercise or sports 1–3 days per week\n" +
        "3️⃣ *Moderately Active* — Moderate exercise or sports 3–5 days per week\n" +
        "4️⃣ *Very Active* — Hard exercise or sports 6–7 days per week\n" +
        "5️⃣ *Extra Active* — Very hard exercise, physical job, or training twice a day\n\n" +
        "Reply with 1–5",
      { parse_mode: "Markdown" }
    );
    const activityMap: Record<string, ActivityLevel> = {
      "1": "sedentary", "2": "lightly_active", "3": "moderately_active", "4": "very_active", "5": "extra_active"
    };
    while (true) {
      const actCtx = await conversation.waitFor("message:text");
      const input = actCtx.message.text.trim();
      if (activityMap[input]) { updateData.activityLevel = activityMap[input]; break; }
      await actCtx.reply("Please reply with a number from 1 to 5.");
    }
  }

  else if (action === "update_diet") {
    await ctx.reply(
      "🍽️ *Choose your new diet type:*\n1️⃣ Veg\n2️⃣ Vegan\n3️⃣ Jain\n4️⃣ Non-Veg\n\nReply with 1–4",
      { parse_mode: "Markdown" }
    );
    const dietMap: Record<string, DietType> = {
      "1": "vegetarian", "2": "vegan", "3": "jain", "4": "non-veg"
    };
    while (true) {
      const dietCtx = await conversation.waitFor("message:text");
      const input = dietCtx.message.text.trim();
      if (dietMap[input]) { updateData.dietType = dietMap[input]; break; }
      await dietCtx.reply("Please reply with a number from 1 to 4.");
    }
  }

  else if (action === "update_goal_weight") {
    await ctx.reply("🎯 *Enter your new goal weight* (in kg)", { parse_mode: "Markdown" });
    while (true) {
      const goalWCtx = await conversation.waitFor("message:text");
      const parsed = parseFloat(goalWCtx.message.text.trim());
      if (!isNaN(parsed) && parsed >= 30 && parsed <= 300) {
        updateData.goalWeight = parsed;
        break;
      }
      await goalWCtx.reply("Please enter a valid goal weight in kg (30–300).");
    }
  }

  // 4. Merge and Recalculate
  const newProfile = {
    weight: Number(updateData.weight ?? profile.weight),
    height: Number(updateData.height ?? profile.height),
    age: Number(updateData.age ?? profile.age),
    gender: profile.gender,
    activityLevel: updateData.activityLevel ?? profile.activityLevel,
    goal: updateData.goal ?? profile.goal,
  };

  // Debug log to catch NaN issues
  console.log("Recalculating targets with:", newProfile);

  const targets = calculateAllTargets(
    newProfile.weight,
    newProfile.height,
    newProfile.age,
    newProfile.gender,
    newProfile.activityLevel,
    newProfile.goal
  );

  if (isNaN(targets.bmr)) {
    console.error("❌ Calculation resulted in NaN!", { newProfile, targets });
    await ctx.reply("⚠️ Sorry, there was an error updating your targets. Please check your inputs.");
    return;
  }

  // 5. Save BMR/TDEE Vitals
  await conversation.external(async () => {
    await Profile.findOneAndUpdate(
      { telegramId },
      {
        ...updateData,
        bmr: targets.bmr,
        tdee: targets.tdee,
        targetCalories: targets.targetCalories, // Will be updated by AI if weight changed
        targetProtein: targets.targetProtein,
      },
      { new: true }
    );
  });

  await ctx.reply(`✅ *Vitals Updated!* (BMR: ${targets.bmr} | TDEE: ${targets.tdee})`, { parse_mode: "Markdown" });

  // 6. AI Strategy Re-check (if weight changed)
  const weightChanged = updateData.weight !== undefined || updateData.goalWeight !== undefined;
  
  if (weightChanged) {
    await ctx.reply("🤖 *Gemini is recalculating your strategy based on your new weight...*", { parse_mode: "Markdown" });
    
    const finalWeight = updateData.weight ?? profile.weight;
    const finalGoalWeight = updateData.goalWeight ?? profile.goalWeight;
    
    const aiRec = await conversation.external(() => 
      calculateGoalCaloriesAI(
        finalWeight,
        finalGoalWeight,
        newProfile.age,
        newProfile.height,
        newProfile.gender,
        newProfile.activityLevel,
        newProfile.goal
      )
    );

    if (aiRec) {
      await ctx.reply(
        `💡 *Recommendation for ${finalGoalWeight}kg Goal*\n\n` +
        `🎯 *Target:* ${aiRec.targetCalories} kcal\n` +
        `🧠 *Reasoning:* ${aiRec.reasoning}\n\n` +
        `*Update your daily budget?*`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: `✅ Accept ${aiRec.targetCalories} kcal`, callback_data: `accept_ai_target_${aiRec.targetCalories}` }],
              [{ text: "❌ Stick to Current", callback_data: "ignore_ai_target" }]
            ]
          }
        }
      );
    }
  }
}
