import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_PORT:', process.env.SMTP_PORT);
console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***set***' : '***missing***');
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
// Import vite functions only in development
let setupVite: any, serveStatic: any, log: any;

// Initialize production fallbacks
log = (message: string, source = "express") => {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
};

serveStatic = (app: any) => {
  // In production, the built files are in dist/public
  const distPath = process.cwd() + "/dist/public";
  
  // Serve static files first - this must come before any catch-all routes
  app.use(express.static(distPath));
};

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
  const requestPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
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

// Main startup function with error handling
async function startServer() {
  try {
    console.log('🚀 Starting server...');
    console.log('📁 Current working directory:', process.cwd());
    console.log('🌍 Environment:', process.env.NODE_ENV);
    
    // Connect to MongoDB before starting the server
    console.log('🔌 Connecting to MongoDB...');
    await connectToMongo();
    console.log('✅ MongoDB connected successfully');
    
    storage.setDatabase(mongoose.connection.db);
    console.log('✅ Storage initialized');

    // Register routes first
    console.log('🛣️ Registering routes...');
    const server = await registerRoutes(app);
    console.log('✅ Routes registered successfully');
    
    // Setup static file serving AFTER routes but BEFORE the catch-all route
    if (process.env.NODE_ENV === "development") {
      // Import vite functions dynamically in development
      console.log('⚡ Setting up Vite for development...');
      const viteModule = await import("./vite");
      await viteModule.setupVite(app, server);
      console.log('✅ Vite setup complete');
    } else {
      // Serve static files from dist/public in production
      console.log('📁 Setting up static file serving for production...');
      const distPath = path.join(process.cwd(), 'dist', 'public');
      console.log('📂 Static files path:', distPath);
      
      // Check if the directory exists
      const fs = await import('fs');
      if (fs.existsSync(distPath)) {
        console.log('✅ Static files directory exists');
        app.use(express.static(distPath));
        console.log('✅ Static file middleware configured');
      } else {
        console.log('❌ Static files directory not found:', distPath);
      }
      
      // Add catch-all route for SPA in production (AFTER static file serving)
      app.get('*', (req, res) => {
        // Don't serve React app for API routes
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ message: 'API endpoint not found' });
        }
        
        // Serve the React app's index.html for SPA routes
        res.sendFile(path.join(process.cwd(), 'dist/public/index.html'));
      });
      console.log('✅ SPA catch-all route configured');
    }
    
    // Setup WebSocket server
    console.log('🔌 Setting up WebSocket server...');
    const io = setupSocketServer(server);
    console.log('✅ WebSocket server setup complete');
    
    // Make io available globally for routes
    (global as any).io = io;

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

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
    
    // For Railway, ensure we're accessible to the proxy
    const host = process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "localhost";
    
    server.listen(
      {
        port,
        host,
      },
      () => {
        log(`serving on port ${port} on ${host}`);
        log(`🧹 Auto-cleanup scheduled: every 6 hours, removes notes older than 24 hours`);
        console.log('🎉 Server started successfully!');
      },
    );
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
