import cron from "node-cron";
import { Bot, Api, RawApi } from "grammy";
import { Profile } from "../models";
import { generateMorningBlueprint, getProteinNudge } from "./dietEngine";
import type { BotContext } from "../types";

/**
 * Initializes all cron jobs for the bot.
 */
export function initScheduler(bot: Bot<BotContext>) {
  // Morning Blueprint at 7:00 AM daily
  cron.schedule("0 7 * * *", async () => {
    console.log("⏰ Running Morning Blueprint cron job...");
    
    try {
      const profiles = await Profile.find({});
      
      for (const profile of profiles) {
        try {
          const blueprint = await generateMorningBlueprint(profile.telegramId);
          await bot.api.sendMessage(profile.telegramId, blueprint, { parse_mode: "Markdown" });
        } catch (err) {
          console.error(`Failed to send blueprint to ${profile.telegramId}:`, err);
        }
      }
    } catch (error) {
      console.error("Critical error in Morning Blueprint cron:", error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  // Hourly Protein Nudge check (every 2 hours between 9 AM and 9 PM)
  cron.schedule("0 9-21/2 * * *", async () => {
    console.log("⏰ Running Protein Nudge check...");
    
    try {
      const profiles = await Profile.find({});
      
      for (const profile of profiles) {
        try {
          const nudge = await getProteinNudge(profile.telegramId);
          if (nudge) {
            await bot.api.sendMessage(profile.telegramId, nudge, { parse_mode: "Markdown" });
          }
        } catch (err) {
          console.error(`Failed to send nudge to ${profile.telegramId}:`, err);
        }
      }
    } catch (error) {
      console.error("Critical error in Protein Nudge cron:", error);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  console.log("✅ Scheduler initialized.");
}
