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

// Full scenario environment schema
const scenarioEnvironmentSchema = z.object({
  route: z.string(),
  airline: z.string(),
  aircraft: z.string(),
  totalSeats: z.number(),
  bookingWindow: z.number(),
  daysToDeparture: z.number(),
  daysElapsed: z.number(),
  currentDate: z.string(),
  departureDate: z.string(),
  fuelCostIndex: z.number(),
  seasonalityIndex: z.number(),
  baseDemand: z.number(),
  competitorAggressiveness: z.number(),
  competitors: z.array(z.object({ name: z.string(), basePrice: z.number() })),
  eventImpact: z.string().nullable(),
  weatherForecast: z.string(),
  revenueTarget: z.number(),
  occupancyTarget: z.number(),
});

const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  environment: scenarioEnvironmentSchema,
});

export const api = {
  scenarios: {
    list: {
      method: 'GET' as const,
      path: '/api/scenarios',
      responses: {
        200: z.array(scenarioSchema),
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
