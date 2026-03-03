const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';

// Add CORS headers so browser-based clients can read error responses
// even when the backend itself is down and the proxy returns a 5xx.
function addCorsHeaders(req, res) {
  const origin = req.headers['origin'] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

const server = http.createServer((req, res) => {
  // Log the request for debugging
  console.log(`${req.method} ${req.url}`);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    addCorsHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

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
        addCorsHeaders(req, res);
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway: Backend not reachable');
      }
    });
  } else {
    // Proxy to frontend.
    // Rewrite the Origin header so Next.js dev server does not treat
    // the request as cross-origin and block _next/* chunk responses.
    if (req.headers['origin']) {
      req.headers['origin'] = FRONTEND_URL;
    }
    proxy.web(req, res, { target: FRONTEND_URL, changeOrigin: true }, (err) => {
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
    // Rewrite origin so Next.js accepts the HMR WebSocket from a LAN IP
    if (req.headers['origin']) {
      req.headers['origin'] = FRONTEND_URL;
    }
    proxy.ws(req, socket, head, { target: FRONTEND_URL, changeOrigin: true });
  }
});

const PORT = process.env.PORT || 80;

server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
