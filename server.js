const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

function sendResponse(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { 'Cache-Control': 'no-store', ...headers });
  response.end(body);
}

function resolveRequestPath(requestUrl, host) {
  const url = new URL(requestUrl, `http://${host || 'localhost'}`);
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  return path.resolve(ROOT, `.${requestedPath}`);
}

function isInsideApplicationRoot(filePath) {
  return filePath.startsWith(ROOT + path.sep) || filePath === ROOT;
}

function serveStaticFile(filePath, response) {
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendResponse(response, 404, 'Arquivo não encontrado.');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  try {
    const filePath = resolveRequestPath(request.url, request.headers.host);
    if (!isInsideApplicationRoot(filePath)) {
      sendResponse(response, 403, 'Acesso negado.');
      return;
    }
    serveStaticFile(filePath, response);
  } catch {
    sendResponse(response, 500, 'Erro interno ao iniciar a aplicação.');
  }
});

server.listen(PORT, () => {
  console.log(`\nMeu Fluxo está rodando em: http://localhost:${PORT}`);
  console.log('Para encerrar, pressione Ctrl + C.\n');
});
