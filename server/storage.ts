import { db } from "./db";
import { 
  sessions, buckets, reasoningLogs, pricingHistory, chatMessages,
  type Session, type Bucket, type ReasoningLog, type ChatMessage, type ScenarioDef
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "dummy",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});
const model = "gemini-2.5-flash"; // Fast model for agents

// Helper to compute dates
function formatDate(daysFromNow: number): string {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

// === SCENARIO DEFINITIONS ===
// All flights operate on a 60-day booking window
const BOOKING_WINDOW_DAYS = 60;

const SCENARIOS: ScenarioDef[] = [
  {
    id: "ipl-season",
    name: "IPL Season Final (High Demand)",
    description: "Bangalore to Dubai during IPL Final week. Cricket fans are traveling in droves to watch the match. Expect extremely high demand across all fare classes, especially premium economy and business. Competitors are already raising prices. We are 30 days into the 60-day booking window.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 30,
      daysElapsed: 30, // 30 days into 60-day window
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      fuelCostIndex: 1.1,
      seasonalityIndex: 0.85,
      baseDemand: 0.92,
      competitorAggressiveness: 0.8,
      competitors: [
        { name: "Akasa Air", basePrice: 13500 },
        { name: "Air India", basePrice: 15200 },
        { name: "Emirates", basePrice: 18500 }
      ],
      eventImpact: "IPL Final Match - High Demand",
      weatherForecast: "Clear skies, 34°C in Dubai",
      revenueTarget: 2850000,
      occupancyTarget: 95
    }
  },
  {
    id: "fuel-spike",
    name: "Global Fuel Crisis",
    description: "Sudden spike in Aviation Turbine Fuel (ATF) prices due to geopolitical tensions. Operating costs are up 40%. Competitors are hesitant to raise prices fearing demand destruction. Strategic pricing required to maintain margins. We are 15 days into the 60-day booking window.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 45,
      daysElapsed: 15, // 15 days into 60-day window
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      fuelCostIndex: 1.4,
      seasonalityIndex: 0.55,
      baseDemand: 0.58,
      competitorAggressiveness: 0.4,
      competitors: [
        { name: "Akasa Air", basePrice: 11800 },
        { name: "Air India", basePrice: 13000 },
        { name: "Emirates", basePrice: 16200 }
      ],
      eventImpact: "Fuel Price Surge (+40%)",
      weatherForecast: "Partly cloudy, 28°C",
      revenueTarget: 2200000,
      occupancyTarget: 75
    }
  },
  {
    id: "lean-season",
    name: "Mid-Week Lean Season",
    description: "Standard Tuesday departure in off-peak season. Low natural demand. Competitors are aggressively discounting to fill seats. Focus on maximizing load factor while protecting yield. Booking window just opened - 60 days to departure.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 60,
      daysElapsed: 0, // Window just opened
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      fuelCostIndex: 1.0,
      seasonalityIndex: 0.35,
      baseDemand: 0.38,
      competitorAggressiveness: 0.92,
      competitors: [
        { name: "Akasa Air", basePrice: 9500 },
        { name: "Air India", basePrice: 10200 },
        { name: "Emirates", basePrice: 14000 }
      ],
      eventImpact: null,
      weatherForecast: "Sunny, 32°C",
      revenueTarget: 1500000,
      occupancyTarget: 65
    }
  },
  {
    id: "last-minute",
    name: "Last Minute Rush",
    description: "Flight departing in 3 days with only 45% seats sold. Sudden corporate booking interest detected. Balance between capturing last-minute premium demand and filling remaining inventory. We are 57 days into the 60-day booking window.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 3,
      daysElapsed: 57, // 57 days into 60-day window
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      fuelCostIndex: 1.05,
      seasonalityIndex: 0.72,
      baseDemand: 0.78,
      competitorAggressiveness: 0.65,
      competitors: [
        { name: "Akasa Air", basePrice: 18500 },
        { name: "Air India", basePrice: 21000 },
        { name: "Emirates", basePrice: 28000 }
      ],
      eventImpact: "Corporate Conference in Dubai",
      weatherForecast: "Clear, 30°C",
      revenueTarget: 2400000,
      occupancyTarget: 88
    }
  }
];

