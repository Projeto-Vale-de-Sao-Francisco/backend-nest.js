import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie.js';

export function hasAllowedSessionOrigin(
  request: Pick<Request, 'method' | 'path' | 'headers' | 'get'>,
  allowedOrigins: Set<string>,
): boolean {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    request.method.toUpperCase(),
  );
  const hasSessionCookie = request.headers.cookie
    ?.split(';')
    .some((cookie) =>
      cookie.trim().startsWith(`${SESSION_COOKIE_NAME}=`),
    );
  if (!isMutation || (!hasSessionCookie && request.path !== '/auth/login')) {
    return true;
  }

  const origin = request.get('origin');
  return !!origin && allowedOrigins.has(origin);
}
