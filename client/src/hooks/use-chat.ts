import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { logger } from "@/lib/logger";

export function useChatHistory() {
  return useQuery({
    queryKey: [api.chat.history.path],
    queryFn: async () => {
      const res = await fetch(api.chat.history.path);
      if (!res.ok) {
        logger.error('Chat', 'Failed to fetch chat history', { status: res.status });
        throw new Error("Failed to fetch chat history");
      }
      return api.chat.history.responses[200].parse(await res.json());
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      logger.userAction('Send chat message', { message: message.substring(0, 50) });
      
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
        if (!res.ok) {
          logger.error('Chat', 'Failed to send message', { status: res.status });
          throw new Error("Failed to send message");
        }
        const data = api.chat.send.responses[200].parse(await res.json());
        logger.info('Chat', 'Message sent successfully', { responseLength: data.response?.length });
        return data;
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === 'AbortError') {
          logger.error('Chat', 'Request timed out after 2 minutes');
        } else {
          logger.error('Chat', 'Failed to send message', e);
        }
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.chat.history.path] });
    },
    onError: (error) => {
      logger.error('Chat', 'Mutation failed', error);
    },
  });
}
