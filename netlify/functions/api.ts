/**
 * Netlify Function: exposes the backend Express app as a serverless handler.
 *
 * The backend exports `app` from backend/src/app.ts (no `listen()` there —
 * the standalone server lives in backend/src/index.ts). Netlify bundles
 * this TypeScript file (and the backend it imports) with esbuild.
 *
 * Prefix handling: Netlify invokes this function at
 * `/.netlify/functions/api/...` (see the /api/* redirect in netlify.toml),
 * while the Express app mounts its routes at `/api` and `/health`. The
 * wrapper below strips the `/.netlify/functions/api` prefix defensively
 * and re-adds `/api` for API paths, so both the Netlify path and a direct
 * `/api/...` path work. Direct `/health` calls pass through untouched.
 *
 * Prisma: the backend's Prisma client is generated at build time by the
 * `prisma generate` step in netlify.toml, and the function resolves it
 * from backend/node_modules (installed by the same build command).
 */
import express from 'express';
import serverless from 'serverless-http';
import { app } from '../../backend/src/app';

const FUNCTION_PREFIX = '/.netlify/functions/api';

const wrapper = express();

// Strip the Netlify function prefix before the backend app sees the URL.
wrapper.use((req, _res, next) => {
  if (req.url.startsWith(FUNCTION_PREFIX)) {
    let rest = req.url.slice(FUNCTION_PREFIX.length);
    if (!rest.startsWith('/')) rest = `/${rest}`;
    // The redirect maps /api/* -> /<splat> and /health -> /health, so the
    // remainder is the path after /api (or /health itself).
    if (rest === '/health' || rest.startsWith('/health?') || rest.startsWith('/health/')) {
      req.url = rest;
    } else if (rest.startsWith('/api')) {
      req.url = rest;
    } else {
      req.url = `/api${rest}`;
    }
  }
  next();
});

wrapper.use(app);

export const handler = serverless(wrapper);
