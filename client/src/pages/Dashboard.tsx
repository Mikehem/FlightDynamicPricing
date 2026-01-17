import { useEffect, useState, useMemo } from "react";
import { useScenarios, useLoadScenario, useSimulationState, useOrchestrate } from "@/hooks/use-simulation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeatMap } from "@/components/SeatMap";
import { AgentLogs } from "@/components/AgentLogs";
import { BookingChat } from "@/components/BookingChat";
import { 
  Calendar, Plane, Users, TrendingUp, Play, RefreshCw, AlertCircle, 
  Fuel, Target, CloudSun, Trophy, DollarSign, Percent, Clock, Building2
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* HEADER */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
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
      <main className="flex-1 p-4 lg:p-6 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-100px)]">
          
          {/* LEFT COLUMN: Environment Panel */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 overflow-hidden">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Environment Control
                </CardTitle>
                <CardDescription>Select and load a pricing scenario</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
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

          {/* MIDDLE COLUMN: Visualization */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-4 overflow-y-auto px-2">
            {/* Live Stats Bar */}
            {state && (
              <div className="grid grid-cols-4 gap-3">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Revenue</div>
                  <div className="text-lg font-bold text-primary">₹{totalRevenue.toLocaleString()}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Load Factor</div>
                  <div className="text-lg font-bold">{loadFactor}%</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Seats Sold</div>
                  <div className="text-lg font-bold">{totalSold} / {totalSeats}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Days Left</div>
                  <div className="text-lg font-bold">{daysUntilDeparture}</div>
                </Card>
              </div>
            )}

            {/* Seat Map */}
            <SeatMap buckets={state?.buckets || []} />
            
            {/* Bucket Pricing Table */}
            {state && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Current Bucket Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {state.buckets.map(bucket => (
                      <div key={bucket.code} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                        <div>
                          <div className="font-mono font-bold text-sm">{bucket.code}</div>
                          <div className="text-xs text-muted-foreground">{bucket.class}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-primary">₹{bucket.price?.toLocaleString()}</div>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-[10px] h-4">
                              {bucket.sold || 0} sold
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] h-4">
                              {bucket.allocated - (bucket.sold || 0)} left
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
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

          {/* RIGHT COLUMN: Intelligence & Chat */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 h-full overflow-hidden pl-2">
            <div className="h-1/2">
              <AgentLogs logs={state?.logs || []} />
            </div>
            <div className="h-1/2 pb-4">
              <BookingChat />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
