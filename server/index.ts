import dotenv from 'dotenv';
dotenv.config();

// Enhanced logging for production debugging
console.log('=== SERVER STARTUP ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

console.log('MONGODB_URI:', process.env.MONGODB_URI ? '***set***' : '***missing***');
console.log('Current working directory:', process.cwd());

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

// Basic middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

(async () => {
  try {
    console.log('=== STARTING SERVER ===');
    
    // Connect to MongoDB before starting the server
    console.log('Connecting to MongoDB...');
    await connectToMongo();
    console.log('✅ MongoDB connected successfully');
    
    storage.setDatabase(mongoose.connection.db);
    console.log('✅ Storage initialized');

    const server = await registerRoutes(app);
    console.log('✅ Routes registered');
    
    // Setup WebSocket server
    const io = setupSocketServer(server);
    console.log('✅ WebSocket server setup');
    
    // Make io available globally for routes
    (global as any).io = io;

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error('❌ Error middleware caught:', err);
      res.status(status).json({ message });
    });

    // Setup static serving based on environment
    if (app.get("env") === "development") {
      console.log('Setting up Vite for development...');
      await setupVite(app, server);
    } else {
      console.log('Setting up static serving for production...');
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

    // Auto-update appointment statuses
    const updateAppointmentStatuses = async () => {
      try {
        const { AppointmentStatusService } = await import('./appointmentStatusService');
        const updatedCount = await AppointmentStatusService.updateAppointmentStatuses();
        if (updatedCount > 0) {
          log(`🔄 Auto-updated ${updatedCount} appointment statuses`);
        }
      } catch (error) {
        log(`❌ Appointment status update error: ${error}`);
      }
    };

    // Run cleanup every 6 hours
    setInterval(cleanupOldNotes, 6 * 60 * 60 * 1000);
    
    // Run initial cleanup after 1 minute
    setTimeout(cleanupOldNotes, 60 * 1000);

    // Run appointment status updates every hour
    setInterval(updateAppointmentStatuses, 60 * 60 * 1000);
    
    // Run initial appointment status update after 2 minutes
    setTimeout(updateAppointmentStatuses, 2 * 60 * 1000);

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
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
})();
