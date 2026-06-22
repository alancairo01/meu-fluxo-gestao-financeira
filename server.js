/**
 * Servidor local sem dependências para rodar o Meu Fluxo.
 * Execute: npm run dev
 * Depois acesse: http://localhost:3000
 */
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

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(ROOT, `.${requestedPath}`);

    if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
      return send(res, 403, 'Acesso negado.');
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        return send(res, 404, 'Arquivo não encontrado.');
      }

      const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch (error) {
    send(res, 500, 'Erro interno ao iniciar a aplicação.');
  }
});

server.listen(PORT, () => {
  console.log(`\nMeu Fluxo está rodando em: http://localhost:${PORT}`);
  console.log('Para encerrar, pressione Ctrl + C.\n');
});
