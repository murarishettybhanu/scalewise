import { type ConversationFlavor } from "@grammyjs/conversations";
import { Context, SessionFlavor } from "grammy";

// Session data (extend as needed in future phases)
interface SessionData {}

// Outer context type (with ConversationFlavor + Session installed for the middleware tree)
export type BotContext = Context & ConversationFlavor<Context> & SessionFlavor<SessionData>;
