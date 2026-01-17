import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ReasoningLog } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { BrainCircuit, Activity, LineChart, TrendingUp, TrendingDown, Minus, Fuel, Calendar, Users, Clock, Zap, Target, DollarSign, Armchair, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MultiplierData {
  value: number;
  reason: string;
}

interface MetricData {
  current: number;
  projected: number;
  target: number;
  change: number;
  changePercent: number;
}

interface OptimizationData {
  strategy: "REVENUE_MAXIMIZATION" | "SEAT_FILL_RATE";
  strategyReason: string;
  metrics: {
    revenue: MetricData;
    occupancy: MetricData;
  };
}

interface Multipliers {
  demand?: MultiplierData;
  urgency?: MultiplierData;
  competition?: MultiplierData;
  fuel?: MultiplierData;
  seasonality?: MultiplierData;
  optimization?: OptimizationData;
}

const featureIcons: Record<string, any> = {
  demand: Users,
  urgency: Clock,
  competition: Zap,
  fuel: Fuel,
  seasonality: Calendar,
};

const featureLabels: Record<string, string> = {
  demand: "Demand",
  urgency: "Urgency",
  competition: "Competition",
  fuel: "Fuel Cost",
  seasonality: "Seasonality",
};

function MultiplierBadge({ value }: { value: number }) {
  const isIncrease = value > 1;
  const isDecrease = value < 1;
  const Icon = isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;
  const color = isIncrease 
    ? "text-red-500 bg-red-500/10" 
    : isDecrease 
    ? "text-green-500 bg-green-500/10" 
    : "text-slate-500 bg-slate-500/10";
  
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-bold", color)}>
      <Icon className="w-3 h-3" />
      {value.toFixed(2)}x
    </span>
  );
}

