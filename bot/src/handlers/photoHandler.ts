import { Context } from "grammy";
import { FileFlavor } from "@grammyjs/files";
import { analyzeFoodImage, recommendFromMenu } from "../services/gemini";
import { DailyLog, Profile } from "../models";
import type { BotContext } from "../types";

export async function handlePhoto(ctx: BotContext & FileFlavor<Context>) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const profile = await Profile.findOne({ telegramId });
  if (!profile) {
    await ctx.reply("You haven't set up your profile yet! Use /start to begin.");
    return;
  }

  // Get the largest photo
  const photo = ctx.message?.photo?.pop();
  if (!photo) return;

  const waitMsg = await ctx.reply("📸 *Analyzing your photo...*", { parse_mode: "Markdown" });

  try {
    const file = await ctx.getFile();
    const url = file.getUrl();
    
    // Download image
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = "image/jpeg"; // Telegram photos are JPEGs

    // For now, let's assume it's a meal log unless we add a menu mode later
    // In future, we could add buttons: [Meal Log] [Menu Review]
    const analysis = await analyzeFoodImage(buffer, mimeType);

    if (!analysis) {
      await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Sorry, I couldn't identify the food in this photo.");
      return;
    }

    // Save to DailyLog
    const today = new Date().toISOString().split("T")[0];
    const log = await DailyLog.findOneAndUpdate(
      { telegramId, date: today },
      { $setOnInsert: { telegramId, date: today } },
      { upsert: true, new: true }
    );

    log.meals.push({
      name: "Auto-logged",
      description: analysis.dishName,
      calories: analysis.calories,
      protein: analysis.protein,
      carbs: analysis.carbs,
      fat: analysis.fat,
      loggedAt: new Date(),
    });

    // Update totals
    log.totalCalories += analysis.calories;
    log.totalProtein += analysis.protein;
    log.totalCarbs += analysis.carbs;
    log.totalFat += analysis.fat;
    await log.save();

    const responseText = `
✅ *${analysis.dishName}* Identified!

📊 *Estimated Macros:*
🔥 Calories: ${analysis.calories} kcal
🥩 Protein: ${analysis.protein}g
🍞 Carbs: ${analysis.carbs}g
🥑 Fat: ${analysis.fat}g

🧐 *Confidence:* ${analysis.confidence}
📝 *Notes:* ${analysis.reasoning}

_Logged to today's intake. Use /diet to see your remaining budget._
    `;

    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, responseText, { parse_mode: "Markdown" });

  } catch (error) {
    console.error("Photo Handling Error:", error);
    await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ An error occurred while processing your photo.");
  }
}
