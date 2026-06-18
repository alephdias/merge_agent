import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { globalRateLimit } from './middleware/rateLimit.middleware';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';
import router from './routes';

export function createApp(): express.Application {
  const app = express();

  app.set('trust proxy', 1);

  // Cabeçalhos de segurança
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // CORS restrito a origins autorizadas
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin '${origin}' não autorizada pelo CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // Request ID para rastreabilidade em logs
  app.use(requestIdMiddleware);

  // Log de cada requisição recebida
  app.use((req, _res, next) => {
    logger.info(
      { requestId: req.requestId, method: req.method, url: req.url },
      'Requisição recebida',
    );
    next();
  });

  // Rate limit global
  app.use(globalRateLimit);

  // Health check — sem autenticação
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: env.NODE_ENV, ts: new Date().toISOString() });
  });

  // Rotas da API
  app.use('/api/v1', router);

  // Handler global de erros — deve ser o último middleware
  app.use(errorMiddleware);

  return app;
}
