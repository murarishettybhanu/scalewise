import { BotContext } from "../types";
import { dietCommand } from "../commands";
import { User, Profile, DailyLog, WeightLog, ActivityLog } from "../models";
import { calculateGoalCaloriesAI } from "../services/gemini";

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

  else if (data?.startsWith("accept_ai_strategy_")) {
    const parts = data.split("_");
    const kcal = parseInt(parts[3]);
    const protein = parseInt(parts[4]);
    const days = parseInt(parts[5]);
    const telegramId = ctx.from!.id;

    await Profile.findOneAndUpdate(
      { telegramId }, 
      { 
        targetCalories: kcal,
        targetProtein: protein,
        estimatedGoalDays: days,
        goalStartDate: new Date()
      }
    );

    await ctx.answerCallbackQuery({ text: `Strategy Activated!` });
    await ctx.editMessageText(
      `✅ <b>Strategy Activated!</b>\n\n` +
      `🎯 <b>Target:</b> ${kcal} kcal\n` +
      `🥩 <b>Protein:</b> ${protein}g\n` +
      `⏳ <b>Duration:</b> ${days} days\n\n` +
      `<i>Your countdown starts now!</i>`, 
      { parse_mode: "HTML" }
    );
  }

  else if (data === "regenerate_strategy") {
    const telegramId = ctx.from!.id;
    const profile = await Profile.findOne({ telegramId });
    if (!profile) return;

    await ctx.answerCallbackQuery({ text: "Recalculating..." });
    await ctx.editMessageText("🤖 <b>Gemini is cooking up a fresh strategy...</b>", { parse_mode: "HTML" });

    const aiRec = await calculateGoalCaloriesAI(
      profile.weight,
      profile.goalWeight,
      profile.age,
      profile.height,
      profile.gender,
      profile.activityLevel,
      profile.goal
    );

    if (aiRec) {
      await ctx.editMessageText(
        `🤖 <b>New AI Strategy Suggested</b>\n\n` +
        `🎯 <b>Target:</b> ${aiRec.targetCalories} kcal\n` +
        `🥩 <b>Protein:</b> ${aiRec.targetProtein}g\n` +
        `⏳ <b>Time:</b> ${aiRec.estimatedDays} days\n\n` +
        `🧠 <b>Reasoning:</b> ${aiRec.reasoning}\n\n` +
        `<i>Update your daily targets?</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ 
                text: "✅ Accept Strategy", 
                callback_data: `accept_ai_strategy_${aiRec.targetCalories}_${aiRec.targetProtein}_${aiRec.estimatedDays}` 
              }],
              [{ text: "🔄 Generate Another", callback_data: "regenerate_strategy" }],
              [{ text: "❌ Skip for Now", callback_data: "ignore_ai_target" }]
            ]
          }
        }
      );
    }
  }

  else if (data === "ignore_ai_target" || data === "use_standard_plan") {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("👌 Plan kept as is. You can change this anytime in /profile.");
  }
}
