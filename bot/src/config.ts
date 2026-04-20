import dotenv from "dotenv";
import path from "path";
dotenv.config();

interface Config {
  botToken: string;
  mongodbUri: string;
  nodeEnv: string;
}

function getConfig(): Config {
  const botToken = process.env.BOT_TOKEN;
  const mongodbUri = process.env.MONGODB_URI;

  if (!botToken) {
    throw new Error("BOT_TOKEN is required. Get one from @BotFather on Telegram.");
  }
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is required. Get one from MongoDB Atlas.");
  }

  return {
    botToken,
    mongodbUri,
    nodeEnv: process.env.NODE_ENV || "development",
  };
}

export const config = getConfig();
