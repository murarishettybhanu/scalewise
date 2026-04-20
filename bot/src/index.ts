import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { config } from "./config";
import { connectDatabase } from "./models/db";
import { onboardingConversation } from "./conversations/onboarding";
import { startCommand, profileCommand, helpCommand } from "./commands";
import type { BotContext } from "./types";

// ─── Initialize Bot ──────────────────────────────────────

const bot = new Bot<BotContext>(config.botToken);

// ─── Middleware ──────────────────────────────────────────

// Session is required for conversations plugin
bot.use(session({ initial: () => ({}) }));

// Conversations plugin
bot.use(conversations());
bot.use(createConversation(onboardingConversation, "onboarding"));

// ─── Command Handlers ───────────────────────────────────

bot.command("start", startCommand);
bot.command("profile", profileCommand);
bot.command("help", helpCommand);

// ─── Fallback ───────────────────────────────────────────

bot.on("message", async (ctx) => {
  await ctx.reply(
    "I didn't understand that. Use /help to see available commands. 🤖"
  );
});

// ─── Error handling ─────────────────────────────────────

bot.catch((err) => {
  console.error("Bot error:", err);
});

// ─── Start ──────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting ScaleWise AI...");

  // Connect to MongoDB
  await connectDatabase();

  // Start bot (long polling for development, switch to webhooks for production)
  console.log("🤖 Bot is running! Press Ctrl+C to stop.");
  await bot.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
