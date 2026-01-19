import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { logger } from "./logger";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === SCENARIOS ===
  app.get(api.scenarios.list.path, async (_req, res) => {
    logger.debug('Routes', 'Fetching scenarios list');
    const scenarios = storage.getScenarios();
    res.json(scenarios);
  });

  app.post(api.scenarios.load.path, async (req, res) => {
    try {
      const { scenarioId } = api.scenarios.load.input.parse(req.body);
      logger.info('Routes', `Loading scenario: ${scenarioId}`);
      const session = await storage.createSession(scenarioId);
      logger.info('Routes', `Session created: ${session.id}`);
      res.status(201).json(session);
    } catch (e) {
      logger.error('Routes', 'Failed to load scenario', e);
      res.status(400).json({ message: "Invalid scenario ID" });
    }
  });

  // === SIMULATION STATE ===
  app.get(api.simulation.state.path, async (_req, res) => {
    try {
      const session = await storage.getCurrentSession();
      if (!session) {
        return res.status(404).json({ message: "No active simulation" });
      }
      
      const buckets = await storage.getBuckets(session.id);
      const logs = await storage.getLogs(session.id);
      
      res.json({ session, buckets, logs });
    } catch (e) {
      logger.error('Routes', 'Failed to get simulation state', e);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.simulation.orchestrate.path, async (_req, res) => {
    try {
      const session = await storage.getCurrentSession();
      if (!session) return res.status(404).json({ message: "No active session" });
      
      logger.info('Routes', `Starting orchestration for session ${session.id}`);
      await storage.runOrchestration(session.id);
      const logs = await storage.getLogs(session.id);
      logger.info('Routes', `Orchestration completed for session ${session.id}`);
      res.json({ success: true, logs });
    } catch (e) {
      logger.error('Routes', 'Orchestration failed', e);
      res.status(500).json({ message: "Orchestration failed" });
    }
  });

  app.post(api.simulation.book.path, async (req, res) => {
    try {
      const { bucketCode, quantity } = api.simulation.book.input.parse(req.body);
      const session = await storage.getCurrentSession();
      if (!session) return res.status(404).json({ message: "No active session" });

      logger.info('Routes', `Booking request: ${quantity} seats in ${bucketCode}`);
      const success = await storage.bookTicket(session.id, bucketCode, quantity);
      if (success) {
        logger.info('Routes', `Booking confirmed, triggering repricing`);
        await storage.runOrchestration(session.id);
        res.json({ success: true, message: "Booking confirmed" });
      } else {
        logger.warn('Routes', `Booking failed: Not enough seats in ${bucketCode}`);
        res.status(400).json({ message: "Booking failed: Not enough seats" });
      }
    } catch (e) {
      logger.error('Routes', 'Booking request failed', e);
      res.status(400).json({ message: "Invalid booking request" });
    }
  });

  // === CHAT ===
  app.get(api.chat.history.path, async (_req, res) => {
    try {
      const session = await storage.getCurrentSession();
      if (!session) return res.json([]);
      const history = await storage.getChatHistory(session.id);
      res.json(history);
    } catch (e) {
      logger.error('Routes', 'Failed to get chat history', e);
      res.status(500).json({ message: "Failed to get chat history" });
    }
  });

  app.post(api.chat.send.path, async (req, res) => {
    try {
      const { message } = api.chat.send.input.parse(req.body);
      const session = await storage.getCurrentSession();
      if (!session) return res.status(404).json({ message: "No active session" });
      
      logger.info('Routes', `Chat message received: "${message.substring(0, 50)}..."`);
      const response = await storage.processChatMessage(session.id, message);
      logger.info('Routes', `Chat response generated: ${response.length} chars`);
      res.json({ response });
    } catch (e) {
      // Check if it's a validation error (Zod) - return 400
      if (e instanceof Error && e.name === 'ZodError') {
        logger.warn('Routes', 'Invalid chat message format', e);
        return res.status(400).json({ message: "Invalid message format" });
      }
      // Otherwise it's a server error - return 500
      logger.error('Routes', 'Chat message processing failed', e);
      res.status(500).json({ message: "Chat processing failed" });
    }
  });

  app.post(api.chat.clear.path, async (_req, res) => {
    try {
      const session = await storage.getCurrentSession();
      if (!session) return res.status(404).json({ message: "No active session" });
      
      await storage.clearChat(session.id);
      logger.info('Routes', 'Chat history cleared');
      res.json({ success: true });
    } catch (e) {
      logger.error('Routes', 'Failed to clear chat', e);
      res.status(500).json({ message: "Failed to clear chat" });
    }
  });

  // === LOGS ===
  app.post(api.logs.clear.path, async (_req, res) => {
    try {
      const session = await storage.getCurrentSession();
      if (!session) return res.status(404).json({ message: "No active session" });
      
      await storage.clearLogs(session.id);
      logger.info('Routes', 'Agent logs cleared');
      res.json({ success: true });
    } catch (e) {
      logger.error('Routes', 'Failed to clear logs', e);
      res.status(500).json({ message: "Failed to clear logs" });
    }
  });

  // Seed initial session if needed
  const existing = await storage.getCurrentSession();
  if (!existing) {
    logger.info('Routes', 'Seeding initial session...');
    await storage.createSession("ipl-season");
  }

  return httpServer;
}
