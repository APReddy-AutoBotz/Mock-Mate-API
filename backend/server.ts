// backend/server.ts
// MockMate backend — minimal, production-safe starter with Gemini Live token route

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// ---- tiny in-memory rate limiter (no external deps) ----
type Bucket = { tokens: number; ts: number };
const buckets = new Map<string, Bucket>();
function rateLimitSimple({ max = 20, windowMs = 60_000 }: { max?: number; windowMs?: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.headers['x-forwarded-for']?.toString() || 'anon';
    const now = Date.now();
    const b = buckets.get(key) || { tokens: max, ts: now };
    if (now - b.ts > windowMs) {
      b.tokens = max;
      b.ts = now;
    }
    if (b.tokens <= 0) return res.status(429).send('Too many requests');
    b.tokens -= 1;
    buckets.set(key, b);
    next();
  };
}

// ---- Node fetch fallback for older Node (<18) ----
const httpFetch: typeof fetch = (global as any).fetch
  ? (global as any).fetch
  : (async (...args: any[]) => {
      const mod = await import('node-fetch');
      // @ts-ignore
      return mod.default(...args);
    }) as any;

// ---- app init ----
const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// CORS allow-list (comma separated)
const allow =
  (process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean)) ||
  ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allow.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// ---------- Health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ---------- Gemini Live: Ephemeral token ----------
const liveTokenLimiter = rateLimitSimple({ max: 20, windowMs: 60_000 });

app.post('/ephemeral-token', liveTokenLimiter, async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).send('missing GOOGLE_API_KEY');

    // Must match the Live model you open over WebSocket from the browser
    const model = 'gemini-live-2.5-flash-preview-native-audio';

    const url = `https://generativelanguage.googleapis.com/v1beta/tokens:generate?key=${apiKey}`;
    const r = await httpFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });

    const j: any = await r.json(); // { token, expireTime }
    if (!r.ok || !j?.token) {
      return res.status(500).json({ error: 'token fetch failed', details: j || null });
    }
    // Return plain text for easy use in the frontend
    res.type('text/plain').send(j.token);
  } catch (err) {
    res.status(500).send('token error');
  }
});

// ---------- Optional: mount your existing routes if present ----------
try {
  // If you have backend/routes/index.ts exporting a router as default
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const routes = require('./routes').default || require('./routes/index').default;
  app.use('/api', routes);
  console.log('Mounted existing routes under /api');
} catch {
  // No custom routes found — ignore
}

// ---------- Optional: Swagger at /api-docs if you have swagger deps ----------
try {
  // lazy-require to avoid hard dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swaggerUi = require('swagger-ui-express');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const swaggerJsdoc = require('swagger-jsdoc');

  const spec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: { title: 'MockMate API', version: '1.0.0' },
      servers: [{ url: `http://localhost:${PORT}` }],
    },
    apis: [], // add globs if you want to scan JSDoc from routes
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
  console.log('Swagger UI available at /api-docs');
} catch {
  // swagger packages not installed; skip silently
}

// ---------- 404 & error handler ----------
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Server Error' });
});

// ---------- start ----------
app.listen(PORT, () => {
  console.log(`MockMate backend running on http://localhost:${PORT}`);
  console.log('Health:         GET  /api/health');
  console.log('Live token:     POST /ephemeral-token');
  console.log('Docs (optional):     /api-docs');
});
