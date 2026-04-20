import { Context } from "grammy";
import { User, Profile } from "../models";
import type { BotContext } from "../types";

// ─── /start command ──────────────────────────────────────

export async function startCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const firstName = ctx.from!.first_name;

  // Upsert user record
  await User.findOneAndUpdate(
    { telegramId },
    {
      telegramId,
      firstName,
      lastName: ctx.from!.last_name,
      username: ctx.from!.username,
    },
    { upsert: true, new: true }
  );

  // Check if already onboarded
  const profile = await Profile.findOne({ telegramId });

  if (profile) {
    await ctx.reply(
      `👋 Welcome back, *${firstName}*!\n\n` +
        `🎯 Daily Target: ${profile.targetCalories} kcal | ${profile.targetProtein}g protein\n\n` +
        `Use /help to see commands or /profile to view your full profile.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Start onboarding
  await ctx.conversation.enter("onboarding");
}

// ─── /profile command ────────────────────────────────────

export async function profileCommand(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from!.id;
  const profile = await Profile.findOne({ telegramId });

  if (!profile) {
    await ctx.reply("You haven't set up your profile yet! Use /start to begin.");
    return;
  }

  const goalLabel = profile.goal === "deficit" ? "🔥 Fat Loss" : "💪 Weight Gain";
  const dietLabel = profile.dietType.charAt(0).toUpperCase() + profile.dietType.slice(1);
  const activityLabels: Record<string, string> = {
    sedentary: "Sedentary",
    light: "Lightly Active",
    moderate: "Moderately Active",
    active: "Very Active",
    very_active: "Extremely Active",
  };

  await ctx.reply(
    `📋 *Your ScaleWise Profile*\n\n` +
      `${goalLabel}\n` +
      `👤 ${profile.gender === "male" ? "Male" : "Female"}, ${profile.age}y\n` +
      `📏 ${profile.height} cm | ⚖️ ${profile.weight} kg\n` +
      `🏃 ${activityLabels[profile.activityLevel]}\n` +
      `🍽️ ${dietLabel}${profile.region ? ` (${profile.region})` : ""}\n\n` +
      `─── *Nutrition Targets* ───\n` +
      `📊 BMR: ${profile.bmr} kcal\n` +
      `⚡ TDEE: ${profile.tdee} kcal\n` +
      `🎯 Daily Calories: ${profile.targetCalories} kcal\n` +
      `🥩 Daily Protein: ${profile.targetProtein}g\n\n` +
      `_Use /start to re-do onboarding_`,
    { parse_mode: "Markdown" }
  );
}

// ─── /help command ───────────────────────────────────────

export async function helpCommand(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `🤖 *ScaleWise AI — Commands*\n\n` +
      `/start — Start onboarding or welcome back\n` +
      `/profile — View your profile & targets\n` +
      `/help — Show this help message\n\n` +
      `_More commands coming soon: meal logging, food photo analysis, activity tracking, and more!_`,
    { parse_mode: "Markdown" }
  );
}
