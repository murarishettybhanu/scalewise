import { BotContext } from "../types";
import { dietCommand } from "../commands";

/**
 * Handles all global inline button clicks (callback queries).
 */
export async function handleCallbackQuery(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;

  if (data === "start_manual_log") {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("manualLog");
  } 
  
  else if (data === "photo_log_help") {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "📸 *How to use AI Vision Auditor:*\n\n" +
      "1. Simply tap the 📎 icon or 📸 camera icon in Telegram.\n" +
      "2. Send a clear photo of your meal.\n" +
      "3. I'll automatically analyze the portion sizes and ingredients!\n\n" +
      "_Tip: Try to take the photo from a top-down angle for best accuracy._",
      { parse_mode: "Markdown" }
    );
  }

  else if (data === "view_diet_status") {
    await ctx.answerCallbackQuery();
    // Reuse the existing diet command logic
    await dietCommand(ctx);
  }
}
