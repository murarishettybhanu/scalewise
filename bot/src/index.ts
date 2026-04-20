import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { config } from "./config";
import { connectDatabase } from "./models/db";
import { onboardingConversation } from "./conversations/onboarding";
import { 
  startCommand, profileCommand, helpCommand, 
  updateCommand, deleteCommand, weightCommand, 
  logCommand, dietCommand, pantryCommand,
  activityCommand, taxCommand, craveCommand, cheatCommand
} from "./commands";
import { updateProfileConversation } from "./conversations/updateProfile";
import { logActivityConversation } from "./conversations/activity";
import { handlePhoto } from "./handlers/photoHandler";
import { initScheduler } from "./services/scheduler";
import { User, Profile, DailyLog } from "./models";
import type { BotContext } from "./types";

// ─── Initialize Bot ──────────────────────────────────────

const bot = new Bot<BotContext>(config.botToken);

// ─── Middleware ──────────────────────────────────────────

// Session is required for conversations plugin
bot.use(session({ initial: () => ({}) }));

// Conversations plugin
bot.use(conversations());
bot.use(createConversation(onboardingConversation, "onboarding"));
bot.use(createConversation(updateProfileConversation, "updateProfile"));
bot.use(createConversation(logActivityConversation, "logActivity"));

// ─── Command Handlers ───────────────────────────────────

bot.command("start", startCommand);
bot.command("profile", profileCommand);
bot.command("update", updateCommand);
bot.command("delete", deleteCommand);
bot.command("weight", weightCommand);
bot.command("activity", activityCommand);
bot.command("tax", taxCommand);
bot.command("crave", craveCommand);
bot.command("cheat", cheatCommand);
bot.command("log", logCommand);
bot.command("diet", dietCommand);
bot.command("pantry", pantryCommand);
bot.command("help", helpCommand);

// ─── Media Handlers ─────────────────────────────────────

bot.on(":photo", handlePhoto);

// ─── Callback Queries ───────────────────────────────────

bot.callbackQuery("confirm_delete_all", async (ctx) => {
  const telegramId = ctx.from.id;

  try {
    // Delete all linked data
    await User.deleteOne({ telegramId });
    await Profile.deleteOne({ telegramId });
    await DailyLog.deleteMany({ telegramId });

    await ctx.answerCallbackQuery({ text: "Profile deleted permanently." });
    await ctx.editMessageText(
      "🗑️ *All your data has been deleted.*\n\n" +
        "You've been successfully removed from our system. Feel free to /start again anytime!",
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Delete error:", error);
    await ctx.answerCallbackQuery({ text: "Error deleting profile." });
    await ctx.reply("Sorry, there was an error deleting your data. Please try again later.");
  }
});

bot.callbackQuery("cancel_delete", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Canceled." });
  await ctx.editMessageText("Safe! Your profile and data are secure. ✅");
});

// ─── Fallback ───────────────────────────────────────────

bot.on("message:text", async (ctx) => {
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

  // Initialize Scheduler
  initScheduler(bot);

  // Start bot (long polling for development, switch to webhooks for production)
  console.log("🤖 Bot is running! Press Ctrl+C to stop.");
  await bot.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
