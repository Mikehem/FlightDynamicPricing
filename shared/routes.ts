import { z } from 'zod';
import { insertSessionSchema, sessions, buckets, reasoningLogs, chatMessages } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  scenarios: {
    list: {
      method: 'GET' as const,
      path: '/api/scenarios',
      responses: {
        200: z.array(z.object({
          id: z.string(),
          name: z.string(),
          description: z.string()
        })),
      },
    },
    load: {
      method: 'POST' as const,
      path: '/api/scenarios/load',
      input: z.object({
        scenarioId: z.string(),
      }),
      responses: {
        201: z.custom<typeof sessions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  simulation: {
    state: {
      method: 'GET' as const,
      path: '/api/simulation/state',
      responses: {
        200: z.object({
          session: z.custom<typeof sessions.$inferSelect>(),
          buckets: z.array(z.custom<typeof buckets.$inferSelect>()),
          logs: z.array(z.custom<typeof reasoningLogs.$inferSelect>()),
        }),
        404: errorSchemas.notFound,
      },
    },
    orchestrate: {
      method: 'POST' as const,
      path: '/api/simulation/orchestrate',
      // Trigger a round of agent thinking
      responses: {
        200: z.object({
          success: z.boolean(),
          logs: z.array(z.custom<typeof reasoningLogs.$inferSelect>()),
        }),
      },
    },
    book: {
      method: 'POST' as const,
      path: '/api/simulation/book',
      input: z.object({
        bucketCode: z.string(), // e.g. ECO_1
        quantity: z.number().min(1),
      }),
      responses: {
        200: z.object({
          success: z.boolean(),
          message: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
  },
  chat: {
    history: {
      method: 'GET' as const,
      path: '/api/chat/history',
      responses: {
        200: z.array(z.custom<typeof chatMessages.$inferSelect>()),
      },
    },
    send: {
      method: 'POST' as const,
      path: '/api/chat/send',
      input: z.object({
        message: z.string(),
      }),
      responses: {
        200: z.object({
          response: z.string(),
        }),
      },
    },
  },
};
