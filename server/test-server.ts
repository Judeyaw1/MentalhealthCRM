import express from 'express';

const app = express();

// Basic middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    cwd: process.cwd()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test server is working!',
    timestamp: new Date().toISOString()
  });
});

// Catch-all
app.use('*', (req, res) => {
  res.json({ 
    message: 'Server is running',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Test server running on port ${port}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ Working directory: ${process.cwd()}`);
});
