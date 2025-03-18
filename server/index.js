require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Proxy middleware options
const options = {
  target: 'https://api.cohere.ai',
  changeOrigin: true,
  pathRewrite: {
    '^/api/cohere/chat': '/v1/chat',
    '^/api/cohere': '/v1',
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('Proxying request to Cohere API:', {
      path: req.path,
      method: req.method,
      hasAuth: !!req.headers.authorization,
      hasBody: !!req.body,
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('Received response from Cohere API:', {
      status: proxyRes.statusCode,
      statusMessage: proxyRes.statusMessage,
      path: req.path,
    });
  },
};

// Create the proxy middleware
const cohereProxy = createProxyMiddleware(options);

// Use the proxy for /api/cohere routes
app.use('/api/cohere', cohereProxy);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  // Catch-all route for client-side routing in production
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// For local development
if (process.env.NODE_ENV === 'development') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the Express app for Vercel
module.exports = app; 