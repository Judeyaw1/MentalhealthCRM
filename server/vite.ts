import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config.ts";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Apply Vite middleware only to non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return vite.middlewares(req, res, next);
  });
  
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes
    if (url.startsWith('/api/')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        process.cwd(),
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Standard production static serving
  try {
    console.log("Setting up static serving for production...");
    console.log("Current working directory:", process.cwd());
    
    // Standard dist path for production builds
    const distPath = path.join(process.cwd(), "dist", "public");
    console.log("Looking for static files in:", distPath);
    
    // Check if dist directory exists
    if (!fs.existsSync(distPath)) {
      throw new Error(`Build directory not found at: ${distPath}`);
    }
    
    // List directory contents for debugging
    try {
      const contents = fs.readdirSync(distPath);
      console.log("Directory contents:", contents);
    } catch (e) {
      console.log("Could not read directory contents:", e);
    }
    
    // Serve static files
    app.use(express.static(distPath));
    console.log("Static files middleware added");

    // Serve index.html for all non-API routes
    app.use("*", (req, res) => {
      // Skip API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).send("API endpoint not found");
      }
      
      try {
        const indexPath = path.join(distPath, "index.html");
        console.log("Looking for index.html at:", indexPath);
        
        if (fs.existsSync(indexPath)) {
          console.log("Serving index.html");
          res.sendFile(indexPath);
        } else {
          console.log("index.html not found, sending fallback");
          res.status(404).send(`
            <html>
              <body>
                <h1>Application Not Found</h1>
                <p>The application files could not be found.</p>
                <p>Dist path: ${distPath}</p>
                <p>Current directory: ${process.cwd()}</p>
                <p>Requested path: ${req.path}</p>
              </body>
            </html>
          `);
        }
      } catch (error) {
        console.error("Error serving index.html:", error);
        res.status(500).send(`
          <html>
            <body>
              <h1>Server Error</h1>
              <p>Error serving application: ${error}</p>
            </body>
          </html>
        `);
      }
    });
    
    console.log("Static serving setup complete");
  } catch (error) {
    console.error("Error setting up static serving:", error);
    // Fallback: just send a basic response
    app.use("*", (_req, res) => {
      res.status(500).send(`
        <html>
          <body>
            <h1>Server Configuration Error</h1>
            <p>Error: ${error}</p>
            <p>Current directory: ${process.cwd()}</p>
          </body>
        </html>
      `);
    });
  }
}
