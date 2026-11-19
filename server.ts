import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDatabaseConfigured } from './src/db/index.ts';
import adminRouter from './src/server/routes/admin.ts';
import authRouter from './src/server/routes/auth.ts';
import cratesRouter from './src/server/routes/crates.ts';
import mediaRouter from './src/server/routes/media.ts';
import postsRouter from './src/server/routes/posts.ts';
import socialRouter from './src/server/routes/social.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const portFlagIndex = process.argv.indexOf('--port');
  if (portFlagIndex !== -1 && process.argv[portFlagIndex + 1]) {
    const parsed = Number(process.argv[portFlagIndex + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.PORT);
  if (!Number.isNaN(envPort) && envPort > 0) return envPort;
  return 3000;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const port = resolvePort();
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'sona-hub',
      databaseConfigured: isDatabaseConfigured(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', postsRouter);
  app.use('/api', socialRouter);
  app.use('/api', cratesRouter);
  app.use('/api', adminRouter);
  app.use('/api', mediaRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`SONA server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SONA server:', err);
  process.exit(1);
});
