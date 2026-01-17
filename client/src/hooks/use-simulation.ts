import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SimulationState } from "@shared/routes";

// ============================================
// SCENARIOS
// ============================================

export function useScenarios() {
  return useQuery({
    queryKey: [api.scenarios.list.path],
    queryFn: async () => {
      const res = await fetch(api.scenarios.list.path);
      if (!res.ok) throw new Error("Failed to fetch scenarios");
      return api.scenarios.list.responses[200].parse(await res.json());
    },
  });
}

export function useLoadScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scenarioId: string) => {
      const res = await fetch(api.scenarios.load.path, {
        method: api.scenarios.load.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      if (!res.ok) throw new Error("Failed to load scenario");
      return api.scenarios.load.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.simulation.state.path] });
      queryClient.invalidateQueries({ queryKey: [api.chat.history.path] });
    },
  });
}

// ============================================
// SIMULATION STATE
// ============================================

export function useSimulationState() {
  return useQuery({
    queryKey: [api.simulation.state.path],
    queryFn: async () => {
      const res = await fetch(api.simulation.state.path);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch simulation state");
      return api.simulation.state.responses[200].parse(await res.json());
    },
    refetchInterval: 2000, // Poll every 2 seconds for live updates
  });
}

export function useOrchestrate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.simulation.orchestrate.path, {
        method: api.simulation.orchestrate.method,
      });
      if (!res.ok) throw new Error("Agent orchestration failed");
      return api.simulation.orchestrate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.simulation.state.path] });
    },
  });
}

// ============================================
// BOOKING
// ============================================

export function useBookTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bucketCode, quantity }: { bucketCode: string; quantity: number }) => {
      const res = await fetch(api.simulation.book.path, {
        method: api.simulation.book.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucketCode, quantity }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Booking failed");
      }
      return api.simulation.book.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.simulation.state.path] });
    },
  });
}
