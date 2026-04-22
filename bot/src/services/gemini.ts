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
    Use ONLY <b> for bolding. DO NOT use markdown or tags like <p>, <ul>, <li>, or <ol>.
    Use plain newlines for spacing and "•" for bullet points.
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
 * Suggests a structured random recipe based on user preferences.
 */
export async function generateRandomRecipeAI(
  dietType: string,
  region: string | undefined,
  targetKcal: number,
  mealType: string,
  remainingKcal: number
): Promise<string> {
  const prompt = `
    Act as a professional chef and nutritionist. 
    Suggest a healthy, high-protein ${mealType} recipe for a user with these constraints:
    - Diet: ${dietType}
    - Regional Preference: ${region || "Any"}
    - Suggested Calories for this meal: ${targetKcal} kcal
    - Total Remaining Calories for today: ${remainingKcal} kcal
    - Goal: High Protein, low oil, balanced for the time of day (${mealType}).
    
    Output requirements:
    1. Use ONLY <b> for bold and <i> for italic. DO NOT use <p>, <ul>, <li>, or <ol> tags.
    2. Use plain newlines for spacing and "•" for bullet points.
    3. Dish Name (with a catchy emoji)
    4. Why this is a great ${mealType} choice (1 sentence)
    5. Ingredients list
    6. Quick step-by-step instructions
    7. Macro breakdown (Calories, Protein)
    8. DO NOT use any markdown characters like * or _.
  `;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Random Recipe Error:", error);
    return "Sorry, I couldn't cook up a recipe right now. Please try again!";
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
  targetProtein: number;
  estimatedDays: number;
  adjustment: number;
  reasoning: string;
}

/**
 * Uses Gemini to calculate a personalized calorie/protein strategy.
 */
export async function calculateGoalCaloriesAI(
  weight: number,
  goalWeight: number,
  age: number,
  height: number,
  gender: string,
  activityLevel: string,
  goal: string
): Promise<GoalRecommendation | null> {
  const prompt = `
    Act as an expert fitness coach and nutritionist. 
    Calculate a precision strategy for a user with these stats:
    - Weight: ${weight}kg
    - Goal Weight: ${goalWeight}kg
    - Goal: ${goal === "deficit" ? "Fat Loss (Deficit)" : "Weight Gain (Surplus)"}
    - Stats: ${gender}, ${age} years old, ${height}cm
    - Activity: ${activityLevel}
    
    Guidelines:
    - Maintenance (TDEE) calculation is the baseline.
    - Deficit: Suggest -300 to -750 kcal from TDEE based on aggressive or sustainable intent.
    - Surplus: Suggest +250 to +500 kcal from TDEE.
    - Protein: 1.2g to 1.6g per kg of current body weight.
    - Timeline:
        - Safe fat loss: ~0.5kg to 1kg per week.
        - Safe weight gain: ~0.25kg to 0.5kg per week.
    
    Output requirements:
    1. Calculate a specific daily calorie target (kcal).
    2. Calculate a specific daily protein target (grams).
    3. Estimate total duration in DAYS to reach the Goal Weight.
    4. Calculate the specific ADJUSTMENT amount from maintenance (e.g. -500 for deficit, 300 for surplus).
    5. Provide a 1-2 sentence reasoning explaining the strategy.
    6. Use ONLY <b> for bolding. DO NOT use markdown (* or _) or tags like <p>, <ul>, <li>, or <ol>.
    
    Return the result ONLY as a JSON object:
    {
      "targetCalories": number,
      "targetProtein": number,
      "estimatedDays": number,
      "adjustment": number,
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
