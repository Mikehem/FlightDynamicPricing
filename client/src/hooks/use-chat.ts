import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useChatHistory() {
  return useQuery({
    queryKey: [api.chat.history.path],
    queryFn: async () => {
      const res = await fetch(api.chat.history.path);
      if (!res.ok) throw new Error("Failed to fetch chat history");
      return api.chat.history.responses[200].parse(await res.json());
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      // Use AbortController with 2-minute timeout for group booking orchestration
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      try {
        const res = await fetch(api.chat.send.path, {
          method: api.chat.send.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Failed to send message");
        return api.chat.send.responses[200].parse(await res.json());
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.chat.history.path] });
    },
  });
}
