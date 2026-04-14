type AuthDebugLevel = 'info' | 'warn' | 'error';

function shouldLog() {
  return String(import.meta.env.VITE_AUTH_DEBUG || 'true').toLowerCase() === 'true';
}

export function authDebug(level: AuthDebugLevel, event: string, details?: Record<string, unknown>) {
  if (!shouldLog()) return;
  const message = `[auth:${event}]`;
  if (level === 'error') {
    console.error(message, details || {});
    return;
  }
  if (level === 'warn') {
    console.warn(message, details || {});
    return;
  }
  console.info(message, details || {});
}
