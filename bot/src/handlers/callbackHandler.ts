import { BotContext } from "../types";
import { dietCommand } from "../commands";
import { User, Profile, DailyLog, WeightLog, ActivityLog } from "../models";

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
    await dietCommand(ctx);
  }

  else if (data === "confirm_delete_all") {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from!.id;
    await User.deleteOne({ telegramId });
    await Profile.deleteOne({ telegramId });
    await DailyLog.deleteMany({ telegramId });
    await WeightLog.deleteMany({ telegramId });
    await ActivityLog.deleteMany({ telegramId });
    await ctx.editMessageText(
      "🗑️ *All your data has been deleted.*\n\n" +
      "You've been successfully removed from our system. Feel free to /start again anytime!",
      { parse_mode: "Markdown" }
    );
  }

  else if (data === "cancel_delete") {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Safe! Your profile and data are secure. ✅");
  }
}
