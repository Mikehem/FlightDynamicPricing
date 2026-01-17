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
// Demand forecast point for a specific day
export interface DemandForecastPoint {
  day: number; // Day in booking window (0-60)
  expectedOccupancy: number; // Expected cumulative occupancy % at this point
}

export interface ScenarioEnvironment {
  // Flight Details
  route: string;
  airline: string;
  aircraft: string;
  totalSeats: number;
  
  // Time Context (60-day booking window)
  bookingWindow: number; // Always 60 days
  daysToDeparture: number;
  daysElapsed: number; // How many days into the window
  currentDate: string;
  departureDate: string;
  
  // Demand Forecast - expected booking curve over 60 days
  demandForecast: DemandForecastPoint[];
  expectedOccupancyToday: number; // What % should be sold by now
  
  // Market Conditions
  fuelCostIndex: number; // 1.0 is normal, 1.4 means 40% higher
  seasonalityIndex: number; // 0-1
  baseDemand: number; // 0-1 forecast
  
  // Competition
  competitorAggressiveness: number; // 0-1
  competitors: { name: string; basePrice: number; }[];
  
  // Events & Weather
  eventImpact: string | null;
  weatherForecast: string;
  
  // Revenue Goals
  revenueTarget: number;
  occupancyTarget: number; // percentage
}

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  environment: ScenarioEnvironment;
}

export interface SimulationState {
  session: Session;
  buckets: Bucket[];
  logs: ReasoningLog[];
  recentHistory: typeof pricingHistory.$inferSelect[];
}
