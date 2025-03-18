const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Add body parsing middleware
app.use(express.json());

// Health check endpoint
app.get('/api/cohere/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Proxy middleware configuration
const proxyOptions = {
  target: 'https://api.cohere.ai',
  changeOrigin: true,
  pathRewrite: {
    '^/api/cohere/chat': '/v1/chat',
    '^/api/cohere': '/v1'
  },
  onProxyReq: (proxyReq, req, res) => {
    // Forward the Authorization header from the client request
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    
    // If there's a body, we need to rewrite it to the proxy
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
    
    // Log request for debugging
    console.log('Proxying request to Cohere API:', {
      path: proxyReq.path,
      method: proxyReq.method,
      hasAuth: !!req.headers.authorization,
      hasBody: !!req.body
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log response for debugging
    console.log('Received response from Cohere API:', {
      status: proxyRes.statusCode,
      statusMessage: proxyRes.statusMessage,
      path: req.path
    });
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(500).json({ 
      error: 'Failed to connect to Cohere API',
      details: err.message 
    });
  }
};

// Apply proxy middleware
app.use('/api/cohere', createProxyMiddleware(proxyOptions));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server with error handling
const startServer = (port) => {
  const MAX_PORT = 3010; // Maximum port to try
  let attempts = 0;
  const MAX_ATTEMPTS = 1; // Only try once per port
  
  if (port > MAX_PORT) {
    console.error(`Could not find an available port between ${PORT} and ${MAX_PORT}`);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use. Trying next port...`);
      server.listen(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  // Remove any existing listeners to prevent memory leaks
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');

  // Add new listeners
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
};

// Start the server
startServer(PORT);

// Remove the root URL route
// app.get('/', (req, res) => {
//   res.send('Welcome to the server!');
// }); 