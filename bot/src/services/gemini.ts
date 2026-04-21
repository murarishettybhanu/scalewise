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
 * Suggests a structured random recipe based on user preferences.
 */
export async function generateRandomRecipeAI(
  dietType: string,
  region: string | undefined,
  targetKcal: number
): Promise<string> {
  const prompt = `
    Act as a professional chef and nutritionist. 
    Suggest a RANDOM healthy recipe that is approximately ${targetKcal} calories for ONE meal.
    
    USER PREFERENCES:
    - Diet: ${dietType}
    - Regional Preference: ${region || "Any"}
    - Target: High Protein, low oil
    
    Output requirements:
    1. Dish Name (with a catchy emoji)
    2. Ingredients list
    3. Quick step-by-step instructions
    4. Macro breakdown (Calories, Protein)
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
    Analyze the following user metrics and recommend the optimal DAILY calorie and protein targets to reach their Goal Weight safely and effectively.
    
    USER METRICS:
    - Current Weight: ${currentWeight} kg
    - Goal Weight: ${goalWeight} kg
    - Age: ${age}
    - Height: ${height} cm
    - Gender: ${gender}
    - Activity Level: ${activityLevel}
    - Overall Strategy: ${goal} (deficit for weight loss, surplus for weight gain)
    
    GUIDELINES:
    1. PROTEIN: Provide a realistic daily protein target in grams. 
       - For weight loss (deficit): Aim for 1.8g to 2.2g per kg of CURRENT weight to preserve muscle.
       - For weight gain (surplus): Aim for 1.6g to 2.0g per kg of CURRENT weight to support muscle growth.
       - DO NOT suggest unrealistic targets (e.g. >200g) unless the user's weight justifies it. Stay sustainable.
    
    2. DURATION: Estimate the number of DAYS to reach the Goal Weight safely.
       - Safe weight loss: ~0.5kg to 1kg per week.
       - Safe weight gain: ~0.25kg to 0.5kg per week.
    
    Output requirements:
    1. Calculate a specific daily calorie target (kcal).
    2. Calculate a specific daily protein target (grams).
    3. Estimate total duration in DAYS to reach the Goal Weight.
    4. Provide a 1-2 sentence reasoning explaining the strategy.
    
    Return the result ONLY as a JSON object:
    {
      "targetCalories": number,
      "targetProtein": number,
      "estimatedDays": number,
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
