import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === SCENARIOS ===
  app.get(api.scenarios.list.path, async (_req, res) => {
    const scenarios = storage.getScenarios();
    // Return full scenario data including environment
    res.json(scenarios);
  });

  app.post(api.scenarios.load.path, async (req, res) => {
    try {
      const { scenarioId } = api.scenarios.load.input.parse(req.body);
      const session = await storage.createSession(scenarioId);
      res.status(201).json(session);
    } catch (e) {
      res.status(400).json({ message: "Invalid scenario ID" });
    }
  });

  // === SIMULATION STATE ===
  app.get(api.simulation.state.path, async (_req, res) => {
    const session = await storage.getCurrentSession();
    if (!session) {
      return res.status(404).json({ message: "No active simulation" });
    }
    
    const buckets = await storage.getBuckets(session.id);
    const logs = await storage.getLogs(session.id);
    
    res.json({ session, buckets, logs });
  });

  app.post(api.simulation.orchestrate.path, async (_req, res) => {
    const session = await storage.getCurrentSession();
    if (!session) return res.status(404).json({ message: "No active session" });
    
    await storage.runOrchestration(session.id);
    const logs = await storage.getLogs(session.id);
    res.json({ success: true, logs });
  });

  app.post(api.simulation.book.path, async (req, res) => {
    try {
      const { bucketCode, quantity } = api.simulation.book.input.parse(req.body);
      const session = await storage.getCurrentSession();
      if (!session) return res.status(404).json({ message: "No active session" });

      const success = await storage.bookTicket(session.id, bucketCode, quantity);
      if (success) {
        // Trigger repricing on booking
        await storage.runOrchestration(session.id);
        res.json({ success: true, message: "Booking confirmed" });
      } else {
        res.status(400).json({ message: "Booking failed: Not enough seats" });
      }
    } catch (e) {
      res.status(400).json({ message: "Invalid booking request" });
    }
  });

  // === CHAT ===
  app.get(api.chat.history.path, async (_req, res) => {
    const session = await storage.getCurrentSession();
    if (!session) return res.json([]);
    const history = await storage.getChatHistory(session.id);
    res.json(history);
  });

  app.post(api.chat.send.path, async (req, res) => {
    try {
      const { message } = api.chat.send.input.parse(req.body);
      const session = await storage.getCurrentSession();
      if (!session) return res.status(404).json({ message: "No active session" });
      
      const response = await storage.processChatMessage(session.id, message);
      res.json({ response });
    } catch (e) {
      res.status(400).json({ message: "Invalid message" });
    }
  });

  // Seed initial session if needed
  const existing = await storage.getCurrentSession();
  if (!existing) {
    console.log("Seeding initial session...");
    await storage.createSession("ipl-season");
  }

  return httpServer;
}
