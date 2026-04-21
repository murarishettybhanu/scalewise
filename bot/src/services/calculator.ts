import { Gender, ActivityLevel, Goal } from "../models";

// ─── Activity Multipliers (Harris-Benedict convention) ───

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

// ─── BMR Calculation (Mifflin–St Jeor) ──────────────────
// Male:   10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161 + 5 → +5
// Female: 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161

export function calculateBMR(
  weight: number,
  height: number,
  age: number,
  gender: Gender
): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(gender === "male" ? base + 5 : base - 161);
}

// ─── TDEE = BMR × Activity Multiplier ───────────────────

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

// ─── Target Calories (based on goal) ────────────────────
// Deficit: TDEE - 500 kcal (standard 1 lb/week loss)
// Surplus: TDEE + 300 kcal (lean bulk)

export function calculateTargetCalories(tdee: number, goal: Goal): number {
  return goal === "deficit" ? tdee - 500 : tdee + 300;
}

// ─── Target Protein ─────────────────────────────────────
// Deficit: 2.0 g/kg (preserve muscle during cut)
// Surplus: 1.6 g/kg (support muscle growth)

export function calculateTargetProtein(weight: number, goal: Goal): number {
  const multiplier = goal === "deficit" ? 2.0 : 1.6;
  return Math.round(weight * multiplier);
}

// ─── All-in-one calculator ──────────────────────────────

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProtein: number;
}

export function calculateAllTargets(
  weight: number,
  height: number,
  age: number,
  gender: Gender,
  activityLevel: ActivityLevel,
  goal: Goal
): NutritionTargets {
  const bmr = calculateBMR(weight, height, age, gender);
  const tdee = calculateTDEE(bmr, activityLevel);
  const targetCalories = calculateTargetCalories(tdee, goal);
  const targetProtein = calculateTargetProtein(weight, goal);

  return { bmr, tdee, targetCalories, targetProtein };
}
