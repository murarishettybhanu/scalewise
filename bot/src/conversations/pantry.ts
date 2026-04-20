import { type Conversation } from "@grammyjs/conversations";
import { Profile } from "../models";
import { generateRecipeFromPantry } from "../services/gemini";
import type { BotContext } from "../types";
import { Context } from "grammy";

type BotConversation = Conversation<BotContext, Context>;

/**
 * Interactive conversation for getting recipe ideas from pantry ingredients.
 */
export async function logPantryConversation(
  conversation: BotConversation,
  ctx: Context
): Promise<void> {
  await ctx.reply("🍳 *Kitchen Assistant*\n\nTell me what ingredients you have in your kitchen, and I'll suggest a high-protein recipe for you!", { parse_mode: "Markdown" });

  const pantryCtx = await conversation.waitFor("message:text");
  const text = pantryCtx.message.text.trim();
  const telegramId = ctx.from!.id;

  const waitMsg = await pantryCtx.reply("🍲 *Thinking of a high-protein recipe...*", { parse_mode: "Markdown" });
  
  const profile = await conversation.external(() => Profile.findOne({ telegramId }).lean());
  const targetKcal = profile ? Math.round(profile.targetCalories / 4) : 500;
  
  const recipe = await conversation.external(() => generateRecipeFromPantry(text, targetKcal));
  
  await pantryCtx.api.editMessageText(ctx.chat!.id, waitMsg.message_id, recipe, { parse_mode: "Markdown" });
}
