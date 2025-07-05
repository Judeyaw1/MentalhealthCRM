import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Extend session interface for local development
declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Simple local session store for development
const MemoryStore = session.MemoryStore;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  return session({
    secret: process.env.SESSION_SECRET || "local-dev-secret",
    store: new MemoryStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to false for local development
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Simple login page for local development
  app.get("/api/login", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Login - NewLife CRM</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; }
            input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
            button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h2>Sign In to NewLife CRM</h2>
          <form id="loginForm">
            <div class="form-group">
              <label for="email">Email:</label>
              <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
              <label for="password">Password:</label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Sign In</button>
          </form>
          <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: formData.get('email'),
                  password: formData.get('password')
                })
              });
              if (response.ok) {
                window.location.href = '/';
              } else {
                alert('Login failed. Please try again.');
              }
            });
          </script>
        </body>
      </html>
    `);
  });

  // Simple login endpoint for local development
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    
    try {
      // Check if user exists
      let user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Check if this is the first user (make them admin)
        const allUsers = await storage.getStaff();
        if (allUsers.length === 0) {
          // First user, create as admin
          user = await storage.createUser({
            email: email,
            firstName: "Admin",
            lastName: "User",
            role: "admin",
            password: password
          });
        } else {
          return res.status(401).json({ message: "Invalid email or password" });
        }
      } else {
        // User exists, verify password
        if (user.password !== password) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
      }
      
      req.session.userId = user.id;
      res.json({ 
        success: true, 
        user,
        forcePasswordChange: user.forcePasswordChange || false
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/me", async (req, res) => {
    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      res.json(user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (req.session.userId) {
    const user = await storage.getUser(req.session.userId);
    if (user) {
      (req as any).user = user;
      return next();
    }
  }
  
  // No valid session, require login
  return res.status(401).json({ message: "Authentication required" });
};
