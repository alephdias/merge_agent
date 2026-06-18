import { query } from '../config/database';
import type { Usuario, UsuarioDb, RefreshToken } from '../types';

// ─── Usuários ─────────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<UsuarioDb | null> {
  const result = await query<UsuarioDb>(
    `SELECT id, nome, email, senha_hash, empresa_id, created_at
       FROM usuarios
      WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<Usuario | null> {
  const result = await query<Usuario>(
    `SELECT id, nome, email, empresa_id, created_at
       FROM usuarios
      WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createUser(data: {
  nome: string;
  email: string;
  senha_hash: string;
}): Promise<Usuario> {
  const result = await query<Usuario>(
    `INSERT INTO usuarios (nome, email, senha_hash)
     VALUES ($1, $2, $3)
     RETURNING id, nome, email, empresa_id, created_at`,
    [data.nome, data.email, data.senha_hash],
  );
  const user = result.rows[0];
  if (!user) throw new Error('Falha ao criar usuário no banco');
  return user;
}

export async function emailExists(email: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM usuarios WHERE email = $1) AS exists`,
    [email],
  );
  return result.rows[0]?.exists ?? false;
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export async function saveRefreshToken(data: {
  user_id: string;
  token_hash: string;
  expires_at: Date;
}): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [data.user_id, data.token_hash, data.expires_at],
  );
}

export async function findActiveRefreshToken(token_hash: string): Promise<RefreshToken | null> {
  const result = await query<RefreshToken>(
    `SELECT *
       FROM refresh_tokens
      WHERE token_hash = $1
        AND revoked = false
        AND expires_at > now()`,
    [token_hash],
  );
  return result.rows[0] ?? null;
}

export async function revokeRefreshToken(token_hash: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
    [token_hash],
  );
}

export async function revokeAllUserTokens(user_id: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = true
      WHERE user_id = $1 AND revoked = false`,
    [user_id],
  );
}
