import type { Request, Response, CookieOptions } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { UnauthorizedError } from '../errors/AppError';
import { env } from '../config/env';
import * as authService from '../services/auth.service';
import type { RegisterInput, LoginInput } from '../schemas/auth.schema';

const COOKIE_NAME = 'refresh_token';

const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
  path: '/api/v1/auth',
};

const CLEAR_OPTS: CookieOptions = {
  ...COOKIE_OPTS,
  maxAge: 0,
};

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
}

function getRefreshCookie(req: Request): string | undefined {
  return (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.register(
    req.body as RegisterInput,
  );
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ access_token: accessToken, user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body as LoginInput);
  setRefreshCookie(res, refreshToken);
  res.json({ access_token: accessToken, user });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = getRefreshCookie(req);
  if (!rawToken) throw new UnauthorizedError('Refresh token ausente');

  const { accessToken, refreshToken } = await authService.refreshTokens(rawToken);
  setRefreshCookie(res, refreshToken);
  res.json({ access_token: accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = getRefreshCookie(req);
  await authService.logout(rawToken);
  res.clearCookie(COOKIE_NAME, CLEAR_OPTS);
  res.status(204).end();
});
