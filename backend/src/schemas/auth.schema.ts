import { z } from 'zod';

export const registerSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100),
  email: z.string().email('E-mail inválido').toLowerCase().trim(),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(72),
});

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido').toLowerCase().trim(),
  senha: z.string().min(1, 'Senha é obrigatória'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
