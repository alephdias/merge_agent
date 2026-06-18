import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

export const BUCKET = env.SUPABASE_STORAGE_BUCKET;

export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType = 'text/plain',
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Storage upload falhou: ${error.message}`);
}

export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Storage download falhou: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Storage delete falhou: ${error.message}`);
}
