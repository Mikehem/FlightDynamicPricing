import { db } from "./db";
import { 
  sessions, buckets, reasoningLogs, pricingHistory, chatMessages, bookings,
  type Session, type Bucket, type ReasoningLog, type ChatMessage, type ScenarioDef, type Booking,
  type OrchestrationResult
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { OrchestratorAgent } from "./orchestrator";

// Generate booking reference code
function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'IND-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Initialize Gemini Client
// Supports both Replit AI Integrations and standalone .env configuration
const geminiApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "dummy";
const geminiBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

const ai = new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: geminiBaseUrl ? {
    apiVersion: "",
    baseUrl: geminiBaseUrl,
  } : undefined,
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

// Generate a demand forecast curve (typical S-curve for airline bookings)
// targetOccupancy is the final expected occupancy (0-100)
function generateDemandForecast(targetOccupancy: number): { day: number; expectedOccupancy: number }[] {
  const points = [];
  for (let day = 0; day <= 60; day += 5) {
    // S-curve: slow start, accelerate in middle, slow near end
    // Using logistic function adjusted for 60-day window
    const progress = day / 60;
    const sCurve = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
    const occupancy = Math.round(sCurve * targetOccupancy);
    points.push({ day, expectedOccupancy: occupancy });
  }
  return points;
}

// Get expected occupancy for a specific day from forecast
function getExpectedOccupancy(forecast: { day: number; expectedOccupancy: number }[], day: number): number {
  // Find the closest points and interpolate
  const before = forecast.filter(p => p.day <= day).pop() || forecast[0];
  const after = forecast.find(p => p.day > day) || forecast[forecast.length - 1];
  if (before.day === after.day) return before.expectedOccupancy;
  const ratio = (day - before.day) / (after.day - before.day);
  return Math.round(before.expectedOccupancy + ratio * (after.expectedOccupancy - before.expectedOccupancy));
}

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
      daysElapsed: 30,
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      demandForecast: generateDemandForecast(95), // High demand scenario
      expectedOccupancyToday: getExpectedOccupancy(generateDemandForecast(95), 30),
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
      daysElapsed: 15,
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      demandForecast: generateDemandForecast(75), // Medium demand
      expectedOccupancyToday: getExpectedOccupancy(generateDemandForecast(75), 15),
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
      daysElapsed: 0,
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      demandForecast: generateDemandForecast(65), // Low demand
      expectedOccupancyToday: 0, // Day 0, no bookings yet
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
    description: "Flight departing in 3 days with only 45% seats sold (below forecast of 85%). Sudden corporate booking interest detected. Balance between capturing last-minute premium demand and filling remaining inventory. We are 57 days into the 60-day booking window.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 3,
      daysElapsed: 57,
      currentDate: formatDate(0),
      departureDate: formatDate(60),
      demandForecast: generateDemandForecast(88), // Expected 88% but actual is 45%
      expectedOccupancyToday: getExpectedOccupancy(generateDemandForecast(88), 57),
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
  },
  // NEW SCENARIOS
  {
    id: "ipl-cancelled",
    name: "IPL Final Cancelled (Demand Collapse)",
    description: "The IPL Final has been cancelled due to unforeseen circumstances. Thousands of cricket fans are now cancelling their travel plans. Demand has crashed overnight. Most competitors are slashing prices. We are 25 days into the booking window with 55% seats already sold at premium prices.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 35,
      daysElapsed: 25,
      currentDate: formatDate(0),
      departureDate: formatDate(35),
      demandForecast: generateDemandForecast(40), // Collapsed demand
      expectedOccupancyToday: 55, // Was high before cancellation
      fuelCostIndex: 1.05,
      seasonalityIndex: 0.25, // Season impact gone
      baseDemand: 0.28, // Demand collapsed
      competitorAggressiveness: 0.95, // Everyone slashing prices
      competitors: [
        { name: "Akasa Air", basePrice: 8500 },
        { name: "Air India", basePrice: 9200 },
        { name: "Emirates", basePrice: 12000 }
      ],
      eventImpact: "IPL CANCELLED - Mass Cancellations Expected",
      weatherForecast: "Clear, 32°C",
      revenueTarget: 1200000,
      occupancyTarget: 55
    }
  },
  {
    id: "low-demand-5days",
    name: "Low Demand - 5 Days Out",
    description: "Flight departing in 5 days with only 35% seats sold. No special events, weak organic demand. Need aggressive seat allocation optimization to maximize revenue from remaining inventory. Economy buckets need attention.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 5,
      daysElapsed: 55,
      currentDate: formatDate(0),
      departureDate: formatDate(5),
      demandForecast: generateDemandForecast(60),
      expectedOccupancyToday: 75, // Should be 75% but only 35%
      fuelCostIndex: 1.0,
      seasonalityIndex: 0.4,
      baseDemand: 0.35,
      competitorAggressiveness: 0.75,
      competitors: [
        { name: "Akasa Air", basePrice: 11000 },
        { name: "Air India", basePrice: 12500 },
        { name: "Emirates", basePrice: 16000 }
      ],
      eventImpact: null,
      weatherForecast: "Partly cloudy, 30°C",
      revenueTarget: 1600000,
      occupancyTarget: 70
    }
  },
  {
    id: "severe-weather",
    name: "Severe Weather Warning",
    description: "Severe sandstorm warning issued for Dubai. Weather forecasts predict possible flight delays or diversions. Some passengers are nervous and may not book. Competitors are maintaining prices but seeing lower conversions. 40 days to departure.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 40,
      daysElapsed: 20,
      currentDate: formatDate(0),
      departureDate: formatDate(40),
      demandForecast: generateDemandForecast(55), // Reduced due to weather concerns
      expectedOccupancyToday: 20,
      fuelCostIndex: 1.0,
      seasonalityIndex: 0.5,
      baseDemand: 0.42,
      competitorAggressiveness: 0.5,
      competitors: [
        { name: "Akasa Air", basePrice: 11500 },
        { name: "Air India", basePrice: 13000 },
        { name: "Emirates", basePrice: 16500 }
      ],
      eventImpact: "WEATHER ALERT: Severe Sandstorm Warning for Dubai",
      weatherForecast: "⚠️ Sandstorm warning, visibility may be low",
      revenueTarget: 1400000,
      occupancyTarget: 55
    }
  },
  {
    id: "competitor-price-war",
    name: "Competitor Price War",
    description: "Akasa Air just launched a flash sale with 40% off on BLR-DXB route. Air India is matching the discount. Emirates holding firm on premium pricing. We need to decide: match discounts, hold prices, or find a middle ground. 45 days to departure.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 45,
      daysElapsed: 15,
      currentDate: formatDate(0),
      departureDate: formatDate(45),
      demandForecast: generateDemandForecast(72),
      expectedOccupancyToday: 12,
      fuelCostIndex: 1.0,
      seasonalityIndex: 0.6,
      baseDemand: 0.65,
      competitorAggressiveness: 0.98, // Extremely aggressive
      competitors: [
        { name: "Akasa Air", basePrice: 7200 }, // 40% off
        { name: "Air India", basePrice: 7800 }, // Matching
        { name: "Emirates", basePrice: 17500 } // Holding firm
      ],
      eventImpact: "COMPETITOR ALERT: Akasa Flash Sale -40%",
      weatherForecast: "Clear, 28°C",
      revenueTarget: 1800000,
      occupancyTarget: 72
    }
  },
  {
    id: "expo-dubai",
    name: "Dubai Expo Event",
    description: "Major technology expo happening in Dubai. Business travelers are booking premium seats. Economy demand is moderate but Business class is seeing unprecedented interest. 20 days to departure.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 20,
      daysElapsed: 40,
      currentDate: formatDate(0),
      departureDate: formatDate(20),
      demandForecast: generateDemandForecast(88),
      expectedOccupancyToday: 65,
      fuelCostIndex: 1.08,
      seasonalityIndex: 0.78,
      baseDemand: 0.82,
      competitorAggressiveness: 0.55, // Less aggressive, demand is high
      competitors: [
        { name: "Akasa Air", basePrice: 14500 },
        { name: "Air India", basePrice: 16800 },
        { name: "Emirates", basePrice: 22000 }
      ],
      eventImpact: "Dubai Tech Expo - High Business Travel Demand",
      weatherForecast: "Sunny, 35°C",
      revenueTarget: 2600000,
      occupancyTarget: 90
    }
  },
  {
    id: "ramadan-travel",
    name: "Ramadan Travel Season",
    description: "Ramadan period with mixed travel patterns. Some travelers heading to Dubai for religious observance while leisure travel is subdued. Unique demand curve with specific peaks. 50 days to departure.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 50,
      daysElapsed: 10,
      currentDate: formatDate(0),
      departureDate: formatDate(50),
      demandForecast: generateDemandForecast(70),
      expectedOccupancyToday: 8,
      fuelCostIndex: 1.02,
      seasonalityIndex: 0.65,
      baseDemand: 0.58,
      competitorAggressiveness: 0.6,
      competitors: [
        { name: "Akasa Air", basePrice: 10800 },
        { name: "Air India", basePrice: 12200 },
        { name: "Emirates", basePrice: 15500 }
      ],
      eventImpact: "Ramadan Season - Religious Travel Peak",
      weatherForecast: "Hot, 38°C",
      revenueTarget: 1900000,
      occupancyTarget: 70
    }
  },
  {
    id: "oil-price-drop",
    name: "Oil Price Crash",
    description: "Global oil prices have crashed 30% due to OPEC decisions. Fuel costs are down significantly. Competitors are slow to pass savings to customers. Opportunity to gain market share with competitive pricing or boost margins. 35 days to departure.",
    environment: {
      route: "BLR → DXB",
      airline: "Indigo",
      aircraft: "Airbus A321 Neo",
      totalSeats: 192,
      bookingWindow: 60,
      daysToDeparture: 35,
      daysElapsed: 25,
      currentDate: formatDate(0),
      departureDate: formatDate(35),
      demandForecast: generateDemandForecast(75),
      expectedOccupancyToday: 35,
      fuelCostIndex: 0.7, // Fuel 30% cheaper
      seasonalityIndex: 0.55,
      baseDemand: 0.62,
      competitorAggressiveness: 0.5, // Competitors slow to react
      competitors: [
        { name: "Akasa Air", basePrice: 12000 }, // Not yet discounted
        { name: "Air India", basePrice: 13500 },
        { name: "Emirates", basePrice: 17000 }
      ],
      eventImpact: "Oil Price Crash -30%: Cost Advantage",
      weatherForecast: "Clear, 30°C",
      revenueTarget: 2000000,
      occupancyTarget: 78
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
  logReasoning(sessionId: number, agent: string, decision: string, reasoning: string, metadata?: Record<string, unknown>): Promise<void>;
  
  // Agent Logic (A2A Orchestration Pattern)
  runOrchestration(sessionId: number): Promise<OrchestrationResult | null>;
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
    const env = scenario.environment;
    
    // Calculate initial seats sold based on days elapsed
    // Use expectedOccupancyToday but add some variance to make it interesting
    const totalSeats = 192;
    const expectedOccupancy = env.expectedOccupancyToday || 0;
    // Add -10 to +5% variance for interesting scenarios
    const variance = (Math.random() * 15 - 10); // -10% to +5%
    const actualOccupancy = Math.max(0, Math.min(100, expectedOccupancy + variance));
    const seatsSold = Math.round((actualOccupancy / 100) * totalSeats);
    
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

    // Distribute pre-sold seats proportionally (cheaper buckets sell first)
    let remainingToSell = seatsSold;
    const bucketSales = [
      { code: "ECO_1", maxSold: 42 },
      { code: "ECO_2", maxSold: 42 },
      { code: "ECO_3", maxSold: 42 },
      { code: "ECO_4", maxSold: 42 },
      { code: "BUS_1", maxSold: 12 },
      { code: "BUS_2", maxSold: 12 },
    ];
    
    const soldPerBucket: Record<string, number> = {};
    for (const bs of bucketSales) {
      const toSell = Math.min(remainingToSell, bs.maxSold);
      soldPerBucket[bs.code] = toSell;
      remainingToSell -= toSell;
      if (remainingToSell <= 0) break;
    }

    let totalRevenue = 0;
    for (const b of initialBuckets) {
      const sold = soldPerBucket[b.code] || 0;
      totalRevenue += sold * b.price;
      await db.insert(buckets).values({
        sessionId: session.id,
        ...b,
        sold
      });
    }

    // Update session with initial revenue
    if (totalRevenue > 0) {
      await db.update(sessions).set({ totalRevenue }).where(eq(sessions.id, session.id));
    }

    const occupancyStatus = actualOccupancy < expectedOccupancy - 5 
      ? "BELOW forecast (need to stimulate demand)" 
      : actualOccupancy > expectedOccupancy + 5 
        ? "ABOVE forecast (opportunity to increase prices)"
        : "ON TRACK with forecast";

    await this.logReasoning(session.id, "System", "Initialization", 
      `Loaded scenario: ${scenario.name}. Day ${env.daysElapsed} of 60. Current occupancy: ${Math.round(actualOccupancy)}% (${seatsSold}/${totalSeats} seats). Expected: ${expectedOccupancy}%. Status: ${occupancyStatus}`);
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

  async clearLogs(sessionId: number): Promise<void> {
    await db.delete(reasoningLogs).where(eq(reasoningLogs.sessionId, sessionId));
  }

  async clearChat(sessionId: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
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

  async logReasoning(sessionId: number, agent: string, decision: string, reasoning: string, metadata?: Record<string, unknown>) {
    await db.insert(reasoningLogs).values({
      sessionId,
      agentName: agent,
      decision,
      reasoning,
      metadata: metadata ? JSON.stringify(metadata) : null
    });
  }

  // === AI AGENT ORCHESTRATION (A2A Pattern) ===
  async runOrchestration(sessionId: number): Promise<OrchestrationResult | null> {
    const session = await this.getCurrentSession();
    if (!session || session.id !== sessionId) return null;

    const currentBuckets = await this.getBuckets(sessionId);
    const scenario = SCENARIOS.find(s => s.id === session.scenarioId);
    
    if (!scenario) return null;

    const env = scenario.environment;
    
    // Create orchestrator with callback to log reasoning
    const orchestrator = new OrchestratorAgent(
      env,
      currentBuckets,
      async (agentName: string, decision: string, reasoning: string, metadata: Record<string, unknown>) => {
        await this.logReasoning(sessionId, agentName, decision, reasoning, metadata);
      }
    );

    // Run the orchestration - the orchestrator will dynamically generate a plan
    // and execute sub-agents based on that plan
    const result = await orchestrator.orchestrate();

    // Apply pricing changes based on orchestration result
    const pricingResult = result.results.find(r => r.agentType === 'pricing');
    if (pricingResult?.success) {
      const multiplier = (pricingResult.output as { multiplier?: number })?.multiplier || 1.0;
      const clampedMultiplier = Math.max(0.80, Math.min(1.20, multiplier));
      
      // Apply multiplier to all buckets and calculate new revenue
      let newTotalRevenue = 0;
      
      for (const bucket of currentBuckets) {
        let bucketMultiplier = clampedMultiplier;
        if (bucket.class === "BUSINESS") {
          bucketMultiplier = Math.min(1.25, clampedMultiplier * 1.05);
        }
        const newPrice = Math.round(bucket.basePrice * bucketMultiplier);
        await db.update(buckets)
          .set({ price: newPrice })
          .where(eq(buckets.id, bucket.id));
        
        // Calculate revenue from sold seats at new price
        newTotalRevenue += newPrice * (bucket.sold || 0);
      }
      
      // Update session with recalculated revenue and load factor
      const totalSeats = currentBuckets.reduce((sum, b) => sum + b.allocated, 0);
      const soldSeats = currentBuckets.reduce((sum, b) => sum + (b.sold || 0), 0);
      const loadFactor = totalSeats > 0 ? Math.round((soldSeats / totalSeats) * 100) : 0;
      
      await db.update(sessions)
        .set({ 
          totalRevenue: newTotalRevenue,
          loadFactor: loadFactor
        })
        .where(eq(sessions.id, sessionId));
    }

    return result;
  }

  async processChatMessage(sessionId: number, message: string): Promise<string> {
    await db.insert(chatMessages).values({ sessionId, role: "user", content: message });
    
    const session = await this.getCurrentSession();
    if (!session) {
      const errorMsg = "No active session. Please load a scenario first.";
      await db.insert(chatMessages).values({ sessionId, role: "assistant", content: errorMsg });
      return errorMsg;
    }
    
    // Run orchestration automatically to get dynamic pricing based on current environment
    // This ensures prices are always up-to-date when users inquire about bookings
    try {
      await this.runOrchestration(sessionId);
    } catch (e) {
      console.error("Orchestration error during chat:", e);
      // Continue with existing prices if orchestration fails
    }
    
    // Get updated buckets after orchestration
    const currentBuckets = await this.getBuckets(sessionId);
    
    // Get conversation history for context
    const history = await this.getChatHistory(sessionId);
    const recentHistory = history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
    
    // Build bucket info with availability
    const bucketInfo = currentBuckets.map(b => ({
      code: b.code,
      class: b.class,
      price: b.price,
      available: b.allocated - (b.sold || 0),
      id: b.id
    }));
    
    // Enhanced Booking Agent prompt with structured flow
    const prompt = `
      You are an Airline Booking Assistant for Indigo flight BLR-DXB (Bangalore to Dubai).
      
      FLIGHT DETAILS:
      - Route: BLR → DXB (Bangalore to Dubai)
      - Airline: Indigo
      - Departure: ${session.departureDate ? new Date(session.departureDate).toLocaleDateString() : 'TBD'}
      
      AVAILABLE SEATS & PRICING:
      ${bucketInfo.map(b => `${b.code} (${b.class}): ₹${b.price?.toLocaleString()} - ${b.available} seats available`).join('\n')}
      
      CONVERSATION HISTORY:
      ${recentHistory}
      
      USER MESSAGE: "${message}"
      
      INSTRUCTIONS:
      1. If user wants to BOOK a flight, guide them through:
         - Ask for class preference (Economy or Business) if not specified
         - Ask for number of passengers (1-4) if not specified
         - Show price summary and ask for confirmation
         - If user CONFIRMS (says yes, confirm, book it, proceed, etc.), respond with EXACTLY this JSON format:
           {"action": "COMPLETE_BOOKING", "bucketCode": "ECO_1", "passengers": 1, "passengerName": "Guest"}
      
      2. If user is asking questions about pricing, availability, or flight details, answer helpfully.
      
      3. Be concise, friendly, and professional. Use ₹ for prices.
      
      4. IMPORTANT: When user confirms a booking, you MUST respond with the JSON action format above.
         Look for confirmation words like: yes, confirm, book, proceed, go ahead, do it, okay, sure
      
      Respond naturally but include the JSON action when booking is confirmed.
    `;

    let responseText = "I'm having trouble connecting to the reservation system. Please try again.";
    try {
      const stream = await ai.models.generateContentStream({ model, contents: [{ role: "user", parts: [{ text: prompt }] }] });
      let text = "";
      for await (const chunk of stream) {
        text += chunk.text || "";
      }
      responseText = text;
      
      // Check if response contains booking action
      const actionMatch = responseText.match(/\{"action"\s*:\s*"COMPLETE_BOOKING"[^}]+\}/);
      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[0]);
          if (action.action === "COMPLETE_BOOKING") {
            // Find the bucket
            const bucket = currentBuckets.find(b => b.code === action.bucketCode);
            if (bucket) {
              const passengers = action.passengers || 1;
              const available = bucket.allocated - (bucket.sold || 0);
              
              if (available >= passengers) {
                // Complete the booking
                const referenceCode = generateBookingReference();
                const pricePerSeat = bucket.price || 0;
                const basePrice = bucket.basePrice || pricePerSeat;
                const totalFare = pricePerSeat * passengers;
                const priceChange = ((pricePerSeat - basePrice) / basePrice) * 100;
                
                // Get most recent pricing reasoning for this bucket
                const recentLogs = await db.select()
                  .from(reasoningLogs)
                  .where(eq(reasoningLogs.sessionId, sessionId))
                  .orderBy(desc(reasoningLogs.timestamp))
                  .limit(10);
                
                const pricingLog = recentLogs.find(log => 
                  log.agentName === "Pricing Agent" && 
                  log.decision?.includes(bucket.code)
                );
                
                // Extract pricing factors from metadata if available
                let pricingReasoning = "Dynamic pricing applied based on current market conditions.";
                if (pricingLog?.metadata) {
                  const meta = pricingLog.metadata as Record<string, unknown>;
                  if (meta.multipliers) {
                    const multipliers = meta.multipliers as Record<string, number>;
                    const factors = Object.entries(multipliers)
                      .filter(([_, v]) => v !== 1.0)
                      .map(([k, v]) => `${k}: ${v > 1 ? '+' : ''}${((v - 1) * 100).toFixed(0)}%`)
                      .join(', ');
                    if (factors) {
                      pricingReasoning = `Price adjusted for: ${factors}`;
                    }
                  }
                }
                
                // Insert booking record
                await db.insert(bookings).values({
                  sessionId,
                  bucketId: bucket.id,
                  referenceCode,
                  passengerCount: passengers,
                  pricePerSeat,
                  totalFare,
                  passengerName: action.passengerName || "Guest",
                  status: "CONFIRMED"
                });
                
                // Update bucket sold count
                await db.update(buckets)
                  .set({ sold: (bucket.sold || 0) + passengers })
                  .where(eq(buckets.id, bucket.id));
                
                // Update session revenue
                await db.update(sessions)
                  .set({ totalRevenue: (session.totalRevenue || 0) + totalFare })
                  .where(eq(sessions.id, sessionId));
                
                // Log to agent reasoning with detailed breakdown
                const logReasoning = `
Booking completed successfully.

**Passenger Details:**
- Passengers: ${passengers}
- Class: ${bucket.class} (${bucket.code})

**Fare Breakdown:**
- Base fare: ₹${basePrice.toLocaleString()} per seat
- Dynamic price: ₹${pricePerSeat.toLocaleString()} per seat (${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(1)}%)
- Subtotal: ₹${pricePerSeat.toLocaleString()} × ${passengers} = ₹${totalFare.toLocaleString()}

**Pricing Reasoning:**
${pricingReasoning}

**Reference:** ${referenceCode}
                `.trim();
                
                await this.logReasoning(sessionId, "Booking Agent", 
                  `Booking Confirmed: ${referenceCode}`,
                  logReasoning
                );
                
                // Generate formatted confirmation message
                const priceIndicator = priceChange > 0 
                  ? `(+${priceChange.toFixed(0)}% from base)` 
                  : priceChange < 0 
                    ? `(${priceChange.toFixed(0)}% from base)` 
                    : '(base rate)';
                
                responseText = `
**Booking Confirmed**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Reference:** ${referenceCode}

**Flight**
BLR → DXB • Indigo
${session.departureDate ? new Date(session.departureDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}

**Passengers:** ${passengers}
**Class:** ${bucket.class}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Fare Summary**

Base fare: ₹${basePrice.toLocaleString()}
Dynamic rate: ₹${pricePerSeat.toLocaleString()} ${priceIndicator}
${passengers > 1 ? `× ${passengers} passengers\n` : ''}
**Total: ₹${totalFare.toLocaleString()}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Why this price?**
${pricingReasoning}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your booking is confirmed. Have a great flight!
                `.trim();
              } else {
                responseText = `Sorry, only ${available} seat(s) available in ${bucket.code}. Please choose fewer passengers or a different fare class.`;
              }
            }
          }
        } catch (e) {
          console.error("Booking action parse error:", e);
        }
      }
    } catch (e) {
      console.error("Chat Error", e);
    }

    await db.insert(chatMessages).values({ sessionId, role: "assistant", content: responseText });
    return responseText;
  }
}

export const storage = new DatabaseStorage();
