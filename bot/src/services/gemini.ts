import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

export interface FoodAnalysis {
  dishName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "High" | "Medium" | "Low";
  reasoning: string;
}

/**
 * Analyzes a food image and returns nutritional estimations.
 */
export async function analyzeFoodImage(imageBuffer: Buffer, mimeType: string): Promise<FoodAnalysis | null> {
  const prompt = `
    Act as a professional nutritionist and expert in Indian cuisine. 
    Analyze the uploaded image of a meal and estimate its nutritional content.
    
    Output requirements:
    1. Identify the dish name.
    2. Provide total Calories (kcal), Protein (g), Carbohydrates (g), and Fat (g).
    3. Include a 'Confidence Level' (High/Medium/Low) based on visibility of ingredients and hidden fats (oil/ghee).
    4. Provide a brief reasoning for the estimate.

    Return the result ONLY as a JSON object with the following keys:
    {
      "dishName": string,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "confidence": "High" | "Medium" | "Low",
      "reasoning": string
    }
  `;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (Gemini sometimes wraps in markdown blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as FoodAnalysis;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
}

/**
 * Recommends goal-aligned dishes from a restaurant menu image.
 */
export async function recommendFromMenu(imageBuffer: Buffer, mimeType: string, goal: "deficit" | "surplus"): Promise<string> {
  const prompt = `
    Analyze this restaurant menu image. 
    Recommend the top 3 best dishes for someone who is on a "${goal}" goal.
    Explain why each dish is a good choice.
    Focus on protein-high and nutrient-dense options.
  `;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType,
        },
      },
    ]);

    return result.response.text();
  } catch (error) {
    console.error("Gemini Menu Error:", error);
    return "Sorry, I couldn't process the menu. Please try again.";
  }
}

/**
 * Generates a recipe from available pantry items.
 */
export async function generateRecipeFromPantry(items: string, targetKcal: number): Promise<string> {
  const prompt = `
    I have the following items in my pantry: ${items}.
    Suggest a healthy, easy-to-cook recipe that is approximately ${targetKcal} calories.
    Focus on high protein and use minimal oil.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Recipe Error:", error);
    return "Sorry, I couldn't generate a recipe for those items.";
  }
}

/**
 * Parses a text description of a meal and returns nutritional estimations.
 */
export async function parseFoodText(text: string): Promise<FoodAnalysis | null> {
  const prompt = `
    Act as a professional nutritionist and expert in Indian cuisine. 
    Analyze the following text description of a meal and estimate its nutritional content.
    
    MEAL DESCRIPTION: "${text}"
    
    Output requirements:
    1. Identify the dish name.
    2. Provide total Calories (kcal), Protein (g), Carbohydrates (g), and Fat (g).
    3. Include a 'Confidence Level' (High/Medium/Low).
    4. Provide a brief reasoning for the estimate.

    Return the result ONLY as a JSON object with the following keys:
    {
      "dishName": string,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "confidence": "High" | "Medium" | "Low",
      "reasoning": string
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as FoodAnalysis;
  } catch (error) {
    console.error("Gemini Text Parsing Error:", error);
    return null;
  }
}
export interface GoalRecommendation {
  targetCalories: number;
  reasoning: string;
}

/**
 * Calculates strategic calorie targets using AI based on goal weight.
 */
export async function calculateGoalCaloriesAI(
  currentWeight: number,
  goalWeight: number,
  age: number,
  height: number,
  gender: string,
  activityLevel: string,
  goal: string
): Promise<GoalRecommendation | null> {
  const prompt = `
    Act as a professional sports nutritionist and metabolic specialist. 
    Analyze the following user metrics and recommend the optimal DAILY calorie target to reach their Goal Weight safely and effectively.
    
    USER METRICS:
    - Current Weight: ${currentWeight} kg
    - Goal Weight: ${goalWeight} kg
    - Age: ${age}
    - Height: ${height} cm
    - Gender: ${gender}
    - Activity Level: ${activityLevel}
    - Overall Strategy: ${goal} (deficit for weight loss, surplus for weight gain)
    
    Output requirements:
    1. Calculate a specific daily calorie target (kcal).
    2. Provide a 1-2 sentence reasoning explaining why this target is appropriate (considering metabolic rate, activity, and gap to goal).
    
    Return the result ONLY as a JSON object:
    {
      "targetCalories": number,
      "reasoning": string
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as GoalRecommendation;
  } catch (error) {
    console.error("Gemini Goal Calculation Error:", error);
    return null;
  }
}
