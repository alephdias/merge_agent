import 'dotenv/config';
import { env } from './src/config/env';
import { createApp } from './src/app';
import { checkDbConnection } from './src/config/database';
import { logger } from './src/utils/logger';

async function bootstrap(): Promise<void> {
  await checkDbConnection();

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, '🚀 Servidor iniciado');
  });
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, 'Falha fatal ao iniciar o servidor');
  process.exit(1);
});
