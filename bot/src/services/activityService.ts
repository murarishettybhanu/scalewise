import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
// Using stable 1.5 Flash for high availability
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export interface ParsedActivity {
  activity: string;
  duration: number; // minutes
  intensity: "low" | "moderate" | "high";
  confidence: number;
}

/**
 * MET values for common Indian and general activities.
 */
export const MET_VALUES: Record<string, number> = {
  walking_slow: 2.5,
  walking_brisk: 5.0,
  running: 10.0,
  cycling: 7.5,
  swimming: 8.0,
  yoga: 2.5,
  weightlifting_light: 3.0,
  weightlifting_heavy: 6.0,
  cricket: 4.8,
  badminton_social: 5.5,
  badminton_competitive: 8.0,
  bollywood_dance: 7.0,
  high_intensity_interval_training: 11.0,
  functional_training: 8.0,
};

/**
 * Maps parsed intensity to a specific MET key.
 */
function getMetKey(activity: string, intensity: string): string {
  const base = activity.toLowerCase();
  
  if (base.includes("walk")) {
    return intensity === "high" ? "walking_brisk" : "walking_slow";
  }
  if (base.includes("badminton")) {
    return intensity === "high" ? "badminton_competitive" : "badminton_social";
  }
  if (base.includes("weight") || base.includes("gym") || base.includes("lift")) {
    return intensity === "high" ? "weightlifting_heavy" : "weightlifting_light";
  }
  
  // Default lookups
  if (base.includes("run")) return "running";
  if (base.includes("cycle")) return "cycling";
  if (base.includes("swim")) return "swimming";
  if (base.includes("yoga")) return "yoga";
  if (base.includes("cricket")) return "cricket";
  if (base.includes("dance")) return "bollywood_dance";
  if (base.includes("hiit")) return "high_intensity_interval_training";
  if (base.includes("functional")) return "functional_training";

  return "walking_slow"; // Absolute fallback
}

/**
 * USES GEMINI to parse natural language activity descriptions.
 */
export async function parseActivityText(text: string): Promise<ParsedActivity | null> {
  const prompt = `
    Analyze the following physical activity description and extract the activity name, duration in minutes, and relative intensity.
    
    TEXT: "${text}"
    
    Return ONLY a JSON object with:
    {
      "activity": "standardized name",
      "duration": number,
      "intensity": "low" | "moderate" | "high",
      "confidence": 0.0 to 1.0
    }
    
    If the text doesn't describe a physical activity, return null.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonStr = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Activity Parsing Error:", error);
    return null;
  }
}

/**
 * Calculates calories burned using the MET formula:
 * Calories = MET * Weight(kg) * Time(hours)
 */
export function calculateActivityBurn(weight: number, activity: string, durationMin: number, intensity: string): { calories: number; met: number } {
  const metKey = getMetKey(activity, intensity);
  const met = MET_VALUES[metKey] || 3.0; // Default to moderate activity if unknown
  
  const w = weight || 70; // Fallback weight
  const d = durationMin || 0;
  
  const durationHr = d / 60;
  const calories = Math.round(met * w * durationHr);

  return { calories: isNaN(calories) ? 0 : calories, met };
}
