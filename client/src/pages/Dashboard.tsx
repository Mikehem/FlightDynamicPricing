import { useEffect, useState } from "react";
import { useScenarios, useLoadScenario, useSimulationState, useOrchestrate } from "@/hooks/use-simulation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatsCard } from "@/components/StatsCard";
import { SeatMap } from "@/components/SeatMap";
import { AgentLogs } from "@/components/AgentLogs";
import { BookingChat } from "@/components/BookingChat";
import { Calendar, Plane, Users, TrendingUp, Play, RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const { data: scenarios } = useScenarios();
  const { data: state, isLoading } = useSimulationState();
  const { mutate: loadScenario, isPending: isLoadingScenario } = useLoadScenario();
  const { mutate: orchestrate, isPending: isOrchestrating } = useOrchestrate();
  
  const [selectedScenario, setSelectedScenario] = useState<string>("");

  useEffect(() => {
    if (scenarios && scenarios.length > 0 && !selectedScenario) {
      setSelectedScenario(scenarios[0].id);
    }
  }, [scenarios, selectedScenario]);

  if (isLoading && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Initializing Flight Systems...</p>
        </div>
      </div>
    );
  }

  // Fallback if simulation isn't initialized
  if (!state && !isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
         <div className="max-w-md text-center space-y-4">
            <div className="bg-destructive/10 p-4 rounded-full w-fit mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold font-display">Simulation Not Started</h1>
            <p className="text-muted-foreground">Select a scenario to begin the dynamic pricing simulation.</p>
            <div className="flex gap-2 justify-center">
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select Scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios?.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => loadScenario(selectedScenario)} disabled={!selectedScenario || isLoadingScenario}>
                {isLoadingScenario ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : "Start"}
              </Button>
            </div>
         </div>
      </div>
    );
  }

  // Calculate some stats for the dashboard
  const totalRevenue = state?.session.totalRevenue || 0;
  const loadFactor = state?.session.loadFactor || 0;
  const departureDate = state?.session.departureDate ? new Date(state.session.departureDate) : new Date();
  const currentDate = state?.session.currentDate ? new Date(state.session.currentDate) : new Date();
  
  const daysUntilDeparture = Math.ceil((departureDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

  // Mock data for chart if history is empty (just for visuals in this demo)
  const chartData = [
    { name: 'Day 1', price: 400 },
    { name: 'Day 2', price: 300 },
    { name: 'Day 3', price: 550 },
    { name: 'Day 4', price: 450 },
    { name: 'Day 5', price: 600 },
  ];

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
              <h1 className="font-display font-bold text-lg leading-tight">Agentic Pricing</h1>
              <p className="text-xs text-muted-foreground font-mono">DXB-LHR • FLIGHT 772</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-mono">{format(currentDate, "MMM dd, yyyy")}</span>
            </div>
            
            <div className="h-6 w-[1px] bg-border" />
            
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Select Scenario" />
              </SelectTrigger>
              <SelectContent>
                {scenarios?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => loadScenario(selectedScenario)} disabled={isLoadingScenario}>
              {isLoadingScenario && <RefreshCw className="w-3 h-3 animate-spin mr-2" />}
              Reset Sim
            </Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 lg:p-6 overflow-hidden">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-100px)]">
          
          {/* LEFT COLUMN: Environment & Stats */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
            <StatsCard 
              title="Total Revenue" 
              value={`$${totalRevenue.toLocaleString()}`} 
              icon={TrendingUp} 
              trend="up"
              description="+12% vs Forecast"
              className="bg-gradient-to-br from-card to-primary/5"
            />
            <StatsCard 
              title="Load Factor" 
              value={`${(loadFactor * 100).toFixed(1)}%`} 
              icon={Users} 
              description="78 Seats Remaining"
            />
            <StatsCard 
              title="Days to Dep" 
              value={daysUntilDeparture} 
              icon={Calendar} 
              description={format(departureDate, "MMM dd")}
            />
            
            <Card className="flex-1 border-none shadow-md bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Bucket Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {state?.buckets.map(bucket => (
                    <div key={bucket.code} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-sm">{bucket.code}</span>
                        <span className="text-xs text-muted-foreground">{bucket.class}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-primary">${bucket.price}</span>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-[10px] h-4">
                            {bucket.sold} sold
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] h-4">
                            {bucket.allocated - bucket.sold} left
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button 
              size="lg" 
              className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              onClick={() => orchestrate()}
              disabled={isOrchestrating}
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
          </div>

          {/* MIDDLE COLUMN: Visualization */}
          <div className="col-span-12 lg:col-span-6 flex flex-col gap-6 overflow-y-auto px-2">
            {/* Seat Map */}
            <SeatMap buckets={state?.buckets || []} />
            
            {/* Price Trends Chart */}
            <Card className="flex-1 min-h-[300px] border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Pricing Trends (Economy vs Business)</CardTitle>
              </CardHeader>
              <CardContent className="h-[250px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--background))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                 </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Intelligence & Chat */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-6 h-full overflow-hidden pl-2">
            <div className="h-1/2">
              <AgentLogs logs={state?.logs || []} />
            </div>
            <div className="h-1/2 pb-6">
              <BookingChat />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
