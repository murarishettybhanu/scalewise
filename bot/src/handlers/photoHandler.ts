import { analyzeFoodImage } from "../services/gemini";
import { DailyLog, Profile } from "../models";
import { config } from "../config";
import type { BotContext } from "../types";

/**
 * Handles incoming food photos.
 * Uses manual URL construction to bypass grammy-files type issues.
 */
export async function handlePhoto(ctx: BotContext) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const profile = await Profile.findOne({ telegramId });
  if (!profile) {
    await ctx.reply("You haven't set up your profile yet! Use /start to begin.");
    return;
  }

  // Get the largest photo or a document
  const photo = ctx.message?.photo?.pop();
  const document = ctx.message?.document;
  
  const fileId = photo?.file_id || document?.file_id;
  if (!fileId) return;

  // If it's a document, check if it's an image
  if (document && !document.mime_type?.startsWith("image/")) {
    await ctx.reply("Please send an image file (JPEG/PNG).");
    return;
  }

  const waitMsg = await ctx.reply("📸 *Analyzing your photo...*", { parse_mode: "Markdown" });

  try {
    // Get file info from Telegram
    const file = await ctx.api.getFile(fileId);
    
    // Construct the direct download URL manually
    // Format: https://api.telegram.org/file/bot<token>/<file_path>
    const url = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    
    // Download image
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to download image from Telegram");
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = "image/jpeg";

    // Call Gemini Vision Service
    const analysis = await analyzeFoodImage(buffer, mimeType);

    if (!analysis) {
      await ctx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Sorry, I couldn't identify the food in this photo.");
      return;
    }

    // Save to DailyLog
    const today = new Date().toISOString().split("T")[0];
    await DailyLog.findOneAndUpdate(
      { telegramId, date: today },
      {
        $push: {
          meals: {
            name: "Auto-logged",
            description: analysis.dishName,
            calories: analysis.calories,
            protein: analysis.protein,
            carbs: analysis.carbs,
            fat: analysis.fat,
            loggedAt: new Date(),
          },
        },
        $inc: {
          totalCalories: analysis.calories,
          totalProtein: analysis.protein,
          totalCarbs: analysis.carbs,
          totalFat: analysis.fat,
        },
      },
      { upsert: true, new: true }
    );

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
