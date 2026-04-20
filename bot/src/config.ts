import dotenv from "dotenv";
import path from "path";
dotenv.config();

interface Config {
  botToken: string;
  mongodbUri: string;
  geminiApiKey: string;
  nodeEnv: string;
}

function getConfig(): Config {
  const botToken = process.env.BOT_TOKEN;
  const mongodbUri = process.env.MONGODB_URI;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!botToken) {
    throw new Error("BOT_TOKEN is required. Get one from @BotFather on Telegram.");
  }
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is required. Get one from MongoDB Atlas.");
  }
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required. Get one from Google AI Studio.");
  }

  return {
    botToken,
    mongodbUri,
    geminiApiKey,
    nodeEnv: process.env.NODE_ENV || "development",
  };
}

export const config = getConfig();
