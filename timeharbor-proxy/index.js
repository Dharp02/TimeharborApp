const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';

const server = http.createServer((req, res) => {
  // Log the request for debugging
  console.log(`${req.method} ${req.url}`);

  if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
    // Strip /api prefix only if it starts with /api
    if (req.url.startsWith('/api')) {
      req.url = req.url.replace(/^\/api/, '');
      if (req.url === '') req.url = '/';
    }
    
    // Proxy to backend
    proxy.web(req, res, { target: BACKEND_URL }, (err) => {
      console.error('Backend proxy error:', err);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway: Backend not reachable');
      }
    });
  } else {
    // Proxy to frontend
    proxy.web(req, res, { target: FRONTEND_URL }, (err) => {
      console.error('Frontend proxy error:', err);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway: Frontend not reachable');
      }
    });
  }
});

// Handle upgrade for websockets (if needed, e.g. for Next.js HMR)
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/socket.io')) {
    // Correctly strip /api prefix for WebSocket upgrades as well
    if (req.url.startsWith('/api')) {
      req.url = req.url.replace(/^\/api/, '');
      if (req.url === '') req.url = '/';
    }
    proxy.ws(req, socket, head, { target: BACKEND_URL });
  } else {
    proxy.ws(req, socket, head, { target: FRONTEND_URL });
  }
});

const PORT = process.env.PORT || 80;

server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
