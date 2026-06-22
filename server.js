const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
loadLocalEnvironment();
const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

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
  '.txt': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8'
};

function loadLocalEnvironment() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || process.env[match[1]] !== undefined) return;
    const value = match[2].replace(/^['"]|['"]$/g, '');
    process.env[match[1]] = value;
  });
}

function sendResponse(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    ...headers
  });
  response.end(body);
}

function createContentSecurityPolicy() {
  const supabaseOrigin = isValidSupabaseUrl(SUPABASE_URL) ? new URL(SUPABASE_URL).origin : 'https://*.supabase.co';
  return [
    "default-src 'self'",
    `script-src 'self' https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${supabaseOrigin}`,
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return /^https:$/.test(url.protocol);
  } catch {
    return false;
  }
}

function resolveRequestPath(requestUrl, host) {
  const url = new URL(requestUrl, `http://${host || 'localhost'}`);
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  return { path: requestedPath, filePath: path.resolve(ROOT, `.${requestedPath}`) };
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
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': createContentSecurityPolicy()
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function serveRuntimeConfig(response) {
  const configured = isValidSupabaseUrl(SUPABASE_URL) && Boolean(SUPABASE_PUBLISHABLE_KEY);
  sendResponse(response, 200, JSON.stringify({
    configured,
    supabaseUrl: configured ? SUPABASE_URL : '',
    supabasePublishableKey: configured ? SUPABASE_PUBLISHABLE_KEY : ''
  }), {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Security-Policy': createContentSecurityPolicy()
  });
}

const server = http.createServer((request, response) => {
  try {
    const resolved = resolveRequestPath(request.url, request.headers.host);
    if (resolved.path === '/runtime-config.json') {
      serveRuntimeConfig(response);
      return;
    }
    if (resolved.path === '/health') {
      sendResponse(response, 200, JSON.stringify({ ok: true }), { 'Content-Type': 'application/json; charset=utf-8' });
      return;
    }
    if (!isInsideApplicationRoot(resolved.filePath)) {
      sendResponse(response, 403, 'Acesso negado.');
      return;
    }
    serveStaticFile(resolved.filePath, response);
  } catch {
    sendResponse(response, 500, 'Erro interno ao iniciar a aplicação.');
  }
});

server.listen(PORT, () => {
  console.log(`\nMeu Fluxo está rodando em: http://localhost:${PORT}`);
  console.log('Para encerrar, pressione Ctrl + C.\n');
});
