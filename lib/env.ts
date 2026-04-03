import { z } from "zod";

const envSchema = z.object({
  CLICKSIGN_API_KEY: z.string().min(1).optional(),
  CLICKSIGN_BASE_URL: z.string().url().default("https://sandbox.clicksign.com"),
  CLICKSIGN_CONTRATADA_SIGNER_BIRTH: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT: z.string().optional(),
  CLICKSIGN_CONTRATADA_SIGNER_EMAIL: z.string().email().optional(),
  CLICKSIGN_CONTRATADA_SIGNER_NAME: z.string().min(1).optional(),
  CLICKSIGN_CONTRATADA_SIGNER_PHONE: z.string().optional(),
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
  CLICKSIGN_API_KEY: process.env.CLICKSIGN_API_KEY,
  CLICKSIGN_BASE_URL: process.env.CLICKSIGN_BASE_URL,
  CLICKSIGN_CONTRATADA_SIGNER_BIRTH: process.env.CLICKSIGN_CONTRATADA_SIGNER_BIRTH,
  CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT: process.env.CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT,
  CLICKSIGN_CONTRATADA_SIGNER_EMAIL: process.env.CLICKSIGN_CONTRATADA_SIGNER_EMAIL,
  CLICKSIGN_CONTRATADA_SIGNER_NAME: process.env.CLICKSIGN_CONTRATADA_SIGNER_NAME,
  CLICKSIGN_CONTRATADA_SIGNER_PHONE: process.env.CLICKSIGN_CONTRATADA_SIGNER_PHONE,
  IDDAS_API_BASE_URL: process.env.IDDAS_API_BASE_URL,
  IDDAS_TOKEN_ENDPOINT: process.env.IDDAS_TOKEN_ENDPOINT,
  IDDAS_ACCESS_KEY: process.env.IDDAS_ACCESS_KEY,
  IDDAS_SYNC_LOOKBACK_DAYS: process.env.IDDAS_SYNC_LOOKBACK_DAYS,
  IDDAS_SYNC_MAX_PAGES: process.env.IDDAS_SYNC_MAX_PAGES,
  IDDAS_SYNC_ORCAMENTOS_PER_PAGE: process.env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE,
  IDDAS_SYNC_PESSOAS_PER_PAGE: process.env.IDDAS_SYNC_PESSOAS_PER_PAGE,
  IDDAS_SYNC_VENDAS_PER_PAGE: process.env.IDDAS_SYNC_VENDAS_PER_PAGE,
});
