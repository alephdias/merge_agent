import { env } from '../config/env';
import { logger } from '../utils/logger';

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-code-3'; // Modelo específico para código-fonte

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: 'document',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage AI ${res.status}: ${body}`);
  }

  const json = (await res.json()) as VoyageResponse;
  logger.debug({ tokens: json.usage.total_tokens, count: texts.length }, 'RAG: embedding gerado');
  return json.data.map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  const first = results[0];
  if (!first) throw new Error('Voyage AI retornou embedding vazio');
  return first;
}
