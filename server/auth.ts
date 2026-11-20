import crypto from 'node:crypto';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { ALLOWED_EXTENSIONS, config } from './config';
import { db, type UserRow } from './db';

const SESSION_COOKIE_NAME = 'cfss_session';
const CSRF_COOKIE_NAME = 'cfss_csrf';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export interface AuthenticatedRequest extends Request {
  user?: Omit<UserRow, 'password_hash'>;
}

function signValue(payload: string): string {
  const sig = crypto
    .createHmac('sha256', config.secretKey)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifySignedValue(token: string): string | null {
  const dotIdx = token.lastIndexOf('.');
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', config.secretKey)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  return payload;
}

function isHttpsRequest(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') {
    return true;
  }
  return Boolean(req.secure);
}

export function createSessionToken(userId: number): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  return signValue(payload);
}

export function issueSessionCookie(req: Request, res: Response, userId: number): string {
  const signed = createSessionToken(userId);
  const https = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  return signed;
}

export function clearSessionCookie(req: Request, res: Response): void {
  const https = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: https ? 'none' : 'lax',
    secure: https,
  });
}

export function issueCsrfToken(req: Request, res: Response): string {
  const existing = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof existing === 'string') {
    const verified = verifySignedValue(existing);
    if (verified) return existing;
  }
  const raw = crypto.randomBytes(24).toString('base64url');
  const signed = signValue(raw);
  const https = isHttpsRequest(req);
  res.cookie(CSRF_COOKIE_NAME, signed, {
    httpOnly: false,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  return signed;
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header('x-csrf-token');

  if (typeof headerToken !== 'string' || !verifySignedValue(headerToken)) {
    res.status(403).json({ error: 'Invalid or missing CSRF token. Refresh and retry.' });
    return;
  }

  // If the browser sent the CSRF cookie, enforce strict double-submit match
  if (typeof cookieToken === 'string' && cookieToken !== headerToken) {
    res.status(403).json({ error: 'CSRF token mismatch. Refresh and retry.' });
    return;
  }
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const authHeader = req.header('authorization');
  const bearerToken =
    typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : null;

  const rawToken = typeof cookieToken === 'string' ? cookieToken : bearerToken;
  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const verifiedPayload = verifySignedValue(rawToken);
  if (!verifiedPayload) {
    clearSessionCookie(req, res);
    res.status(401).json({ error: 'Invalid session signature.' });
    return;
  }

  try {
    const parsed = JSON.parse(Buffer.from(verifiedPayload, 'base64url').toString('utf8')) as {
      uid: number;
      exp: number;
    };
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) {
      clearSessionCookie(req, res);
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }

    const user = db
      .prepare('SELECT id, username, email, created_at FROM users WHERE id = ?')
      .get(parsed.uid) as Omit<UserRow, 'password_hash'> | undefined;

    if (!user) {
      clearSessionCookie(req, res);
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    clearSessionCookie(req, res);
    res.status(401).json({ error: 'Malformed session token.' });
  }
}

export function sanitizeFilename(rawName: string): string {
  const base = path.basename(rawName).replace(/\0/g, '');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^_+/, '');
  return cleaned || `file_${Date.now()}.bin`;
}

export function validateFileExtension(filename: string): { valid: boolean; ext: string } {
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx === -1 || dotIdx === filename.length - 1) {
    return { valid: false, ext: '' };
  }
  const ext = filename.slice(dotIdx + 1).toLowerCase();
  return { valid: ALLOWED_EXTENSIONS.has(ext), ext };
}
