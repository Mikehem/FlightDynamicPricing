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
  metadata: jsonb("metadata"), // For tracking booking state
  timestamp: timestamp("timestamp").defaultNow(),
});

// === BOOKINGS ===
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  bucketId: integer("bucket_id").notNull(),
  referenceCode: text("reference_code").notNull(), // e.g., 'IND-BLR-DXB-ABC123'
  passengerCount: integer("passenger_count").notNull().default(1),
  pricePerSeat: real("price_per_seat").notNull(),
  totalFare: real("total_fare").notNull(),
  passengerName: text("passenger_name"),
  status: text("status").notNull().default("CONFIRMED"), // CONFIRMED, CANCELLED
  createdAt: timestamp("created_at").defaultNow(),
});


// === RELATIONS ===
export const sessionRelations = relations(sessions, ({ many }) => ({
  buckets: many(buckets),
  logs: many(reasoningLogs),
  history: many(pricingHistory),
  chat: many(chatMessages),
  bookings: many(bookings),
}));

export const bookingRelations = relations(bookings, ({ one }) => ({
  session: one(sessions, {
    fields: [bookings.sessionId],
    references: [sessions.id],
  }),
  bucket: one(buckets, {
    fields: [bookings.bucketId],
    references: [buckets.id],
  }),
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
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });

// === EXPLICIT TYPES ===
export type Session = typeof sessions.$inferSelect;
export type Bucket = typeof buckets.$inferSelect;
export type ReasoningLog = typeof reasoningLogs.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Booking = typeof bookings.$inferSelect;

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

// === A2A (Agent-to-Agent) COMMUNICATION PROTOCOL ===

// Available sub-agents that the orchestrator can invoke
export type SubAgentType = 
  | 'objective'      // Determines pricing objective
  | 'forecast'       // Analyzes demand patterns
  | 'pricing'        // Calculates price multipliers
  | 'seat_allocation'// Manages seat bucket allocation
  | 'competitor';    // Monitors competitor pricing

// A2A Message structure for inter-agent communication
export interface A2AMessage {
  id: string;
  from: string;           // Agent sending the message
  to: string;             // Target agent (or 'orchestrator')
  type: 'request' | 'response' | 'broadcast';
  action: string;         // What action is requested/performed
  payload: Record<string, unknown>;  // Data being passed
  timestamp: Date;
}

// Agent task definition for the orchestrator's plan
export interface AgentTask {
  agentType: SubAgentType;
  priority: number;       // Execution order (1 = highest)
  reason: string;         // Why this agent is needed
  dependsOn: SubAgentType[]; // Which agents must complete first
  inputContext: string[];    // What data this agent needs
}

// Orchestrator's execution plan
export interface OrchestratorPlan {
  planId: string;
  objective: string;      // High-level goal of this orchestration
  strategy: string;       // Overall approach (e.g., 'aggressive', 'conservative')
  tasks: AgentTask[];     // Ordered list of agent tasks
  reasoning: string;      // Why this plan was chosen
  estimatedImpact: string; // Expected outcome
}

// Result from a sub-agent after execution
export interface SubAgentResult {
  agentType: SubAgentType;
  success: boolean;
  decision: string;
  reasoning: string;
  output: Record<string, unknown>;
  a2aMessages: A2AMessage[]; // Messages sent during execution
}

// Complete orchestration result with A2A trace
export interface OrchestrationResult {
  plan: OrchestratorPlan;
  results: SubAgentResult[];
  a2aTrace: A2AMessage[];   // Full message trace for transparency
  finalOutcome: {
    pricingApplied: boolean;
    allocationChanged: boolean;
    summary: string;
  };
}
