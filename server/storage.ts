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
      Event: ${scenario.environment.eventImpact || "None"}.
      Current Sales: ${JSON.stringify(currentBuckets.map(b => ({ code: b.code, sold: b.sold, price: b.price })))}
      
      Analyze demand. Return JSON: { "demandScore": number (0-1), "reasoning": "string" }
    `;
    
    let forecast = { demandScore: 0.5, reasoning: "Default forecast" };
    try {
      const stream = await ai.models.generateContentStream({ model, contents: [{ role: "user", parts: [{ text: forecastPrompt }] }] });
      let text = "";
      for await (const chunk of stream) {
        text += chunk.text || "";
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) forecast = JSON.parse(jsonMatch[0]);
      await this.logReasoning(sessionId, "Forecast Agent", `Demand Score: ${forecast.demandScore}`, forecast.reasoning);
    } catch (e) {
      console.error("Forecast Error", e);
    }

    // 2. PRICING AGENT - Feature-based multipliers
    const env = scenario.environment;
    const totalSeats = 192;
    const soldSeats = currentBuckets.reduce((sum, b) => sum + (b.sold || 0), 0);
    const currentOccupancy = Math.round((soldSeats / totalSeats) * 100);
    const daysLeft = env.daysToDeparture;
    
    // Calculate current revenue
    const currentRevenue = currentBuckets.reduce((sum, b) => sum + (b.sold || 0) * b.price, 0);
    const revenueTarget = env.revenueTarget || 2000000;
    const occupancyTarget = env.occupancyTarget || 80;
    
    // Determine optimization strategy based on current performance
    const revenueProgress = (currentRevenue / revenueTarget) * 100;
    const occupancyProgress = currentOccupancy;
    
    const pricingPrompt = `
      You are a Feature-Based Dynamic Pricing Agent for airline tickets.
      
      CONTEXT:
      - Scenario: ${scenario.name}
      - Days to departure: ${daysLeft} (of 60-day window)
      - Current occupancy: ${currentOccupancy}% (${soldSeats}/${totalSeats} seats)
      - Expected occupancy: ${env.expectedOccupancyToday}%
      - Target occupancy: ${occupancyTarget}%
      - Demand score: ${forecast.demandScore} (0-1 scale)
      - Fuel cost index: ${env.fuelCostIndex} (1.0 = normal)
      - Seasonality index: ${env.seasonalityIndex} (higher = peak season)
      - Competition: ${JSON.stringify(env.competitors)}
      - Event: ${env.eventImpact || "None"}
      
      REVENUE METRICS:
      - Current revenue: ₹${currentRevenue.toLocaleString()}
      - Revenue target: ₹${revenueTarget.toLocaleString()}
      - Revenue progress: ${revenueProgress.toFixed(1)}%
      
      TASK: 
      1. Choose an OPTIMIZATION STRATEGY: Either "REVENUE_MAXIMIZATION" or "SEAT_FILL_RATE"
         - Use REVENUE_MAXIMIZATION when demand is high and you can charge premium prices
         - Use SEAT_FILL_RATE when occupancy is lagging and you need to fill seats
      2. Predict MULTIPLIERS for each pricing feature
      
      CONSTRAINT: Final combined multiplier should be between 0.80 and 1.20 (±20% max change).
      
      Return JSON with this EXACT structure:
      {
        "strategy": "REVENUE_MAXIMIZATION or SEAT_FILL_RATE",
        "strategyReason": "Why this strategy was chosen",
        "multipliers": {
          "demand": { "value": 1.05, "reason": "Brief explanation" },
          "urgency": { "value": 1.02, "reason": "Brief explanation" },
          "competition": { "value": 0.98, "reason": "Brief explanation" },
          "fuel": { "value": 1.03, "reason": "Brief explanation" },
          "seasonality": { "value": 1.02, "reason": "Brief explanation" }
        },
        "summary": "Overall pricing strategy explanation"
      }
    `;

    try {
      const stream = await ai.models.generateContentStream({ model, contents: [{ role: "user", parts: [{ text: pricingPrompt }] }] });
      let text = "";
      for await (const chunk of stream) {
        text += chunk.text || "";
      }
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Pricing Agent: No JSON found in response");
        return;
      }
      
      let result;
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("Pricing Agent: Failed to parse JSON", parseError);
        return;
      }
      
      // Default multiplier structure with fallbacks
      const defaultMultiplier = { value: 1.0, reason: "No adjustment" };
      const multipliers = {
        demand: result.multipliers?.demand || defaultMultiplier,
        urgency: result.multipliers?.urgency || defaultMultiplier,
        competition: result.multipliers?.competition || defaultMultiplier,
        fuel: result.multipliers?.fuel || defaultMultiplier,
        seasonality: result.multipliers?.seasonality || defaultMultiplier,
      };
      
      // Validate multiplier values are numbers
      for (const [key, val] of Object.entries(multipliers)) {
        if (typeof val.value !== 'number' || isNaN(val.value)) {
          multipliers[key as keyof typeof multipliers] = defaultMultiplier;
        }
      }
      
      // Calculate combined multiplier (product of all feature multipliers)
      const combinedMultiplier = 
        multipliers.demand.value *
        multipliers.urgency.value *
        multipliers.competition.value *
        multipliers.fuel.value *
        multipliers.seasonality.value;
      
      // Clamp to ±20% max change
      const clampedMultiplier = Math.max(0.80, Math.min(1.20, combinedMultiplier));
      
      // Extract strategy from AI response
      const strategy = result.strategy === "SEAT_FILL_RATE" ? "SEAT_FILL_RATE" : "REVENUE_MAXIMIZATION";
      const strategyReason = result.strategyReason || "Optimizing based on current market conditions";
      
      // Calculate projected values after price change
      // Projected revenue = current revenue + (unsold seats * avg new price * estimated conversion rate)
      const avgNewPrice = currentBuckets.reduce((sum, b) => sum + b.basePrice * clampedMultiplier, 0) / currentBuckets.length;
      const unsoldSeats = totalSeats - soldSeats;
      const conversionRate = strategy === "SEAT_FILL_RATE" ? 0.7 : 0.5; // Higher conversion when focusing on filling seats
      const projectedAdditionalRevenue = Math.round(unsoldSeats * avgNewPrice * conversionRate * 0.6);
      const projectedRevenue = currentRevenue + projectedAdditionalRevenue;
      
      // Projected occupancy based on strategy
      const projectedOccupancy = Math.min(100, Math.round(currentOccupancy + (unsoldSeats * conversionRate * 0.6 / totalSeats) * 100));
      
      // Build detailed reasoning with multiplier breakdown
      const multiplierBreakdown = Object.entries(multipliers)
        .map(([feature, data]) => `• ${feature.charAt(0).toUpperCase() + feature.slice(1)}: ${data.value}x - ${data.reason}`)
        .join('\n');
      
      const strategyLabel = strategy === "REVENUE_MAXIMIZATION" ? "Revenue Maximization" : "Seat Fill Rate";
      const fullReasoning = `Optimization: ${strategyLabel}\n${strategyReason}\n\nCombined Multiplier: ${clampedMultiplier.toFixed(3)}x\n\n${multiplierBreakdown}\n\nStrategy: ${result.summary || "Optimizing prices based on current market conditions."}`;
      
      // Build comprehensive metadata with strategy and metrics
      const metadata = {
        ...multipliers,
        optimization: {
          strategy,
          strategyReason,
          metrics: {
            revenue: {
              current: currentRevenue,
              projected: projectedRevenue,
              target: revenueTarget,
              change: projectedRevenue - currentRevenue,
              changePercent: currentRevenue > 0 ? Math.round(((projectedRevenue - currentRevenue) / currentRevenue) * 100) : 0
            },
            occupancy: {
              current: currentOccupancy,
              projected: projectedOccupancy,
              target: occupancyTarget,
              change: projectedOccupancy - currentOccupancy,
              changePercent: currentOccupancy > 0 ? Math.round(((projectedOccupancy - currentOccupancy) / currentOccupancy) * 100) : 0
            }
          }
        }
      };
      
      // Store multipliers in metadata for frontend display
      await db.insert(reasoningLogs).values({
        sessionId,
        agentName: "Pricing Agent",
        decision: `${strategyLabel} | Multiplier: ${clampedMultiplier.toFixed(2)}x`,
        reasoning: fullReasoning,
        metadata: JSON.stringify(metadata)
      });
      
      // Apply multiplier to all buckets with class-based scaling
      // Economy gets base multiplier, Business gets slightly higher adjustment
      for (const bucket of currentBuckets) {
        let bucketMultiplier = clampedMultiplier;
        if (bucket.class === "BUSINESS") {
          // Business class is more price-inelastic, apply slightly higher multiplier
          bucketMultiplier = Math.min(1.25, clampedMultiplier * 1.05);
        }
        const newPrice = Math.round(bucket.basePrice * bucketMultiplier);
        await db.update(buckets)
          .set({ price: newPrice })
          .where(eq(buckets.id, bucket.id));
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
      const stream = await ai.models.generateContentStream({ model, contents: [{ role: "user", parts: [{ text: prompt }] }] });
      let text = "";
      for await (const chunk of stream) {
        text += chunk.text || "";
      }
      responseText = text;
    } catch (e) {
      console.error("Chat Error", e);
    }

    await db.insert(chatMessages).values({ sessionId, role: "assistant", content: responseText });
    return responseText;
  }
}

export const storage = new DatabaseStorage();
