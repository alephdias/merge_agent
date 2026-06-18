import { z } from 'zod';

export const uploadFonteSchema = z.object({
  data_pacote: z.string().date('Data inválida — esperado YYYY-MM-DD').optional(),
  numero_pacote: z.string().max(100).trim().optional(),
  descricao: z.string().max(500).trim().optional(),
});

export type UploadFonteInput = z.infer<typeof uploadFonteSchema>;
