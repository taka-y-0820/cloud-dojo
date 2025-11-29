import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const getEnv = (key: string, defaultValue: string = ''): string => {
  return process.env[key] || defaultValue;
};

const getEnvInt = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

export const config = {
  port: getEnvInt('API_PORT', 4000),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  
  database: {
    url: getEnv('DATABASE_URL'),
  },
  
  redis: {
    url: getEnv('REDIS_URL', 'redis://localhost:6379'),
  },
  
  jwt: {
    secret: getEnv('JWT_SECRET', 'change-me-in-production'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
  },
  
  cors: {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:3000').split(',').map(o => o.trim()),
  },
  
  ai: {
    apiKey: getEnv('ANTHROPIC_API_KEY'),
    model: getEnv('AI_MODEL', 'claude-3-5-sonnet-20241022'),
    maxTokens: getEnvInt('AI_MAX_TOKENS', 4096),
  },
  
  worker: {
    url: getEnv('WORKER_URL', 'http://localhost:5000'),
  },
} as const;
