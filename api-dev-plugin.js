// Vite dev plugin: serves the api/ serverless functions locally.
// ---------------------------------------------------------------------------
// During `vite dev`, /api/* requests are forwarded to the live mediator by
// the proxy, but that mediator does NOT have the SkillSetu CRUD routes
// (students, opportunities, skills, etc.). This plugin adds a connect
// middleware that resolves each /api/<name> to the local api/<name>.js
// serverless function and calls its default handler(req, res).
//
// The handler must follow the Vercel convention:
//   export default async function handler(req, res) { ... }
//
// Environment variables from vercel.json are injected into process.env
// before any handler is imported, so the supabase client connects correctly.

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { parse as parseUrl } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load vercel.json env vars into process.env for the API handlers.
function loadVercelEnv() {
  const vercelPath = join(__dirname, 'vercel.json');
  if (!existsSync(vercelPath)) return;
  try {
    const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));
    if (vercel.env) {
      for (const [k, v] of Object.entries(vercel.env)) {
        if (process.env[k] === undefined || process.env[k] === '') {
          process.env[k] = v;
        }
      }
    }
  } catch { /* ignore */ }
}

// Handler cache: file path -> { handler, mtime }
const handlerCache = new Map();

async function loadHandler(filePath) {
  const { mtimeMs } = await import('fs').then((fs) => fs.statSync(filePath));
  const cached = handlerCache.get(filePath);
  if (cached && cached.mtime === mtimeMs) return cached.handler;

  // Bust the import cache by appending a timestamp query. Import with a
  // file:// URL so Windows absolute paths work with the ESM loader.
  const fileUrl = new URL(`file://${filePath.split('\\').join('/')}?t=${mtimeMs}`);
  const mod = await import(fileUrl.href);
  const handler = mod.default || mod.handler;
  handlerCache.set(filePath, { handler, mtime: mtimeMs });
  return handler;
}

/** Map /api/<name> to the absolute path of the serverless function file. */
function resolveApiPath(urlPath) {
  // Strip /api/ prefix and decode
  const rel = urlPath.replace(/^\/api\//, '').replace(/\/$/, '');
  if (!rel) return null;

  // Exact file match: api/students.js, api/career-match.js, etc.
  const exact = join(__dirname, 'api', `${rel}.js`);
  if (existsSync(exact)) return exact;

  // Nested: api/skills/verify.js
  const nested = join(__dirname, 'api', `${rel}`, 'index.js');
  if (existsSync(nested)) return nested;

  // Also try without the query suffix
  const clean = rel.split('?')[0];
  const cleanExact = join(__dirname, 'api', `${clean}.js`);
  if (existsSync(cleanExact)) return cleanExact;

  return null;
}

/** Convert a Node.js IncomingMessage to a Vercel-like req object. */
function toVercelReq(nodeReq, body) {
  const url = nodeReq.url || '/';
  const parsed = parseUrl(url, true);
  return {
    method: nodeReq.method || 'GET',
    url,
    headers: { ...nodeReq.headers },
    query: parsed.query || {},
    body: body || undefined,
  };
}

/** Collect the request body as a string or buffer. */
function collectBody(nodeReq) {
  return new Promise((resolve) => {
    const chunks = [];
    nodeReq.on('data', (c) => chunks.push(c));
    nodeReq.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
    });
    nodeReq.on('error', () => resolve(undefined));
  });
}

/**
 * Vite plugin that serves /api/* from the local api/ directory.
 */
export function apiDevPlugin() {
  // Load vercel.json env on plugin init.
  loadVercelEnv();

  return {
    name: 'skillsetu-api-dev',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = (req.url || '').split('?')[0];

        // Only intercept /api/* requests.
        if (!urlPath.startsWith('/api/')) return next();

        const filePath = resolveApiPath(urlPath);
        if (!filePath) return next(); // unknown route → fall through to proxy

        try {
          const handler = await loadHandler(filePath);
          if (!handler) return next();

          const body = await collectBody(req);
          const vReq = toVercelReq(req, body);

          // Vercel-like res object.
          let statusCode = 200;
          let bodyStr = '';
          let ended = false;

          const vRes = {
            status(code) { statusCode = code; return vRes; },
            setHeader() { return vRes; },
            json(data) {
              if (ended) return;
              ended = true;
              res.writeHead(statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(data));
            },
            end(data) {
              if (ended) return;
              ended = true;
              if (data) {
                res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
                res.end(data);
              } else {
                res.writeHead(statusCode);
                res.end();
              }
            },
          };

          await handler(vReq, vRes);
        } catch (err) {
          console.error(`[api-dev] Error in ${urlPath}:`);
          console.error(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Local dev handler error', detail: err.message || String(err) }));
        }
      });
    },
  };
}
