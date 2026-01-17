import { GoogleGenAI } from "@google/genai";
import type { 
  ScenarioEnvironment, 
  Bucket, 
  OrchestratorPlan, 
  SubAgentResult, 
  A2AMessage,
  SubAgentType,
  OrchestrationResult,
  AgentTask
} from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
    apiVersion: ""
  }
});

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export class OrchestratorAgent {
  private a2aTrace: A2AMessage[] = [];
  private subAgentResults: Map<SubAgentType, SubAgentResult> = new Map();
  
  constructor(
    private environment: ScenarioEnvironment,
    private buckets: Bucket[],
    private onLog: (agentName: string, decision: string, reasoning: string, metadata: Record<string, unknown>) => Promise<void>
  ) {}

  async orchestrate(): Promise<OrchestrationResult> {
    this.a2aTrace = [];
    this.subAgentResults.clear();

    const plan = await this.generatePlan();
    
    await this.onLog(
      "Orchestrator Agent",
      `[PLAN] ${plan.strategy} | ${plan.tasks.length} agents`,
      plan.reasoning,
      { 
        planId: plan.planId,
        objective: plan.objective,
        tasks: plan.tasks.map(t => ({ agent: t.agentType, priority: t.priority, reason: t.reason }))
      }
    );

    const sortedTasks = [...plan.tasks].sort((a, b) => a.priority - b.priority);
    
    for (const task of sortedTasks) {
      const canExecute = task.dependsOn.every(dep => this.subAgentResults.has(dep));
      
      if (!canExecute) {
        console.warn(`Skipping ${task.agentType} - dependencies not met`);
        continue;
      }

      const result = await this.executeSubAgent(task);
      this.subAgentResults.set(task.agentType, result);
    }

    const finalOutcome = this.computeFinalOutcome();

    return {
      plan,
      results: Array.from(this.subAgentResults.values()),
      a2aTrace: this.a2aTrace,
      finalOutcome
    };
  }

  private async generatePlan(): Promise<OrchestratorPlan> {
    const currentOccupancy = this.buckets.reduce((sum, b) => sum + (b.sold || 0), 0) / 
                             this.buckets.reduce((sum, b) => sum + b.allocated, 0);
    
    const prompt = `You are the Orchestrator Agent for an airline dynamic pricing system.
Analyze the current situation and create an execution plan for the sub-agents.

CURRENT ENVIRONMENT:
- Route: ${this.environment.route}
- Days to Departure: ${this.environment.daysToDeparture}
- Current Occupancy: ${(currentOccupancy * 100).toFixed(1)}%
- Expected Occupancy: ${(this.environment.expectedOccupancyToday * 100).toFixed(1)}%
- Fuel Cost Index: ${this.environment.fuelCostIndex}
- Seasonality: ${this.environment.seasonalityIndex}
- Competitor Aggressiveness: ${this.environment.competitorAggressiveness}
- Event Impact: ${this.environment.eventImpact || 'None'}

AVAILABLE SUB-AGENTS:
1. objective - Determines the pricing objective (REVENUE_MAXIMIZATION, OCCUPANCY_MAXIMIZATION, COMPETITIVE_MATCHING)
2. forecast - Analyzes demand patterns and predicts booking velocity
3. pricing - Calculates price multipliers based on objectives and forecasts
4. seat_allocation - Manages seat bucket allocation and rebalancing
5. competitor - Monitors competitor pricing and market position

RESPOND WITH JSON ONLY:
{
  "objective": "High-level goal for this orchestration",
  "strategy": "AGGRESSIVE|BALANCED|CONSERVATIVE|DEFENSIVE",
  "reasoning": "Why this plan was chosen based on the situation",
  "estimatedImpact": "Expected outcome of executing this plan",
  "tasks": [
    {
      "agentType": "objective|forecast|pricing|seat_allocation|competitor",
      "priority": 1,
      "reason": "Why this agent is needed",
      "dependsOn": [],
      "inputContext": ["What data this agent needs"]
    }
  ]
}

PLANNING RULES:
- Always include objective agent first (priority 1) to set the strategy
- Forecast agent should run after objective (priority 2)
- Pricing agent depends on objective and forecast (priority 3)
- Seat allocation may run in parallel with pricing or after
- Competitor analysis can run in parallel with forecast
- Adapt the plan based on urgency (days to departure) and situation`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const text = response.text || "{}";
      const parsed = JSON.parse(text);
      
      return {
        planId: generatePlanId(),
        objective: parsed.objective || "Optimize pricing",
        strategy: parsed.strategy || "BALANCED",
        tasks: (parsed.tasks || []).map((t: Partial<AgentTask>) => ({
          agentType: t.agentType as SubAgentType,
          priority: t.priority || 1,
          reason: t.reason || "",
          dependsOn: t.dependsOn || [],
          inputContext: t.inputContext || []
        })),
        reasoning: parsed.reasoning || "Default balanced approach",
        estimatedImpact: parsed.estimatedImpact || "Standard optimization"
      };
    } catch (e) {
      console.error("Plan generation error:", e);
      return this.getDefaultPlan();
    }
  }

  private getDefaultPlan(): OrchestratorPlan {
    return {
      planId: generatePlanId(),
      objective: "Standard pricing optimization",
      strategy: "BALANCED",
      reasoning: "Fallback plan due to planning error - executing all agents in standard order",
      estimatedImpact: "Standard pricing adjustments",
      tasks: [
        { agentType: 'objective', priority: 1, reason: "Set pricing strategy", dependsOn: [], inputContext: ["environment"] },
        { agentType: 'forecast', priority: 2, reason: "Analyze demand", dependsOn: ['objective'], inputContext: ["environment", "objective"] },
        { agentType: 'competitor', priority: 2, reason: "Check competition", dependsOn: [], inputContext: ["environment"] },
        { agentType: 'pricing', priority: 3, reason: "Calculate prices", dependsOn: ['objective', 'forecast'], inputContext: ["objective", "forecast"] },
        { agentType: 'seat_allocation', priority: 4, reason: "Adjust allocation", dependsOn: ['pricing'], inputContext: ["pricing", "buckets"] }
      ]
    };
  }

  private async executeSubAgent(task: AgentTask): Promise<SubAgentResult> {
    const requestMsg = this.createA2AMessage('orchestrator', task.agentType, 'request', 'execute', {
      task,
      context: this.gatherContext(task)
    });
    this.a2aTrace.push(requestMsg);

    let result: SubAgentResult;

    switch (task.agentType) {
      case 'objective':
        result = await this.runObjectiveAgent(task);
        break;
      case 'forecast':
        result = await this.runForecastAgent(task);
        break;
      case 'pricing':
        result = await this.runPricingAgent(task);
        break;
      case 'seat_allocation':
        result = await this.runSeatAllocationAgent(task);
        break;
      case 'competitor':
        result = await this.runCompetitorAgent(task);
        break;
      default:
        result = {
          agentType: task.agentType,
          success: false,
          decision: "Unknown agent type",
          reasoning: "No handler for this agent type",
          output: {},
          a2aMessages: []
        };
    }

    const responseMsg = this.createA2AMessage(task.agentType, 'orchestrator', 'response', 'result', {
      success: result.success,
      decision: result.decision
    });
    this.a2aTrace.push(responseMsg);

    await this.onLog(
      this.getAgentDisplayName(task.agentType),
      result.decision,
      result.reasoning,
      result.output
    );

    return result;
  }

  private gatherContext(task: AgentTask): Record<string, unknown> {
    const context: Record<string, unknown> = {
      environment: this.environment,
      buckets: this.buckets
    };

    for (const dep of task.dependsOn) {
      const depResult = this.subAgentResults.get(dep);
      if (depResult) {
        context[dep] = depResult.output;
      }
    }

    return context;
  }

  private createA2AMessage(
    from: string, 
    to: string, 
    type: 'request' | 'response' | 'broadcast', 
    action: string, 
    payload: Record<string, unknown>
  ): A2AMessage {
    return {
      id: generateMessageId(),
      from,
      to,
      type,
      action,
      payload,
      timestamp: new Date()
    };
  }

  private getAgentDisplayName(agentType: SubAgentType): string {
    const names: Record<SubAgentType, string> = {
      'objective': 'Objective Agent',
      'forecast': 'Forecast Agent',
      'pricing': 'Pricing Agent',
      'seat_allocation': 'Seat Allocation Agent',
      'competitor': 'Competitor Agent'
    };
    return names[agentType] || agentType;
  }

  private async runObjectiveAgent(task: AgentTask): Promise<SubAgentResult> {
    const currentOccupancy = this.buckets.reduce((sum, b) => sum + (b.sold || 0), 0) / 
                             this.buckets.reduce((sum, b) => sum + b.allocated, 0);
    const occupancyGap = currentOccupancy - this.environment.expectedOccupancyToday;

    const prompt = `You are the Objective Agent. Determine the pricing objective.

ENVIRONMENT:
- Days to Departure: ${this.environment.daysToDeparture}
- Current Occupancy: ${(currentOccupancy * 100).toFixed(1)}%
- Expected Occupancy: ${(this.environment.expectedOccupancyToday * 100).toFixed(1)}%
- Occupancy Gap: ${(occupancyGap * 100).toFixed(1)}%
- Fuel Cost Index: ${this.environment.fuelCostIndex}
- Competitor Aggressiveness: ${this.environment.competitorAggressiveness}

OBJECTIVES TO CHOOSE FROM:
- REVENUE_MAXIMIZATION: When demand is high, focus on maximizing revenue
- OCCUPANCY_MAXIMIZATION: When seats need to be filled, focus on volume
- COMPETITIVE_MATCHING: When competitors are aggressive, match market prices

RESPOND WITH JSON:
{
  "objective": "REVENUE_MAXIMIZATION|OCCUPANCY_MAXIMIZATION|COMPETITIVE_MATCHING",
  "confidence": "HIGH|MEDIUM|LOW",
  "reasoning": "Why this objective was chosen",
  "urgency": "HIGH|MEDIUM|LOW"
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      
      return {
        agentType: 'objective',
        success: true,
        decision: `[${parsed.confidence || 'MEDIUM'}] ${parsed.objective || 'REVENUE_MAXIMIZATION'}`,
        reasoning: parsed.reasoning || "Default revenue focus",
        output: {
          objective: parsed.objective || 'REVENUE_MAXIMIZATION',
          confidence: parsed.confidence || 'MEDIUM',
          urgency: parsed.urgency || 'MEDIUM'
        },
        a2aMessages: []
      };
    } catch (e) {
      return {
        agentType: 'objective',
        success: false,
        decision: "[MEDIUM] REVENUE_MAXIMIZATION",
        reasoning: "Default objective due to error",
        output: { objective: 'REVENUE_MAXIMIZATION', confidence: 'MEDIUM', urgency: 'MEDIUM' },
        a2aMessages: []
      };
    }
  }

  private async runForecastAgent(task: AgentTask): Promise<SubAgentResult> {
    const objectiveResult = this.subAgentResults.get('objective');
    const currentOccupancy = this.buckets.reduce((sum, b) => sum + (b.sold || 0), 0) / 
                             this.buckets.reduce((sum, b) => sum + b.allocated, 0);

    const prompt = `You are the Forecast Agent. Analyze demand patterns.

CONTEXT FROM OBJECTIVE AGENT:
${JSON.stringify(objectiveResult?.output || {})}

ENVIRONMENT:
- Days to Departure: ${this.environment.daysToDeparture}
- Current Occupancy: ${(currentOccupancy * 100).toFixed(1)}%
- Base Demand: ${this.environment.baseDemand}
- Seasonality: ${this.environment.seasonalityIndex}
- Event Impact: ${this.environment.eventImpact || 'None'}

RESPOND WITH JSON:
{
  "demandScore": 0.0 to 1.0,
  "bookingVelocity": "ACCELERATING|STEADY|DECELERATING",
  "peakProbability": 0.0 to 1.0,
  "reasoning": "Analysis of demand patterns"
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      
      return {
        agentType: 'forecast',
        success: true,
        decision: `Demand Score: ${(parsed.demandScore || 0.5).toFixed(2)}`,
        reasoning: parsed.reasoning || "Standard demand analysis",
        output: {
          demandScore: parsed.demandScore || 0.5,
          bookingVelocity: parsed.bookingVelocity || 'STEADY',
          peakProbability: parsed.peakProbability || 0.3
        },
        a2aMessages: []
      };
    } catch (e) {
      return {
        agentType: 'forecast',
        success: false,
        decision: "Demand Score: 0.50",
        reasoning: "Default forecast due to error",
        output: { demandScore: 0.5, bookingVelocity: 'STEADY', peakProbability: 0.3 },
        a2aMessages: []
      };
    }
  }

  private async runPricingAgent(task: AgentTask): Promise<SubAgentResult> {
    const objectiveResult = this.subAgentResults.get('objective');
    const forecastResult = this.subAgentResults.get('forecast');
    const competitorResult = this.subAgentResults.get('competitor');

    const prompt = `You are the Pricing Agent. Calculate price multipliers.

CONTEXT FROM OTHER AGENTS:
Objective: ${JSON.stringify(objectiveResult?.output || {})}
Forecast: ${JSON.stringify(forecastResult?.output || {})}
Competitor: ${JSON.stringify(competitorResult?.output || {})}

ENVIRONMENT:
- Fuel Cost Index: ${this.environment.fuelCostIndex}
- Days to Departure: ${this.environment.daysToDeparture}

CURRENT BUCKETS:
${this.buckets.map(b => `${b.code}: Base ₹${b.basePrice}, Current ₹${b.price}`).join('\n')}

RESPOND WITH JSON:
{
  "multiplier": 0.7 to 1.5,
  "adjustmentType": "INCREASE|DECREASE|HOLD",
  "reasoning": "Why this pricing decision",
  "breakdownFactors": {
    "objective": 0.0 to 0.3,
    "demand": 0.0 to 0.3,
    "fuel": 0.0 to 0.2,
    "competition": 0.0 to 0.2
  }
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      const objective = (objectiveResult?.output as { objective?: string })?.objective || 'REVENUE_MAXIMIZATION';
      
      return {
        agentType: 'pricing',
        success: true,
        decision: `${objective} | Multiplier: ${(parsed.multiplier || 1.0).toFixed(2)}x`,
        reasoning: parsed.reasoning || "Standard pricing",
        output: {
          multiplier: parsed.multiplier || 1.0,
          adjustmentType: parsed.adjustmentType || 'HOLD',
          breakdownFactors: parsed.breakdownFactors || {}
        },
        a2aMessages: []
      };
    } catch (e) {
      return {
        agentType: 'pricing',
        success: false,
        decision: "REVENUE_MAXIMIZATION | Multiplier: 1.00x",
        reasoning: "Default pricing due to error",
        output: { multiplier: 1.0, adjustmentType: 'HOLD', breakdownFactors: {} },
        a2aMessages: []
      };
    }
  }

  private async runSeatAllocationAgent(task: AgentTask): Promise<SubAgentResult> {
    const pricingResult = this.subAgentResults.get('pricing');
    const forecastResult = this.subAgentResults.get('forecast');
    
    const totalSeats = this.buckets.reduce((sum, b) => sum + b.allocated, 0);
    const soldSeats = this.buckets.reduce((sum, b) => sum + (b.sold || 0), 0);

    const prompt = `You are the Seat Allocation Agent. Manage bucket allocation.

CONTEXT FROM OTHER AGENTS:
Pricing: ${JSON.stringify(pricingResult?.output || {})}
Forecast: ${JSON.stringify(forecastResult?.output || {})}

CURRENT ALLOCATION:
Total Seats: ${totalSeats}
Sold: ${soldSeats}
${this.buckets.map(b => `${b.code} (${b.class}): ${b.allocated} allocated, ${b.sold || 0} sold`).join('\n')}

RESPOND WITH JSON:
{
  "action": "REALLOCATE_UP|REALLOCATE_DOWN|HOLD",
  "confidence": "HIGH|MEDIUM|LOW",
  "reasoning": "Why this allocation decision",
  "suggestedChanges": [
    {"bucketCode": "ECO_1", "change": -5},
    {"bucketCode": "ECO_2", "change": 5}
  ]
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      
      return {
        agentType: 'seat_allocation',
        success: true,
        decision: `[${parsed.confidence || 'MEDIUM'}] ${parsed.action || 'HOLD'}`,
        reasoning: parsed.reasoning || "Standard allocation",
        output: {
          action: parsed.action || 'HOLD',
          confidence: parsed.confidence || 'MEDIUM',
          suggestedChanges: parsed.suggestedChanges || []
        },
        a2aMessages: []
      };
    } catch (e) {
      return {
        agentType: 'seat_allocation',
        success: false,
        decision: "[MEDIUM] HOLD",
        reasoning: "Default allocation due to error",
        output: { action: 'HOLD', confidence: 'MEDIUM', suggestedChanges: [] },
        a2aMessages: []
      };
    }
  }

  private async runCompetitorAgent(task: AgentTask): Promise<SubAgentResult> {
    const prompt = `You are the Competitor Agent. Analyze market positioning.

COMPETITORS:
${this.environment.competitors.map(c => `${c.name}: Base ₹${c.basePrice}`).join('\n')}

MARKET CONDITIONS:
- Competitor Aggressiveness: ${this.environment.competitorAggressiveness}
- Our Base Prices: ${this.buckets.map(b => `${b.code}: ₹${b.basePrice}`).join(', ')}

RESPOND WITH JSON:
{
  "threatLevel": "HIGH|MEDIUM|LOW",
  "marketPosition": "PREMIUM|COMPETITIVE|UNDERCUT",
  "reasoning": "Analysis of competitive landscape",
  "recommendedResponse": "Description of how to respond"
}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || "{}");
      const topCompetitor = this.environment.competitors[0]?.name || 'Market';
      
      return {
        agentType: 'competitor',
        success: true,
        decision: `[${parsed.threatLevel || 'MEDIUM'} THREAT] Position: ${parsed.marketPosition || 'COMPETITIVE'} | Threat: ${topCompetitor}`,
        reasoning: parsed.reasoning || "Standard competitive analysis",
        output: {
          threatLevel: parsed.threatLevel || 'MEDIUM',
          marketPosition: parsed.marketPosition || 'COMPETITIVE',
          recommendedResponse: parsed.recommendedResponse || ''
        },
        a2aMessages: []
      };
    } catch (e) {
      return {
        agentType: 'competitor',
        success: false,
        decision: "[MEDIUM THREAT] Position: COMPETITIVE",
        reasoning: "Default analysis due to error",
        output: { threatLevel: 'MEDIUM', marketPosition: 'COMPETITIVE', recommendedResponse: '' },
        a2aMessages: []
      };
    }
  }

  private computeFinalOutcome(): { pricingApplied: boolean; allocationChanged: boolean; summary: string } {
    const pricingResult = this.subAgentResults.get('pricing');
    const allocationResult = this.subAgentResults.get('seat_allocation');

    const pricingApplied = pricingResult?.success && 
      (pricingResult.output as { adjustmentType?: string })?.adjustmentType !== 'HOLD';
    
    const allocationChanged = allocationResult?.success && 
      (allocationResult.output as { action?: string })?.action !== 'HOLD';

    const agentsRun = this.subAgentResults.size;
    const successCount = Array.from(this.subAgentResults.values()).filter(r => r.success).length;

    return {
      pricingApplied: !!pricingApplied,
      allocationChanged: !!allocationChanged,
      summary: `Executed ${agentsRun} agents (${successCount} successful). Pricing: ${pricingApplied ? 'Updated' : 'Unchanged'}. Allocation: ${allocationChanged ? 'Modified' : 'Unchanged'}.`
    };
  }
}
