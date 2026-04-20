import { type Conversation } from "@grammyjs/conversations";
import { User, Profile, ActivityLog } from "../models";
import { parseActivityText, calculateActivityBurn } from "../services/activityService";
import type { BotContext } from "../types";
import { Context } from "grammy";

type BotConversation = Conversation<BotContext, Context>;

/**
 * Interactive conversation for logging activity.
 */
export async function logActivityConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  await ctx.reply("🏃 *What did you do?*\n\nTell me the activity and duration (e.g., '30 mins of brisk walking' or '1 hour gym session')", { parse_mode: "Markdown" });

  const activityCtx = await conversation.waitFor("message:text");
  const text = activityCtx.message.text.trim();
  const telegramId = ctx.from!.id;

  const waitMsg = await activityCtx.reply("🏃 *Parsing your activity...*", { parse_mode: "Markdown" });

  const profile = await conversation.external(() => Profile.findOne({ telegramId }).lean());
  if (!profile) {
    await activityCtx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Profile not found. Please /start first.");
    return;
  }

  // Use the same logic as the command version
  const parsed = await conversation.external(() => parseActivityText(text));
  
  if (!parsed || !parsed.activity || Number(parsed.duration) <= 0) {
    await activityCtx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ Sorry, I couldn't understand that. Try being more specific about what you did and for how long (e.g. '30 mins walk').");
    return;
  }

  const { calories, met } = calculateActivityBurn(profile.weight, parsed.activity, Number(parsed.duration), parsed.intensity);

  if (isNaN(calories) || isNaN(met)) {
    await activityCtx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, "❌ I had trouble calculating the calories for that. Could you try being more specific about the duration? (e.g., '30 minutes')");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  
  await conversation.external(async () => {
    await ActivityLog.create({
      telegramId,
      date: today,
      activityName: parsed.activity,
      durationMinutes: parsed.duration,
      caloriesBurned: calories,
      metValue: met
    });
  });

  const response = `
🏃 *Activity Logged!*
✅ Activity: ${parsed.activity}
⏱️ Duration: ${parsed.duration} mins
🔥 Burned: ${calories} kcal

_Your daily calorie budget has increased!_
  `;

  await activityCtx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, response, { parse_mode: "Markdown" });
}
