import { z } from 'zod';

export const createMergeSchema = z.object({
  // empresa_id não vem do body para usuários comuns — é extraído do token no service.
  // Admins (empresa_id = null no token) podem especificar via body.
  empresa_id: z.string().uuid('empresa_id inválido').optional(),
  totvs_v_anterior_id: z.string().uuid('ID inválido').optional(),
  totvs_v_atual_id: z.string().uuid('ID inválido').optional(),
});

export const mergeIdSchema = z.object({
  id: z.string().uuid('ID de merge inválido'),
});

export type CreateMergeInput = z.infer<typeof createMergeSchema>;
