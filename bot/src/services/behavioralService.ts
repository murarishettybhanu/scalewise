import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { Profile, WeightLog } from "../models";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

/**
 * Calculates the "Step Tax" for a food item.
 * Formula: Steps = Calories / (0.04 to 0.05 per step depending on weight/intensity)
 * Standard approximation: 100 kcal ≈ 2000 steps (for average 70kg person).
 */
export async function calculateStepTax(foodItem: string, weightKg: number = 70): Promise<{ calories: number; steps: number; durationMin: number }> {
  // Use Gemini to estimate calories for the specific food item if not provided
  const prompt = `Estimate the calories in one standard serving of "${foodItem}". Return ONLY the number.`;
  const result = await model.generateContent(prompt);
  const calories = parseInt(result.response.text().trim(), 10) || 200;

  // Simple math: 1 standard step at brisk pace (5 MET) burns ~0.04-0.05 kcal.
  // 1000 steps ≈ 40-50 kcal. 
  // Brisk walking (~5.0 km/h) = 100 steps/min. 
  const caloriesPer1000Steps = weightKg * 0.6; // Rough estimate: 0.6 kcal/kg per km. 1 km ≈ 1300 steps.
  const steps = Math.round((calories / caloriesPer1000Steps) * 1000);
  const durationMin = Math.round(steps / 100); // Assuming 100 steps/min brisk pace.

  return { calories, steps, durationMin };
}

/**
 * Generates an Urge Surfing intervention message.
 */
export async function getUrgeSurfingGuide(craving: string): Promise<string> {
  const prompt = `
    The user is craving "${craving}". 
    Provide a supportive, 3-sentence "Urge Surfing" mindfulness guided exercise.
    Focus on:
    1. Acknowledging the sensation without judgment.
    2. Visualizing the craving as a wave that will peak and subside.
    3. Suggesting a 5-minute distraction (water, walking, breathing).
    
    Format: Use friendly, coaching tone. Keep it under 300 characters.
  `;
  
  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    return "Take a deep breath. This craving is like a wave—it will peak and eventually wash away. Drink a glass of water and wait 5 minutes; you've got this! 💪";
  }
}

/**
 * Checks for sodium-driven weight spikes after a cheat day.
 */
export async function checkSodiumSpike(telegramId: number, currentWeight: number): Promise<string | null> {
  const profile = await Profile.findOne({ telegramId });
  if (!profile || !profile.cheatDay) return null;

  // Find yesterday's weight
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  
  const lastLog = await WeightLog.findOne({ telegramId, date: yesterdayStr });
  if (!lastLog) return null;

  const diff = currentWeight - lastLog.weight;
  
  // If weight spikes > 1.0kg overnight after a cheat day
  // (Simplified: we check if yesterday or today is the day after the cheat day)
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayDay = days[new Date().getDay()];
  const yesterdayDay = days[new Date(yesterday).getDay()];
  
  const isPostCheat = todayDay === profile.cheatDay || yesterdayDay === profile.cheatDay;

  if (isPostCheat && diff >= 1.0) {
    return `
⚖️ *Phew, Don't Panic!* 
You noticed a ${diff.toFixed(1)}kg jump today. Since you had your cheat day recently, this is almost certainly **water retention** from extra sodium and carbs.

💡 *Recovery Plan:*
💧 Drink 3-4L of water today.
🥩 Keep protein high.
🥗 Avoid extra salt. 
It'll fade in 48-72 hours. Stay the course! 🦾
    `;
  }

  return null;
}
