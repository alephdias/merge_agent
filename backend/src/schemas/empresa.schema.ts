import { z } from 'zod';

export const createEmpresaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200).trim(),
  cnpj: z
    .string()
    .regex(/^\d{14}$/, 'CNPJ deve conter exatamente 14 dígitos numéricos')
    .optional()
    .nullable(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
    .min(2)
    .max(100)
    .optional()
    .nullable(),
});

export const updateEmpresaSchema = createEmpresaSchema.partial();

export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
export type UpdateEmpresaInput = z.infer<typeof updateEmpresaSchema>;
