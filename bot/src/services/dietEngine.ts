import { Profile, DailyLog, ActivityLog, IProfile } from "../models";

export interface DietStatus {
  totalTarget: number;
  consumed: number;
  remaining: number;
  proteinTarget: number;
  proteinConsumed: number;
  proteinRemaining: number;
  activityBurned: number;
}

/**
 * Gets the current nutritional status for a user for today.
 */
export async function getTodaysStatus(telegramId: number): Promise<DietStatus | null> {
  const profile = await Profile.findOne({ telegramId });
  if (!profile) return null;

  const today = new Date().toISOString().split("T")[0];
  
  // Parallel fetch for logs
  const [mealLog, activityLogs] = await Promise.all([
    DailyLog.findOne({ telegramId, date: today }),
    ActivityLog.find({ telegramId, date: today })
  ]);

  const consumed = mealLog?.totalCalories || 0;
  const proteinConsumed = mealLog?.totalProtein || 0;
  
  // Sum up all activities for today
  const activityBurned = activityLogs.reduce((sum, log) => sum + log.caloriesBurned, 0);

  // --- CALORIE BANKING LOGIC ---
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayDay = days[new Date().getDay()];
  
  let targetCalories = profile.targetCalories;
  
  // If calorie banking is active and today isn't the cheat day, deduct the bank amount
  if (profile.calorieBankingActive && profile.cheatDay && todayDay !== profile.cheatDay) {
    targetCalories -= 150; // Bank 150 kcal per day
  }

  // Remaining budget includes calories earned from exercise
  const remaining = Math.max(0, (targetCalories + activityBurned) - consumed);

  return {
    totalTarget: targetCalories,
    consumed,
    remaining,
    proteinTarget: profile.targetProtein,
    proteinConsumed,
    proteinRemaining: Math.max(0, profile.targetProtein - proteinConsumed),
    activityBurned
  };
}

/**
 * Generates a text-based plan for the day's meals.
 */
export async function generateMorningBlueprint(telegramId: number): Promise<string> {
  const profile = await Profile.findOne({ telegramId });
  if (!profile) return "Profile not found.";

  const goalText = profile.goal === "deficit" ? "🔥 Fat Loss" : "💪 Weight Gain";
  
  // Suggest a breakdown: 30% B, 40% L, 20% D, 10% S
  const kcal = profile.targetCalories;
  const prot = profile.targetProtein;

  return `
☀️ *YOUR MORNING BLUEPRINT*

🎯 Goal: ${goalText}
📊 Target: ${kcal} kcal | ${prot}g Protein

🍽️ *Suggested Breakdown:*
🍳 Breakfast: ${Math.round(kcal * 0.3)} kcal (${Math.round(prot * 0.25)}g P)
🍛 Lunch: ${Math.round(kcal * 0.4)} kcal (${Math.round(prot * 0.35)}g P)
🥗 Dinner: ${Math.round(kcal * 0.2)} kcal (${Math.round(prot * 0.3)}g P)
🍏 Snack: ${Math.round(kcal * 0.1)} kcal (${Math.round(prot * 0.1)}g P)

_Tips: Start with protein. Drink 500ml water before every meal!_
  `;
}

/**
 * Logic to adjust remaining budget.
 */
export async function getRemainingPlan(telegramId: number): Promise<string> {
  const status = await getTodaysStatus(telegramId);
  if (!status) return "Profile not found.";

  if (status.remaining <= 0) {
    return "🚨 *Budget Exhausted!* You've reached your calorie limit for today. Focus on ultra-low-calorie hydration (water, black coffee/tea) if still hungry.";
  }
  return `
📊 *DAILY STATUS*
🔥 Calories: ${status.consumed} / ${status.totalTarget} 
🥩 Protein: ${status.proteinConsumed} / ${status.proteinTarget}

✅ *Remaining Budget:* ${status.remaining} kcal
🚀 *Protein Target Remaining:* ${status.proteinRemaining}g

_Tip: Focus your remaining ${status.remaining} calories on high-protein sources to hit your goal!_
  `;
}

/**
 * Checks if a user needs a protein nudge and returns a message if they do.
 */
export async function getProteinNudge(telegramId: number): Promise<string | null> {
  const status = await getTodaysStatus(telegramId);
  if (!status) return null;

  const hour = new Date().getHours();
  
  // Logic: If it's past 4 PM and they have consumed less than 40% of protein
  if (hour >= 16 && status.proteinConsumed < (status.proteinTarget * 0.4)) {
    return `
🕒 *Protein Check-in!*

You've only hit ${Math.round((status.proteinConsumed / status.proteinTarget) * 100)}% of your protein goal today. 

💡 *Quick Fix:* Grab some Greek yogurt, a protein shake, or a handful of roasted chana to catch up! 🥩
    `;
  }

  // If it's past 8 PM and they are still under 70%
  if (hour >= 20 && status.proteinConsumed < (status.proteinTarget * 0.7)) {
    return `
🌙 *Evening Protein Nudge*

You still have ${status.proteinRemaining}g of protein left for the day. Can you add some paneer, eggs, or lentils to your dinner? 💪
    `;
  }

  return null;
}
