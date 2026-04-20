import { type ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";

// Session data (extend as needed in future phases)
interface SessionData {}

// Outer context type (Simplified for Phase 2 stability)
export type BotContext = Context & 
  ConversationFlavor<Context> & 
  SessionFlavor<SessionData>;
