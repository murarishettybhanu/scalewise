import { type Conversation } from "@grammyjs/conversations";
import { Context, InlineKeyboard } from "grammy";
import { User, Profile, Goal, Gender, ActivityLevel, DietType } from "../models";
import { calculateAllTargets } from "../services/calculator";
import type { BotContext } from "../types";

export type BotConversation = Conversation<BotContext, Context>;

export async function updateProfileConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  const telegramId = ctx.from!.id;
  
  // Fetch current profile
  const profile = await conversation.external(() => Profile.findOne({ telegramId }));
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
      "🏃 *How active are you?*\n1️⃣ Sedentary\n2️⃣ Light\n3️⃣ Moderate\n4️⃣ Active\n5️⃣ Very Active\n\nReply with 1–5",
      { parse_mode: "Markdown" }
    );
    const activityMap: Record<string, ActivityLevel> = {
      "1": "sedentary", "2": "light", "3": "moderate", "4": "active", "5": "very_active"
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

  // 4. Merge and Recalculate
  const newProfile = {
    weight: updateData.weight ?? profile.weight,
    height: updateData.height ?? profile.height,
    age: updateData.age ?? profile.age,
    gender: profile.gender,
    activityLevel: updateData.activityLevel ?? profile.activityLevel,
    goal: updateData.goal ?? profile.goal,
  };

  const targets = calculateAllTargets(
    newProfile.weight,
    newProfile.height,
    newProfile.age,
    newProfile.gender,
    newProfile.activityLevel,
    newProfile.goal
  );

  // 5. Save and Notify
  await conversation.external(async () => {
    await Profile.findOneAndUpdate(
      { telegramId },
      {
        ...updateData,
        bmr: targets.bmr,
        tdee: targets.tdee,
        targetCalories: targets.targetCalories,
        targetProtein: targets.targetProtein,
      },
      { new: true }
    );
  });

  await ctx.reply(
    `✅ *Profile Updated!*\n\n` +
      `🎯 *New Daily Target:* ${targets.targetCalories} kcal | ${targets.targetProtein}g protein\n\n` +
      `Check your full /profile to see the changes.`,
    { parse_mode: "Markdown" }
  );
}
