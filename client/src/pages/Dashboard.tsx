import { useEffect, useState, useMemo } from "react";
import { useScenarios, useLoadScenario, useSimulationState, useOrchestrate, useClearLogs, useClearChat } from "@/hooks/use-simulation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeatMap } from "@/components/SeatMap";
import { AgentLogs } from "@/components/AgentLogs";
import { BookingChat } from "@/components/BookingChat";
import { 
  Calendar, Plane, Users, TrendingUp, Play, RefreshCw, AlertCircle, 
  Fuel, Target, CloudSun, Trophy, DollarSign, Percent, Clock, Building2, ArrowUp, ArrowDown, Minus,
  BrainCircuit, MessageSquare, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { DemandForecastPoint } from "@shared/schema";

interface EnvRowProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: boolean;
}

function EnvRow({ label, value, icon, highlight }: EnvRowProps) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? 'bg-primary/5 -mx-3 px-3 rounded-md' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className={`font-mono text-sm ${highlight ? 'text-primary font-bold' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { data: scenarios } = useScenarios();
  const { data: state, isLoading } = useSimulationState();
  const { mutate: loadScenario, isPending: isLoadingScenario } = useLoadScenario();
  const { mutate: orchestrate, isPending: isOrchestrating } = useOrchestrate();
  const { mutate: clearLogs, isPending: isClearingLogs } = useClearLogs();
  const { mutate: clearChat, isPending: isClearingChat } = useClearChat();
  
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");

  // Get the selected scenario object for preview
  const selectedScenario = useMemo(() => {
    return scenarios?.find(s => s.id === selectedScenarioId);
  }, [scenarios, selectedScenarioId]);

  useEffect(() => {
    if (scenarios && scenarios.length > 0 && !selectedScenarioId) {
      setSelectedScenarioId(scenarios[0].id);
    }
  }, [scenarios, selectedScenarioId]);

  if (isLoading && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" data-testid="loading-spinner" />
          <p className="text-muted-foreground font-medium">Initializing Flight Systems...</p>
        </div>
      </div>
    );
  }

  // Calculate some stats
  const totalRevenue = state?.session.totalRevenue || 0;
  const departureDate = state?.session.departureDate ? new Date(state.session.departureDate) : new Date();
  const currentDate = state?.session.currentDate ? new Date(state.session.currentDate) : new Date();
  const daysUntilDeparture = Math.ceil((departureDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Get current scenario from loaded session
  const currentScenario = scenarios?.find(s => s.id === state?.session.scenarioId);
  
  // Calculate sold seats
  const totalSold = state?.buckets.reduce((acc, b) => acc + (b.sold || 0), 0) || 0;
  const totalSeats = 192;
  const loadFactor = ((totalSold / totalSeats) * 100).toFixed(1);

  return (
    <div className="h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {/* HEADER */}
      <header className="border-b bg-card/50 backdrop-blur-sm z-50 flex-shrink-0">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Plane className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight">Agentic Dynamic Pricing</h1>
              <p className="text-xs text-muted-foreground font-mono">INDIGO • BLR → DXB</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {state && (
              <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-mono">{format(currentDate, "MMM dd, yyyy")}</span>
              </div>
            )}
            <Badge variant="outline" className="font-mono">
              {state ? `Session #${state.session.id}` : "No Session"}
            </Badge>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          
          {/* LEFT PANEL: Environment Control */}
          <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
            <div className="flex h-full flex-col p-4 overflow-hidden">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Environment Control
                </CardTitle>
                <CardDescription>Select and load a pricing scenario</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Scenario Selector */}
                <div className="space-y-3 mb-4">
                  <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
                    <SelectTrigger data-testid="select-scenario">
                      <SelectValue placeholder="Select Scenario" />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarios?.map(s => (
                        <SelectItem key={s.id} value={s.id} data-testid={`scenario-${s.id}`}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    className="w-full" 
                    onClick={() => loadScenario(selectedScenarioId)} 
                    disabled={!selectedScenarioId || isLoadingScenario}
                    data-testid="button-load-scenario"
                  >
                    {isLoadingScenario ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        Loading...
                      </>
                    ) : (
                      "Load Scenario"
                    )}
                  </Button>
                </div>

                <Separator className="my-2" />

                {/* Scenario Description & Environment Variables */}
                <ScrollArea className="flex-1">
                  {selectedScenario && (
                    <div className="space-y-4 pr-4">
                      {/* Description */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm">{selectedScenario.name}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {selectedScenario.description}
                        </p>
                      </div>

                      <Separator />

                      {/* Flight Details */}
                      <div className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Flight Details</h5>
                        <EnvRow label="Route" value={selectedScenario.environment.route} icon={<Plane className="w-3 h-3" />} />
                        <EnvRow label="Airline" value={selectedScenario.environment.airline} />
                        <EnvRow label="Aircraft" value={selectedScenario.environment.aircraft} />
                        <EnvRow label="Total Seats" value={selectedScenario.environment.totalSeats} icon={<Users className="w-3 h-3" />} />
                      </div>

                      <Separator />

                      {/* Time Context */}
                      <div className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Time Context (60-Day Window)</h5>
                        <EnvRow label="Booking Window" value={`${selectedScenario.environment.bookingWindow} days`} />
                        <EnvRow label="Days Elapsed" value={selectedScenario.environment.daysElapsed} />
                        <EnvRow label="Days to Departure" value={selectedScenario.environment.daysToDeparture} icon={<Clock className="w-3 h-3" />} highlight />
                        <EnvRow label="Current Date" value={selectedScenario.environment.currentDate} icon={<Calendar className="w-3 h-3" />} />
                        <EnvRow label="Departure Date" value={selectedScenario.environment.departureDate} />
                      </div>

                      <Separator />

                      {/* Market Conditions */}
                      <div className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Market Conditions</h5>
                        <EnvRow label="Fuel Cost Index" value={`${(selectedScenario.environment.fuelCostIndex * 100).toFixed(0)}%`} icon={<Fuel className="w-3 h-3" />} highlight={selectedScenario.environment.fuelCostIndex > 1.2} />
                        <EnvRow label="Seasonality Index" value={`${(selectedScenario.environment.seasonalityIndex * 100).toFixed(0)}%`} />
                        <EnvRow label="Base Demand" value={`${(selectedScenario.environment.baseDemand * 100).toFixed(0)}%`} icon={<TrendingUp className="w-3 h-3" />} highlight />
                      </div>

                      <Separator />

                      {/* Competition */}
                      <div className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Competition</h5>
                        <EnvRow label="Competitor Aggression" value={`${(selectedScenario.environment.competitorAggressiveness * 100).toFixed(0)}%`} icon={<Target className="w-3 h-3" />} />
                        {selectedScenario.environment.competitors.map(c => (
                          <EnvRow key={c.name} label={c.name} value={`₹${c.basePrice.toLocaleString()}`} />
                        ))}
                      </div>

                      <Separator />

                      {/* Events & Weather */}
                      <div className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">External Factors</h5>
                        {selectedScenario.environment.eventImpact && (
                          <EnvRow label="Event Impact" value={selectedScenario.environment.eventImpact} icon={<Trophy className="w-3 h-3" />} highlight />
                        )}
                        <EnvRow label="Weather" value={selectedScenario.environment.weatherForecast} icon={<CloudSun className="w-3 h-3" />} />
                      </div>

                      <Separator />

                      {/* Targets */}
                      <div className="space-y-1">
                        <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Revenue Goals</h5>
                        <EnvRow label="Revenue Target" value={`₹${selectedScenario.environment.revenueTarget.toLocaleString()}`} icon={<DollarSign className="w-3 h-3" />} />
                        <EnvRow label="Occupancy Target" value={`${selectedScenario.environment.occupancyTarget}%`} icon={<Percent className="w-3 h-3" />} />
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* MIDDLE PANEL: Visualization */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-full flex-col overflow-hidden">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-4">
            {/* Live Stats Bar */}
            {state && (
              <div className="grid grid-cols-4 gap-3">
                <Card className={`p-3 transition-all duration-300 ${isOrchestrating ? 'ring-2 ring-primary/50 animate-pulse' : ''}`} data-testid="stat-revenue">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Revenue
                  </div>
                  <div className="text-lg font-bold text-primary">₹{totalRevenue.toLocaleString()}</div>
                </Card>
                <Card className={`p-3 transition-all duration-300 ${isOrchestrating ? 'ring-2 ring-primary/50 animate-pulse' : ''}`} data-testid="stat-load-factor">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    Load Factor
                  </div>
                  <div className="text-lg font-bold">{loadFactor}%</div>
                </Card>
                <Card className={`p-3 transition-all duration-300 ${isOrchestrating ? 'ring-2 ring-primary/50 animate-pulse' : ''}`} data-testid="stat-seats-sold">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Seats Sold
                  </div>
                  <div className="text-lg font-bold">{totalSold} / {totalSeats}</div>
                </Card>
                <Card className={`p-3 transition-all duration-300 ${isOrchestrating ? 'ring-2 ring-primary/50 animate-pulse' : ''}`} data-testid="stat-days-left">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Days Left
                  </div>
                  <div className="text-lg font-bold">{daysUntilDeparture}</div>
                </Card>
              </div>
            )}

            {/* Demand Forecast Chart */}
            {state && currentScenario && currentScenario.environment.demandForecast && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Demand Forecast vs Actual
                  </CardTitle>
                  <CardDescription className="text-xs">
                    60-day booking window • Day {currentScenario.environment.daysElapsed} of 60
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const forecast = currentScenario.environment.demandForecast;
                    const daysElapsed = currentScenario.environment.daysElapsed;
                    const expectedToday = currentScenario.environment.expectedOccupancyToday;
                    const actualOccupancy = parseFloat(loadFactor);
                    const diff = actualOccupancy - expectedToday;
                    const status = diff < -5 ? "below" : diff > 5 ? "above" : "on-track";
                    
                    const chartData = forecast.map((p: DemandForecastPoint) => ({
                      day: p.day,
                      forecast: p.expectedOccupancy,
                      actual: p.day <= daysElapsed ? (p.day === daysElapsed || (daysElapsed > 0 && p.day === Math.floor(daysElapsed / 5) * 5) ? actualOccupancy : null) : null
                    }));
                    
                    if (daysElapsed > 0) {
                      const actualPoint = chartData.find((d: { day: number; forecast: number; actual: number | null }) => d.day === Math.floor(daysElapsed / 5) * 5);
                      if (actualPoint) actualPoint.actual = actualOccupancy;
                    }

                    return (
                      <>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-primary/30 border border-primary" />
                            <span className="text-xs text-muted-foreground">Forecast</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={status === "below" ? "destructive" : status === "above" ? "default" : "secondary"}
                              className="text-xs h-5"
                              data-testid="badge-forecast-status"
                            >
                              {status === "below" && <ArrowDown className="w-3 h-3 mr-1" />}
                              {status === "above" && <ArrowUp className="w-3 h-3 mr-1" />}
                              {status === "on-track" && <Minus className="w-3 h-3 mr-1" />}
                              {status === "below" ? "Below Forecast" : status === "above" ? "Above Forecast" : "On Track"}
                              ({diff > 0 ? "+" : ""}{diff.toFixed(1)}%)
                            </Badge>
                          </div>
                          <div className="ml-auto text-xs">
                            <span className="text-muted-foreground">Expected: </span>
                            <span className="font-mono font-bold">{expectedToday}%</span>
                            <span className="text-muted-foreground mx-1">•</span>
                            <span className="text-muted-foreground">Actual: </span>
                            <span className="font-mono font-bold text-primary">{loadFactor}%</span>
                          </div>
                        </div>
                        <div className="h-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                              <defs>
                                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis 
                                dataKey="day" 
                                tick={{ fontSize: 10 }} 
                                tickFormatter={(v) => `D${v}`}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis 
                                tick={{ fontSize: 10 }} 
                                tickFormatter={(v) => `${v}%`}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 100]}
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  fontSize: '12px'
                                }}
                                formatter={(value: number, name: string) => [
                                  `${value.toFixed(1)}%`, 
                                  name === 'forecast' ? 'Expected' : 'Actual'
                                ]}
                                labelFormatter={(day) => `Day ${day}`}
                              />
                              <ReferenceLine 
                                x={daysElapsed} 
                                stroke="hsl(var(--primary))" 
                                strokeDasharray="3 3" 
                                label={{ value: 'Today', fontSize: 10, fill: 'hsl(var(--primary))' }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="forecast" 
                                stroke="hsl(var(--primary))" 
                                fill="url(#forecastGradient)" 
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Seat Map */}
            <SeatMap buckets={state?.buckets || []} />
            
            {/* Bucket Pricing Table */}
            {state && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Fare Buckets</CardTitle>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Business
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        Economy
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {state.buckets.map(bucket => {
                      const sold = bucket.sold || 0;
                      const available = bucket.allocated - sold;
                      const fillRate = (sold / bucket.allocated) * 100;
                      const priceChange = bucket.basePrice ? ((bucket.price - bucket.basePrice) / bucket.basePrice) * 100 : 0;
                      const isBusiness = bucket.class === 'BUSINESS';
                      
                      return (
                        <div 
                          key={bucket.code} 
                          className={`relative overflow-hidden rounded-lg border p-3 transition-all hover-elevate ${
                            isBusiness ? 'border-amber-500/30 bg-amber-500/5' : 'border-sky-500/30 bg-sky-500/5'
                          }`}
                        >
                          {/* Fill rate background */}
                          <div 
                            className={`absolute inset-y-0 left-0 transition-all ${
                              isBusiness ? 'bg-amber-500/10' : 'bg-sky-500/10'
                            }`}
                            style={{ width: `${fillRate}%` }}
                          />
                          
                          <div className="relative flex items-center gap-4">
                            {/* Bucket code & class */}
                            <div className="flex-shrink-0 w-20">
                              <div className={`font-mono font-bold text-sm ${
                                isBusiness ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'
                              }`}>
                                {bucket.code}
                              </div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {bucket.class}
                              </div>
                            </div>
                            
                            {/* Price section */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-bold">₹{bucket.price?.toLocaleString()}</span>
                                {priceChange !== 0 && (
                                  <span className={`text-xs font-medium ${
                                    priceChange > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    {priceChange > 0 ? '+' : ''}{priceChange.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                Base: ₹{bucket.basePrice?.toLocaleString()}
                              </div>
                            </div>
                            
                            {/* Availability section */}
                            <div className="flex-shrink-0 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <span className="text-sm font-semibold">{sold}/{bucket.allocated}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                  fillRate >= 80 
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                    : fillRate >= 50 
                                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                }`}>
                                  {available} left
                                </span>
                              </div>
                              <div className="mt-1.5 w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    fillRate >= 80 
                                      ? 'bg-red-500' 
                                      : fillRate >= 50 
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                  }`}
                                  style={{ width: `${fillRate}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Run Agent Button */}
            {state && (
              <Button 
                size="lg" 
                className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                onClick={() => orchestrate()}
                disabled={isOrchestrating}
                data-testid="button-run-agents"
              >
                {isOrchestrating ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Agents Thinking...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Run Agent Cycle
                  </>
                )}
              </Button>
            )}

            {!state && (
              <Card className="flex-1 flex items-center justify-center">
                <div className="text-center p-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No Active Simulation</h3>
                  <p className="text-sm text-muted-foreground">Select a scenario from the left panel and click "Load Scenario" to begin.</p>
                </div>
              </Card>
            )}
              </div>
            </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* RIGHT PANEL: Intelligence & Chat with Tabs */}
          <ResizablePanel defaultSize={28} minSize={20} maxSize={45}>
            <div className="h-full flex flex-col p-4 overflow-hidden">
            <Tabs defaultValue="reasoning" className="flex flex-col h-full">
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="reasoning" className="flex items-center gap-2" data-testid="tab-agent-reasoning">
                  <BrainCircuit className="w-4 h-4" />
                  Agent Reasoning
                </TabsTrigger>
                <TabsTrigger value="booking" className="flex items-center gap-2" data-testid="tab-booking-assistant">
                  <MessageSquare className="w-4 h-4" />
                  Booking Assistant
                </TabsTrigger>
              </TabsList>
              <TabsContent value="reasoning" className="flex-1 min-h-0 overflow-hidden mt-0">
                <div className="flex flex-col h-full min-h-0">
                  <div className="flex justify-end mb-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => clearLogs()}
                      disabled={isClearingLogs || !state?.logs?.length}
                      data-testid="button-clear-logs"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear Logs
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <AgentLogs logs={state?.logs || []} />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="booking" className="flex-1 min-h-0 overflow-hidden mt-0 pb-4">
                <div className="flex flex-col h-full min-h-0">
                  <div className="flex justify-end mb-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => clearChat()}
                      disabled={isClearingChat}
                      data-testid="button-clear-chat"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Clear Chat
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <BookingChat />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            </div>
          </ResizablePanel>

        </ResizablePanelGroup>
      </main>
    </div>
  );
}
