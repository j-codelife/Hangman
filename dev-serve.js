/* Simple static server for development
   - Serves files from ./frontend
   - Disables directory listings
   - Falls back to index.html for root
*/

const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, 'frontend');
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function send404(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => send404(res));
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  try {
    const reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    let filePath = path.join(ROOT, reqPath.replace(/^\/+/, ''));

    // If requesting root or a directory, serve index.html
    if (!reqPath || reqPath === '/' || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT, 'index.html');
    }

    if (!filePath.startsWith(ROOT)) {
      // Prevent directory traversal
      return send404(res);
    }

    if (!fs.existsSync(filePath)) return send404(res);

    sendFile(res, filePath);
  } catch (err) {
    console.error(err);
    send404(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dev static server serving ${ROOT} at http://${HOST}:${PORT}`);
});