function formatCurrency(value: number): string {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  } else if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString()}`;
}

function MetricCard({ 
  label, 
  icon: Icon, 
  current, 
  projected, 
  target, 
  change, 
  changePercent,
  isPercentage = false 
}: { 
  label: string;
  icon: any;
  current: number;
  projected: number;
  target: number;
  change: number;
  changePercent: number;
  isPercentage?: boolean;
}) {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const ChangeIcon = isPositive ? ArrowUp : isNegative ? ArrowDown : Minus;
  const progressToTarget = isPercentage 
    ? Math.min(100, (projected / target) * 100)
    : Math.min(100, (projected / target) * 100);
  
  return (
    <div className="p-3 rounded-lg bg-background/50 border border-border/50" data-testid={`metric-${label.toLowerCase().replace(' ', '-')}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Current</div>
          <div className="text-sm font-bold">
            {isPercentage ? `${current}%` : formatCurrency(current)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Projected</div>
          <div className={cn(
            "text-sm font-bold",
            isPositive ? "text-green-600" : change < 0 ? "text-red-600" : ""
          )}>
            {isPercentage ? `${projected}%` : formatCurrency(projected)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase">Target</div>
          <div className="text-sm font-bold text-primary">
            {isPercentage ? `${target}%` : formatCurrency(target)}
          </div>
        </div>
      </div>
      
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <ChangeIcon className={cn("w-3 h-3", isPositive ? "text-green-500" : isNegative ? "text-red-500" : "text-slate-400")} />
          <span className={cn(
            "text-xs font-bold",
            isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-slate-500"
          )}>
            {isPositive ? "+" : ""}{isPercentage ? change : formatCurrency(change)} ({changePercent}%)
          </span>
        </div>
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              progressToTarget >= 100 ? "bg-green-500" : progressToTarget >= 75 ? "bg-yellow-500" : "bg-primary"
            )}
            style={{ width: `${Math.min(100, progressToTarget)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function OptimizationStrategy({ optimization }: { optimization: OptimizationData }) {
  const isRevenue = optimization.strategy === "REVENUE_MAXIMIZATION";
  const StrategyIcon = isRevenue ? DollarSign : Armchair;
  const strategyLabel = isRevenue ? "Revenue Maximization" : "Seat Fill Rate";
  const strategyColor = isRevenue 
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-700"
    : "bg-blue-500/10 text-blue-600 border-blue-300 dark:border-blue-700";
  
  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground/80">Optimization Strategy:</span>
      </div>
      
      <div className={cn("flex items-center gap-2 p-2 rounded-lg border", strategyColor)} data-testid="optimization-strategy">
        <StrategyIcon className="w-5 h-5" />
        <div className="flex-1">
          <div className="font-bold text-sm">{strategyLabel}</div>
          <div className="text-xs opacity-80">{optimization.strategyReason}</div>
        </div>
      </div>
      
      <div className="text-xs font-semibold text-foreground/80 mt-2">Impact Analysis:</div>
      <div className="grid gap-2">
        <MetricCard
          label="Revenue"
          icon={DollarSign}
          current={optimization.metrics.revenue.current}
          projected={optimization.metrics.revenue.projected}
          target={optimization.metrics.revenue.target}
          change={optimization.metrics.revenue.change}
          changePercent={optimization.metrics.revenue.changePercent}
          isPercentage={false}
        />
        <MetricCard
          label="Occupancy"
          icon={Armchair}
          current={optimization.metrics.occupancy.current}
          projected={optimization.metrics.occupancy.projected}
          target={optimization.metrics.occupancy.target}
          change={optimization.metrics.occupancy.change}
          changePercent={optimization.metrics.occupancy.changePercent}
          isPercentage={true}
        />
      </div>
    </div>
  );
}

function MultiplierBreakdown({ multipliers }: { multipliers: Multipliers }) {
  const features = ['demand', 'urgency', 'competition', 'fuel', 'seasonality'] as const;
  const validFeatures = features.filter(f => multipliers[f]?.value !== undefined);
  
  if (validFeatures.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-semibold text-foreground/80 mb-2">Feature Multipliers:</div>
      <div className="grid gap-2">
        {validFeatures.map((feature) => {
          const data = multipliers[feature];
          if (!data || typeof data.value !== 'number') return null;
          
          const Icon = featureIcons[feature] || Zap;
          const label = featureLabels[feature] || feature;
          
          return (
            <div 
              key={feature}
              className="flex items-start gap-2 p-2 rounded-md bg-background/50 border border-border/50"
              data-testid={`multiplier-${feature}`}
            >
              <div className="flex items-center gap-2 min-w-[100px]">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{label}</span>
              </div>
              <MultiplierBadge value={data.value} />
              <span className="text-xs text-muted-foreground flex-1">{data.reason || "No reason provided"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AgentLogsProps {
  logs: ReasoningLog[];
}

export function AgentLogs({ logs }: AgentLogsProps) {
  // Sort logs by newest first
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

  const getAgentIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'orchestrator': return <BrainCircuit className="w-3 h-3" />;
      case 'pricing': return <Activity className="w-3 h-3" />;
      case 'forecast': return <LineChart className="w-3 h-3" />;
      default: return <BrainCircuit className="w-3 h-3" />;
    }
  };

  const getAgentColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'orchestrator': return "bg-indigo-500/10 text-indigo-500 border-indigo-200 dark:border-indigo-800";
      case 'pricing': return "bg-emerald-500/10 text-emerald-500 border-emerald-200 dark:border-emerald-800";
      case 'forecast': return "bg-blue-500/10 text-blue-500 border-blue-200 dark:border-blue-800";
      default: return "bg-slate-500/10 text-slate-500 border-slate-200";
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-primary" />
          Agent Reasoning Trace
        </h3>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {sortedLogs.length === 0 ? (
              <div className="text-center text-muted-foreground py-10 italic">
                Waiting for agent activity...
              </div>
            ) : (
              sortedLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex gap-3 group"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-[1px] h-full bg-border group-last:bg-transparent" />
                    <div className="w-2 h-2 rounded-full bg-border mt-2 absolute" />
                  </div>
                  
                  <div className="flex-1 pb-4">
                    <div className={cn(
                      "rounded-lg p-3 border text-sm transition-all hover:shadow-md",
                      getAgentColor(log.agentName)
                    )}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 font-mono font-bold uppercase text-xs">
                          {getAgentIcon(log.agentName)}
                          {log.agentName}
                        </div>
                        <span className="text-[10px] opacity-70 font-mono">
                          {log.timestamp && format(new Date(log.timestamp), 'HH:mm:ss')}
                        </span>
                      </div>
                      
                      <div className="font-semibold mb-1">{log.decision}</div>
                      <div className="opacity-90 leading-relaxed text-xs">
                        {log.reasoning}
                      </div>
                      
                      {log.metadata && (() => {
                        try {
                          const meta = typeof log.metadata === 'string' 
                            ? JSON.parse(log.metadata) 
                            : log.metadata;
                          
                          const hasMultipliers = meta.demand || meta.urgency || meta.competition || meta.fuel || meta.seasonality;
                          const hasOptimization = meta.optimization?.strategy;
                          
                          if (hasOptimization || hasMultipliers) {
                            return (
                              <>
                                {hasOptimization && <OptimizationStrategy optimization={meta.optimization} />}
                                {hasMultipliers && <MultiplierBreakdown multipliers={meta as Multipliers} />}
                              </>
                            );
                          }
                          
                          if (Object.keys(meta).length > 0) {
                            return (
                              <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 font-mono text-[10px] opacity-75 overflow-x-auto">
                                {JSON.stringify(meta)}
                              </div>
                            );
                          }
                          return null;
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
