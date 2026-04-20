import { type Conversation } from "@grammyjs/conversations";
import { Profile, DailyLog } from "../models";
import { parseFoodText } from "../services/gemini";
import type { BotContext } from "../types";
import { Context } from "grammy";

type BotConversation = Conversation<BotContext, Context>;

/**
 * Interactive conversation for manual food logging via text.
 */
export async function manualLogConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  await ctx.reply("🍱 *Manual Food Logging*\n\nTell me what you ate! (e.g., '2 idlis and a coffee' or '100g chicken breast with salad')", { parse_mode: "Markdown" });

  const foodCtx = await conversation.waitFor("message:text");
  const text = foodCtx.message.text.trim();
  const telegramId = ctx.from!.id;

  const waitMsg = await foodCtx.reply("🥗 *Analyzing your meal...*", { parse_mode: "Markdown" });

  // Use the same parsing logic as the vision auditor but for text
  const analysis = await conversation.external(() => parseFoodText(text));
  
  if (!analysis) {
    await foodCtx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Sorry, I couldn't understand that meal description. Try being more specific about quantities!");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  
  await conversation.external(async () => {
    await DailyLog.create({
      telegramId,
      date: today,
      dishName: analysis.dishName,
      calories: analysis.calories,
      protein: analysis.protein,
      carbs: analysis.carbs,
      fat: analysis.fat,
      isManual: true
    });
  });

  const response = `
🍱 *Meal Logged!*
✅ Dish: ${analysis.dishName}
🔥 Calories: ${analysis.calories} kcal
🥩 Protein: ${analysis.protein}g
🥗 Carbs: ${analysis.carbs}g
🥑 Fat: ${analysis.fat}g

_Confidence: ${analysis.confidence}_
  `;

  await foodCtx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, response, { parse_mode: "Markdown" });
}
