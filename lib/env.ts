import { z } from "zod";

const envSchema = z.object({
  IDDAS_API_BASE_URL: z.string().url().default("https://agencia.iddas.com.br/api/v1"),
  IDDAS_TOKEN_ENDPOINT: z.string().default("/auth/login"),
  IDDAS_ACCESS_KEY: z.string().min(1).optional(),
  IDDAS_SYNC_LOOKBACK_DAYS: z.coerce.number().int().positive().default(30),
  IDDAS_SYNC_MAX_PAGES: z.coerce.number().int().positive().default(50),
  IDDAS_SYNC_ORCAMENTOS_PER_PAGE: z.coerce.number().int().positive().max(100).default(100),
  IDDAS_SYNC_PESSOAS_PER_PAGE: z.coerce.number().int().positive().max(100).default(100),
  IDDAS_SYNC_VENDAS_PER_PAGE: z.coerce.number().int().positive().max(100).default(100),
});

export const env = envSchema.parse({
  IDDAS_API_BASE_URL: process.env.IDDAS_API_BASE_URL,
  IDDAS_TOKEN_ENDPOINT: process.env.IDDAS_TOKEN_ENDPOINT,
  IDDAS_ACCESS_KEY: process.env.IDDAS_ACCESS_KEY,
  IDDAS_SYNC_LOOKBACK_DAYS: process.env.IDDAS_SYNC_LOOKBACK_DAYS,
  IDDAS_SYNC_MAX_PAGES: process.env.IDDAS_SYNC_MAX_PAGES,
  IDDAS_SYNC_ORCAMENTOS_PER_PAGE: process.env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE,
  IDDAS_SYNC_PESSOAS_PER_PAGE: process.env.IDDAS_SYNC_PESSOAS_PER_PAGE,
  IDDAS_SYNC_VENDAS_PER_PAGE: process.env.IDDAS_SYNC_VENDAS_PER_PAGE,
});
