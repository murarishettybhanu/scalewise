import { type Conversation } from "@grammyjs/conversations";
import { Profile } from "../models";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../types";
import { Context } from "grammy";

type BotConversation = Conversation<BotContext, Context>;

/**
 * Interactive menu-driven manager for Cheat Days and Calorie Banking.
 */
export async function manageCheatConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  const telegramId = ctx.from!.id;
  
  // Initial Status fetch
  const profile = await conversation.external(() => Profile.findOne({ telegramId }).lean());
  if (!profile) {
    await ctx.reply("❌ Profile not found. Please /start first.");
    return;
  }

  const daysLabels: Record<string, string> = {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", 
    friday: "Fri", saturday: "Sat", sunday: "Sun"
  };

  const statusMsg = () => `
🎁 *Cheat Day Manager*

📅 Scheduled: ${profile.cheatDay ? profile.cheatDay.charAt(0).toUpperCase() + profile.cheatDay.slice(1) : "Not set"}
🏦 Banking: ${profile.calorieBankingActive ? "✅ Active" : "❌ Disabled"}
💰 Banked: ${profile.bankedCalories} kcal

_What would you like to do?_
  `;

  const mainKeyboard = new InlineKeyboard()
    .text("📅 Set Cheat Day", "set_day")
    .text("🏦 Toggle Banking", "toggle_banking")
    .row()
    .text("❌ Close", "close");

  const initialMsg = await ctx.reply(statusMsg(), { 
    parse_mode: "Markdown", 
    reply_markup: mainKeyboard 
  });

  // Wait for button click
  const clickCtx = await conversation.waitForCallbackQuery(["set_day", "toggle_banking", "close"]);
  await clickCtx.answerCallbackQuery();

  if (clickCtx.callbackQuery.data === "close") {
    await ctx.api.deleteMessage(ctx.chat!.id, initialMsg.message_id);
    return;
  }

  if (clickCtx.callbackQuery.data === "toggle_banking") {
    const newState = !profile.calorieBankingActive;
    await conversation.external(() => Profile.findOneAndUpdate({ telegramId }, { calorieBankingActive: newState }));
    await ctx.api.editMessageText(ctx.chat!.id, initialMsg.message_id, `✅ Calorie Banking is now *${newState ? "ON" : "OFF"}*.\n\nUse /cheat again to view your status.`, { parse_mode: "Markdown" });
    return;
  }

  if (clickCtx.callbackQuery.data === "set_day") {
    const dayKeyboard = new InlineKeyboard();
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    
    // Create a grid of 2 per row
    days.forEach((day, index) => {
      dayKeyboard.text(daysLabels[day], `day_${day}`);
      if (index % 2 === 1) dayKeyboard.row();
    });
    dayKeyboard.row().text("⬅️ Back", "back");

    await ctx.api.editMessageText(ctx.chat!.id, initialMsg.message_id, "📅 *Select your weekly cheat day:*", { 
      parse_mode: "Markdown", 
      reply_markup: dayKeyboard 
    });

    const dayChoice = await conversation.waitForCallbackQuery([...days.map(d => `day_${d}`), "back"]);
    await dayChoice.answerCallbackQuery();

    if (dayChoice.callbackQuery.data === "back") {
      // Small recursion to go back to main menu
      return manageCheatConversation(conversation, ctx);
    }

    const selectedDay = dayChoice.callbackQuery.data.replace("day_", "");
    await conversation.external(() => Profile.findOneAndUpdate(
      { telegramId }, 
      { cheatDay: selectedDay, calorieBankingActive: true }
    ));

    await ctx.api.editMessageText(ctx.chat!.id, initialMsg.message_id, `✅ Success! Your cheat day is now set to *${selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)}* and banking is active. 🥳`, { parse_mode: "Markdown" });
  }
}