export interface IStorage {
  // Scenario & Session
  getScenarios(): ScenarioDef[];
  createSession(scenarioId: string): Promise<Session>;
  getCurrentSession(): Promise<Session | undefined>;
  
  // State
  getBuckets(sessionId: number): Promise<Bucket[]>;
  getLogs(sessionId: number): Promise<ReasoningLog[]>;
  getChatHistory(sessionId: number): Promise<ChatMessage[]>;
  
  // Actions
  bookTicket(sessionId: number, bucketCode: string, quantity: number): Promise<boolean>;
  logReasoning(sessionId: number, agent: string, decision: string, reasoning: string): Promise<void>;
  
  // Agent Logic
  runOrchestration(sessionId: number): Promise<void>;
  processChatMessage(sessionId: number, message: string): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  getScenarios(): ScenarioDef[] {
    return SCENARIOS;
  }

  async getCurrentSession(): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.active, true)).orderBy(desc(sessions.id)).limit(1);
    return session;
  }

  async createSession(scenarioId: string): Promise<Session> {
    // Deactivate old sessions
    await db.update(sessions).set({ active: false });

    const scenario = SCENARIOS.find(s => s.id === scenarioId) || SCENARIOS[0];
    
    // Create new session
    const [session] = await db.insert(sessions).values({
      scenarioId,
      currentDate: new Date(),
      departureDate: new Date(Date.now() + scenario.environment.daysToDeparture * 24 * 60 * 60 * 1000),
      active: true
    }).returning();

    // Initialize Buckets (192 seats total)
    // Eco: 168 seats (4 buckets x 42)
    // Bus: 24 seats (2 buckets x 12)
    const initialBuckets = [
      { code: "ECO_1", class: "ECONOMY", allocated: 42, price: 12000, basePrice: 12000 },
      { code: "ECO_2", class: "ECONOMY", allocated: 42, price: 14000, basePrice: 14000 },
      { code: "ECO_3", class: "ECONOMY", allocated: 42, price: 16000, basePrice: 16000 },
      { code: "ECO_4", class: "ECONOMY", allocated: 42, price: 18000, basePrice: 18000 },
      { code: "BUS_1", class: "BUSINESS", allocated: 12, price: 28000, basePrice: 28000 },
      { code: "BUS_2", class: "BUSINESS", allocated: 12, price: 32000, basePrice: 32000 },
    ];

    for (const b of initialBuckets) {
      await db.insert(buckets).values({
        sessionId: session.id,
        ...b,
        sold: 0
      });
    }

    await this.logReasoning(session.id, "System", "Initialization", `Loaded scenario: ${scenario.name}`);
    return session;
  }

  async getBuckets(sessionId: number): Promise<Bucket[]> {
    return db.select().from(buckets).where(eq(buckets.sessionId, sessionId));
  }

  async getLogs(sessionId: number): Promise<ReasoningLog[]> {
    return db.select().from(reasoningLogs).where(eq(reasoningLogs.sessionId, sessionId)).orderBy(desc(reasoningLogs.timestamp));
  }

  async getChatHistory(sessionId: number): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.timestamp);
  }

  async bookTicket(sessionId: number, bucketCode: string, quantity: number): Promise<boolean> {
    const [bucket] = await db.select().from(buckets).where(eq(buckets.code, bucketCode)); // Should filter by session too strictly speaking, but code is unique per session usually if carefully managed. Better:
    // Actually code is NOT unique globally. Need session ID.
    const [targetBucket] = await db.select().from(buckets)
      .where(sql`${buckets.sessionId} = ${sessionId} AND ${buckets.code} = ${bucketCode}`);

    if (!targetBucket || (targetBucket.sold || 0) + quantity > targetBucket.allocated) {
      return false;
    }

    await db.update(buckets)
      .set({ sold: (targetBucket.sold || 0) + quantity })
      .where(eq(buckets.id, targetBucket.id));

    // Update revenue
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (session) {
      await db.update(sessions)
        .set({ totalRevenue: (session.totalRevenue || 0) + (targetBucket.price * quantity) })
        .where(eq(sessions.id, sessionId));
    }
    
    return true;
  }

  async logReasoning(sessionId: number, agent: string, decision: string, reasoning: string) {
    await db.insert(reasoningLogs).values({
      sessionId,
      agentName: agent,
      decision,
      reasoning
    });
  }

  // === AI AGENT ORCHESTRATION ===
  async runOrchestration(sessionId: number): Promise<void> {
    const session = await this.getCurrentSession();
    if (!session || session.id !== sessionId) return;

    const currentBuckets = await this.getBuckets(sessionId);
    const scenario = SCENARIOS.find(s => s.id === session.scenarioId);
    
    if (!scenario) return;

    // 1. FORECAST AGENT
    const forecastPrompt = `
      You are an Airline Demand Forecast Agent.
      Scenario: ${scenario.name} (${scenario.description}).
      Event: ${scenario.baseParams.eventImpact || "None"}.
      Current Sales: ${JSON.stringify(currentBuckets.map(b => ({ code: b.code, sold: b.sold, price: b.price })))}
      
      Analyze demand. Return JSON: { "demandScore": number (0-1), "reasoning": "string" }
    `;
    
    let forecast = { demandScore: 0.5, reasoning: "Default forecast" };
    try {
      const resp = await ai.models.generateContent({ model, contents: [{ role: "user", parts: [{ text: forecastPrompt }] }] });
      const text = resp.response.text();
      // Simple parsing - assumes model follows instructions well. In prod, use structured output.
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) forecast = JSON.parse(jsonMatch[0]);
      await this.logReasoning(sessionId, "Forecast Agent", `Demand Score: ${forecast.demandScore}`, forecast.reasoning);
    } catch (e) {
      console.error("Forecast Error", e);
    }

    // 2. PRICING AGENT
    const pricingPrompt = `
      You are a Dynamic Pricing Agent.
      Scenario: ${scenario.name}.
      Demand Score: ${forecast.demandScore}.
      Current Buckets: ${JSON.stringify(currentBuckets.map(b => ({ code: b.code, price: b.price, base: b.basePrice })))}
      
      Decide new prices. Rule: Don't change price by more than 20% at once.
      Return JSON: { "updates": [{ "code": "ECO_1", "newPrice": 12500 }], "reasoning": "string" }
    `;

    try {
      const resp = await ai.models.generateContent({ model, contents: [{ role: "user", parts: [{ text: pricingPrompt }] }] });
      const text = resp.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        await this.logReasoning(sessionId, "Pricing Agent", "Price Update", result.reasoning);
        
        // Apply updates
        for (const update of result.updates) {
          await db.update(buckets)
            .set({ price: update.newPrice })
            .where(sql`${buckets.sessionId} = ${sessionId} AND ${buckets.code} = ${update.code}`);
        }
      }
    } catch (e) {
      console.error("Pricing Error", e);
    }
  }

  async processChatMessage(sessionId: number, message: string): Promise<string> {
    await db.insert(chatMessages).values({ sessionId, role: "user", content: message });
    
    const session = await this.getCurrentSession();
    const currentBuckets = await this.getBuckets(sessionId);
    
    // Booking Agent
    const prompt = `
      You are an Airline Booking Assistant for Indigo flight BLR-DXB.
      User says: "${message}"
      Current Prices: ${JSON.stringify(currentBuckets.map(b => `${b.code}: ₹${b.price} (${b.class})`))}
      
      Help the user book. Be concise and professional.
    `;

    let responseText = "I'm having trouble connecting to the reservation system.";
    try {
      const resp = await ai.models.generateContent({ model, contents: [{ role: "user", parts: [{ text: prompt }] }] });
      responseText = resp.response.text();
    } catch (e) {
      console.error("Chat Error", e);
    }

    await db.insert(chatMessages).values({ sessionId, role: "assistant", content: responseText });
    return responseText;
  }
}

export const storage = new DatabaseStorage();
