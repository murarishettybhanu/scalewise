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
    .text("⚧ Gender", "update_gender")
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
    "update_gender",
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
    const goalMenu = new InlineKeyboard()
      .text("🔥 Fat Loss", "goal_deficit")
      .text("💪 Weight Gain", "goal_surplus");

    await ctx.reply("🎯 *What's your new goal?*", {
      parse_mode: "Markdown",
      reply_markup: goalMenu,
    });

    const goalQuery = await conversation.waitForCallbackQuery(["goal_deficit", "goal_surplus"]);
    await goalQuery.answerCallbackQuery();
    updateData.goal = goalQuery.callbackQuery.data === "goal_deficit" ? "deficit" : "surplus";
  }

  else if (action === "update_activity") {
    const actMenu = new InlineKeyboard()
      .text("Sedentary", "act_sedentary").row()
      .text("Lightly Active", "act_lightly_active").row()
      .text("Moderately Active", "act_moderately_active").row()
      .text("Very Active", "act_very_active").row()
      .text("Extra Active", "act_extra_active");

    await ctx.reply(
      "🏃 *How active are you?*\n\n" +
        "• *Sedentary* — Little exercise\n" +
        "• *Lightly Active* — 1–3 days/week\n" +
        "• *Moderately Active* — 3–5 days/week\n" +
        "• *Very Active* — 6–7 days/week\n" +
        "• *Extra Active* — Professional training",
      { parse_mode: "Markdown", reply_markup: actMenu }
    );

    const actQuery = await conversation.waitForCallbackQuery([
      "act_sedentary", "act_lightly_active", "act_moderately_active", "act_very_active", "act_extra_active"
    ]);
    await actQuery.answerCallbackQuery();
    updateData.activityLevel = actQuery.callbackQuery.data.replace("act_", "") as ActivityLevel;
  }

  else if (action === "update_diet") {
    const dietMenu = new InlineKeyboard()
      .text("Vegetarian", "diet_vegetarian")
      .text("Vegan", "diet_vegan")
      .row()
      .text("Jain", "diet_jain")
      .text("Non-Veg", "diet_non-veg");

    await ctx.reply("🍽️ *Choose your new diet type:*", {
      parse_mode: "Markdown",
      reply_markup: dietMenu,
    });

    const dietQuery = await conversation.waitForCallbackQuery([
      "diet_vegetarian", "diet_vegan", "diet_jain", "diet_non-veg"
    ]);
    await dietQuery.answerCallbackQuery();
    updateData.dietType = dietQuery.callbackQuery.data.replace("diet_", "") as DietType;
  }

  else if (action === "update_gender") {
    const genderMenu = new InlineKeyboard()
      .text("👨 Male", "gender_male")
      .text("👩 Female", "gender_female");

    await ctx.reply("⚧ *Choose your biological gender:*", {
      parse_mode: "Markdown",
      reply_markup: genderMenu,
    });

    const genderQuery = await conversation.waitForCallbackQuery(["gender_male", "gender_female"]);
    await genderQuery.answerCallbackQuery();
    updateData.gender = genderQuery.callbackQuery.data === "gender_male" ? "male" : "female";
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
    let lastStrategyMsgId: number | undefined;
    while (true) {
      if (lastStrategyMsgId) {
        await ctx.api.editMessageReplyMarkup(ctx.chat!.id, lastStrategyMsgId, { reply_markup: { inline_keyboard: [] } }).catch(() => {});
      }
      const waitMsg = await ctx.reply("🤖 <b>Gemini is recalculating your strategy based on your new weight...</b>", { parse_mode: "HTML" });
      
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

      await ctx.api.deleteMessage(ctx.chat!.id, waitMsg.message_id).catch(() => {});

      if (!aiRec) {
        await ctx.reply("❌ <b>AI strategy could not be generated.</b> Keeping current targets.", { parse_mode: "HTML" });
        break;
      }

      const msg = await ctx.reply(
        `💡 <b>Recommendation for ${finalGoalWeight}kg Goal</b>\n\n` +
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
      lastStrategyMsgId = msg.message_id;

      const decision = await conversation.waitForCallbackQuery([/^accept_ai_strategy_/, "regenerate_strategy", "ignore_ai_target"]);
      await decision.answerCallbackQuery();

      if (decision.callbackQuery.data.startsWith("accept_ai_strategy_")) {
        const parts = decision.callbackQuery.data.split("_");
        await conversation.external(() => 
          Profile.findOneAndUpdate(
            { telegramId }, 
            { 
              targetCalories: parseInt(parts[3]),
              targetProtein: parseInt(parts[4]),
              estimatedGoalDays: parseInt(parts[5]),
              goalStartDate: new Date()
            }
          )
        );

        // Remove buttons from the accepted message
        await ctx.api.editMessageReplyMarkup(ctx.chat!.id, lastStrategyMsgId, { reply_markup: { inline_keyboard: [] } }).catch(() => {});
        
        await ctx.reply("🚀 <b>AI Strategy Activated!</b> Your profile has been updated.", { parse_mode: "HTML" });
        break;
      } else if (decision.callbackQuery.data === "regenerate_strategy") {
        await ctx.reply("🔄 <b>Recalculating fresh strategy...</b>", { parse_mode: "HTML" });
        // Continue loop
      } else {
        // Remove buttons from the ignored message
        await ctx.api.editMessageReplyMarkup(ctx.chat!.id, lastStrategyMsgId, { reply_markup: { inline_keyboard: [] } }).catch(() => {});
        await ctx.reply("👌 <b>Keeping your current targets.</b>", { parse_mode: "HTML" });
        break;
      }
    }
  }
}
