import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Types ───────────────────────────────────────────

export type Goal = "deficit" | "surplus";
export type DietType = "vegetarian" | "vegan" | "jain" | "non-veg";
export type Gender = "male" | "female";
export type ActivityLevel =
  | "sedentary"       // little or no exercise
  | "lightly_active"  // 1-3 days/week
  | "moderately_active" // 3-5 days/week
  | "very_active"     // 6-7 days/week
  | "extra_active";    // athlete / physical job

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  isOnboarded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfile extends Document {
  telegramId: number;
  goal: Goal;
  age: number;
  height: number;       // cm
  weight: number;       // kg
  goalWeight: number;   // kg
  gender: Gender;
  activityLevel: ActivityLevel;
  dietType: DietType;
  region?: string;      // e.g. "south-indian", "punjabi", "gujarati"
  bmr: number;          // kcal/day (calculated)
  tdee: number;         // kcal/day (calculated)
  targetCalories: number; // kcal/day (adjusted for goal)
  targetProtein: number;  // grams/day
  cheatDay?: string;     // e.g. "saturday"
  calorieBankingActive: boolean;
  bankedCalories: number;
  goalStartDate: Date;
  estimatedGoalDays: number;
  strategyAdjustment: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IActivityLog extends Document {
  telegramId: number;
  date: string;         // YYYY-MM-DD
  activityName: string;
  durationMinutes: number;
  caloriesBurned: number;
  metValue: number;
  loggedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDailyLog extends Document {
  telegramId: number;
  date: string;         // YYYY-MM-DD
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: {
    name: string;       // breakfast, lunch, dinner, snack
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    loggedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IWeightLog extends Document {
  telegramId: number;
  weight: number;
  date: string;         // YYYY-MM-DD
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schemas ─────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    username: { type: String },
    firstName: { type: String, required: true },
    lastName: { type: String },
    isOnboarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ProfileSchema = new Schema<IProfile>(
  {
    telegramId: { type: Number, required: true, unique: true, index: true },
    goal: { type: String, enum: ["deficit", "surplus"], required: true },
    age: { type: Number, required: true },
    height: { type: Number, required: true },
    weight: { type: Number, required: true },
    goalWeight: { type: Number, required: true },
    gender: { type: String, enum: ["male", "female"], required: true },
    activityLevel: {
      type: String,
      enum: ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"],
      required: true,
    },
    dietType: {
      type: String,
      enum: ["vegetarian", "vegan", "jain", "non-veg"],
      required: true,
    },
    region: { type: String },
    bmr: { type: Number, required: true },
    tdee: { type: Number, required: true },
    targetCalories: { type: Number, required: true },
    targetProtein: { type: Number, required: true },
    cheatDay: { type: String, enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
    calorieBankingActive: { type: Boolean, default: false },
    bankedCalories: { type: Number, default: 0 },
    goalStartDate: { type: Date, default: Date.now },
    estimatedGoalDays: { type: Number, default: 0 },
    strategyAdjustment: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    telegramId: { type: Number, required: true, index: true },
    date: { type: String, required: true },
    activityName: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    caloriesBurned: { type: Number, required: true },
    metValue: { type: Number, required: true },
    loggedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ telegramId: 1, date: 1 });

const MealSubSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DailyLogSchema = new Schema<IDailyLog>(
  {
    telegramId: { type: Number, required: true, index: true },
    date: { type: String, required: true },
    totalCalories: { type: Number, default: 0 },
    totalProtein: { type: Number, default: 0 },
    totalCarbs: { type: Number, default: 0 },
    totalFat: { type: Number, default: 0 },
    meals: [MealSubSchema],
  },
  { timestamps: true }
);

// Compound index: one log per user per day
DailyLogSchema.index({ telegramId: 1, date: 1 }, { unique: true });

const WeightLogSchema = new Schema<IWeightLog>(
  {
    telegramId: { type: Number, required: true, index: true },
    weight: { type: Number, required: true },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

// One weight log per user per day
WeightLogSchema.index({ telegramId: 1, date: 1 }, { unique: true });

// ─── Models ──────────────────────────────────────────

export const User: Model<IUser> = mongoose.model<IUser>("User", UserSchema);
export const Profile: Model<IProfile> = mongoose.model<IProfile>("Profile", ProfileSchema);
export const DailyLog: Model<IDailyLog> = mongoose.model<IDailyLog>("DailyLog", DailyLogSchema);
export const WeightLog: Model<IWeightLog> = mongoose.model<IWeightLog>("WeightLog", WeightLogSchema);
export const ActivityLog: Model<IActivityLog> = mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
