import express from 'express';
import { connectToMongo } from './mongo';
import { registerRoutes } from './routes';
import { serveStatic } from './vite';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';

const app = express();
const server = createServer(app);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-vercel-domain.vercel.app'] // Update this with your Vercel domain
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Connect to database
connectToMongo();

// Register API routes
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://your-vercel-domain.vercel.app'] // Update this with your Vercel domain
      : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  }
});

// Make io available globally
(global as any).io = io;

// Register routes
registerRoutes(app);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  serveStatic(app);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const port = parseInt(process.env.PORT || '3000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ Working directory: ${process.cwd()}`);
});
