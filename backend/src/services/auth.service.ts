import { v4 as uuidv4 } from 'uuid';
import { hashPassword, comparePassword, hashToken } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { UnauthorizedError, ConflictError, NotFoundError } from '../errors/AppError';
import * as repo from '../repositories/auth.repository';
import type { Usuario } from '../types';
import type { RegisterInput, LoginInput } from '../schemas/auth.schema';

const REFRESH_EXPIRES_DAYS = 7;

export interface AuthResult {
  user: Pick<Usuario, 'id' | 'nome' | 'email' | 'empresa_id'>;
  accessToken: string;
  refreshToken: string;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function buildExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_EXPIRES_DAYS);
  return d;
}

async function issueTokenPair(user: Usuario): Promise<{ accessToken: string; refreshToken: string }> {
  const jti = uuidv4();

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    empresa_id: user.empresa_id,
  });

  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await repo.saveRefreshToken({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: buildExpiresAt(),
  });

  return { accessToken, refreshToken };
}

function toPublicUser(user: Usuario): Pick<Usuario, 'id' | 'nome' | 'email' | 'empresa_id'> {
  return { id: user.id, nome: user.nome, email: user.email, empresa_id: user.empresa_id };
}

// ─── Casos de uso públicos ────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<AuthResult> {
  const exists = await repo.emailExists(input.email);
  if (exists) throw new ConflictError('E-mail já cadastrado');

  const senha_hash = await hashPassword(input.senha);
  const user = await repo.createUser({ nome: input.nome, email: input.email, senha_hash });

  const { accessToken, refreshToken } = await issueTokenPair(user);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const userDb = await repo.findUserByEmail(input.email);

  // Timing-safe: executa comparePassword mesmo se usuário não existe para evitar timing attack
  const isValid = userDb
    ? await comparePassword(input.senha, userDb.senha_hash)
    : await comparePassword(input.senha, '$2b$12$invalidsaltthatmakesitlooklike'); // dummy

  if (!userDb || !isValid) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  const { accessToken, refreshToken } = await issueTokenPair(userDb);
  return { user: toPublicUser(userDb), accessToken, refreshToken };
}

export async function refreshTokens(
  rawToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // 1. Verifica assinatura JWT
  const payload = verifyRefreshToken(rawToken);

  // 2. Verifica no banco: não revogado, não expirado
  const tokenHash = hashToken(rawToken);
  const stored = await repo.findActiveRefreshToken(tokenHash);
  if (!stored) throw new UnauthorizedError('Refresh token inválido ou revogado');

  // 3. Valida que o sub do JWT bate com o user_id no banco (contra substituição)
  if (stored.user_id !== payload.sub) {
    throw new UnauthorizedError('Refresh token inválido');
  }

  // 4. Rotação: revoga o token atual antes de emitir o novo
  await repo.revokeRefreshToken(tokenHash);

  const user = await repo.findUserById(payload.sub);
  if (!user) throw new NotFoundError('Usuário');

  return issueTokenPair(user);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await repo.revokeRefreshToken(tokenHash);
}
