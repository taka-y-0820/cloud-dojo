export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

export const ROUTES = {
  HOME: '/',
  DOCKER: '/docker',
  COMPOSE: '/compose',
  KUBERNETES: '/kubernetes',
  CICD: '/cicd',
  LOGS: '/logs',
  LEARNING: '/learning',
} as const;

export const AI_CONFIG = {
  MAX_CONTEXT_LENGTH: 4000,
  STREAM_ENABLED: true,
} as const;
