import { type Conversation } from "@grammyjs/conversations";
import { Profile } from "../models";
import { calculateStepTax } from "../services/behavioralService";
import type { BotContext } from "../types";
import { Context } from "grammy";

type BotConversation = Conversation<BotContext, Context>;

/**
 * Interactive conversation for calculating Step Tax.
 */
export async function logTaxConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  await ctx.reply("🧾 *What food or drink do you want to calculate the 'tax' for?*\n\n(e.g., '1 slice of pizza' or 'a glass of cola')", { parse_mode: "Markdown" });

  const foodCtx = await conversation.waitFor("message:text");
  const food = foodCtx.message.text.trim();
  const telegramId = ctx.from!.id;

  const profile = await conversation.external(() => Profile.findOne({ telegramId }).lean());
  
  const { calories, steps, durationMin } = await conversation.external(() => 
    calculateStepTax(food, profile?.weight || 70)
  );

  const response = `
🧾 *The Tax Negotiator*

🍴 Food: ${food}
🔥 Est. Calories: ${calories} kcal

🏃 *Walking Tax:*
👣 Approx. ${steps.toLocaleString()} brisk steps
⏱️ ~${durationMin} mins of brisk walking

_Is it worth it? Use /crave if the urge is too strong!_
  `;

  await ctx.reply(response, { parse_mode: "Markdown" });
}
