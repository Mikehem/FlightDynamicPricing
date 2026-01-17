import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === SCENARIO & SESSION ===
// We simulate a single active session for simplicity, but schema allows for multiple
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  scenarioId: text("scenario_id").notNull(), // e.g., 'ipl-season', 'fuel-spike'
  currentDate: timestamp("current_date").notNull(), // Simulated date
  departureDate: timestamp("departure_date").notNull(),
  totalRevenue: real("total_revenue").default(0),
  loadFactor: real("load_factor").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SEATS & BUCKETS ===
export const buckets = pgTable("buckets", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  code: text("code").notNull(), // ECO_1, BUS_1
  class: text("class").notNull(), // ECONOMY, BUSINESS
  allocated: integer("allocated").notNull(), // Number of seats allocated
  sold: integer("sold").default(0),
  price: real("price").notNull(), // Current price
  basePrice: real("base_price").notNull(),
});

// === LOGGING & AGENTS ===
export const reasoningLogs = pgTable("reasoning_logs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  agentName: text("agent_name").notNull(), // 'Orchestrator', 'Pricing', 'Forecast'
  decision: text("decision").notNull(),
  reasoning: text("reasoning").notNull(), // The 'why'
  metadata: jsonb("metadata"), // Inputs/Outputs
  timestamp: timestamp("timestamp").defaultNow(),
});

export const pricingHistory = pgTable("pricing_history", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  bucketCode: text("bucket_code").notNull(),
  price: real("price").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// === CHAT (Reusing structure but linked to session) ===
// We can link the chat tables from shared/models/chat.ts if needed, 
// or define session-specific chat here. Let's use a simple session-chat table.
export const chatMessages = pgTable("session_chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  role: text("role").notNull(), // 'user', 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});


// === RELATIONS ===
export const sessionRelations = relations(sessions, ({ many }) => ({
  buckets: many(buckets),
  logs: many(reasoningLogs),
  history: many(pricingHistory),
  chat: many(chatMessages),
}));

export const bucketRelations = relations(buckets, ({ one }) => ({
  session: one(sessions, {
    fields: [buckets.sessionId],
    references: [sessions.id],
  }),
}));

// === ZOD SCHEMAS ===
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertBucketSchema = createInsertSchema(buckets).omit({ id: true });
export const insertLogSchema = createInsertSchema(reasoningLogs).omit({ id: true, timestamp: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, timestamp: true });

// === EXPLICIT TYPES ===
export type Session = typeof sessions.$inferSelect;
export type Bucket = typeof buckets.$inferSelect;
export type ReasoningLog = typeof reasoningLogs.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Scenario definition type (not in DB, just logic)
export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  baseParams: {
    daysToDeparture: number;
    fuelCostIndex: number; // 1.0 is normal
    competitorAggressiveness: number; // 0-1
    baseDemand: number; // 0-1
    eventImpact: string | null; // e.g., 'IPL Match'
  };
}

export interface SimulationState {
  session: Session;
  buckets: Bucket[];
  logs: ReasoningLog[];
  recentHistory: typeof pricingHistory.$inferSelect[];
}
