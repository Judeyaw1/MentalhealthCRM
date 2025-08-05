import dotenv from 'dotenv';
dotenv.config();
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***set***' : '***missing***');
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { connectToMongo } from "./mongo";
import mongoose from "mongoose";
import { storage } from "./storage";
import { PatientNote } from "./models/PatientNote";
import { setupSocketServer } from "./socket";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Connect to MongoDB before starting the server
  await connectToMongo();
  storage.setDatabase(mongoose.connection.db);

  const server = await registerRoutes(app);
  
  // Setup WebSocket server
  const io = setupSocketServer(server);
  
  // Make io available globally for routes
  (global as any).io = io;

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Auto-cleanup function for old notes
  const cleanupOldNotes = async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await PatientNote.deleteMany({
        createdAt: { $lt: oneDayAgo }
      });

      if (result.deletedCount > 0) {
        log(`🧹 Auto-cleanup: Removed ${result.deletedCount} old notes (older than 24 hours)`);
      }
    } catch (error) {
      log(`❌ Auto-cleanup error: ${error}`);
    }
  };

  // Run cleanup every 6 hours
  setInterval(cleanupOldNotes, 6 * 60 * 60 * 1000);
  
  // Run initial cleanup after 1 minute
  setTimeout(cleanupOldNotes, 60 * 1000);

  // Serve the app on port 3000 for local development
  const port = process.env.PORT || 3000;
  server.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      log(`🧹 Auto-cleanup scheduled: every 6 hours, removes notes older than 24 hours`);
    },
  );
})();
