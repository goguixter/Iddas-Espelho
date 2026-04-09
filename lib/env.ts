import { z } from "zod";

const clicksignEnvSchema = z.object({
  CLICKSIGN_PROFILE: z.enum(["sandbox", "production"]).default("sandbox"),
  CLICKSIGN_API_KEY: z.string().min(1).optional(),
  CLICKSIGN_BASE_URL: z.string().url().default("https://sandbox.clicksign.com"),
  CLICKSIGN_SANDBOX_API_KEY: z.string().min(1).optional(),
  CLICKSIGN_SANDBOX_BASE_URL: z.string().url().default("https://sandbox.clicksign.com"),
  CLICKSIGN_SANDBOX_WEBHOOK_SECRET: z.string().min(1).optional(),
  CLICKSIGN_PRODUCTION_API_KEY: z.string().min(1).optional(),
  CLICKSIGN_PRODUCTION_BASE_URL: z.string().url().default("https://app.clicksign.com"),
  CLICKSIGN_PRODUCTION_WEBHOOK_SECRET: z.string().min(1).optional(),
  CLICKSIGN_CONTRATADA_SIGNER_BIRTH: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT: z.string().optional(),
  CLICKSIGN_CONTRATADA_SIGNER_EMAIL: z.string().email().optional(),
  CLICKSIGN_CONTRATADA_SIGNER_NAME: z.string().min(1).optional(),
  CLICKSIGN_WEBHOOK_SECRET: z.string().min(1).optional(),
});

const iddasEnvSchema = z.object({
  IDDAS_API_BASE_URL: z.string().url().default("https://agencia.iddas.com.br/api/v1"),
  IDDAS_TOKEN_ENDPOINT: z.string().default("/auth/login"),
  IDDAS_ACCESS_KEY: z.string().min(1).optional(),
  IDDAS_SYNC_LOOKBACK_DAYS: z.coerce.number().int().positive().default(30),
  IDDAS_SYNC_MAX_PAGES: z.coerce.number().int().positive().default(50),
  IDDAS_SYNC_ORCAMENTOS_PER_PAGE: z.coerce.number().int().positive().max(100).default(100),
  IDDAS_SYNC_PESSOAS_PER_PAGE: z.coerce.number().int().positive().max(100).default(100),
  IDDAS_SYNC_VENDAS_PER_PAGE: z.coerce.number().int().positive().max(100).default(100),
});

const envSchema = clicksignEnvSchema.merge(iddasEnvSchema);

export const env = envSchema.parse({
  CLICKSIGN_PROFILE: process.env.CLICKSIGN_PROFILE,
  CLICKSIGN_API_KEY: process.env.CLICKSIGN_API_KEY,
  CLICKSIGN_BASE_URL: process.env.CLICKSIGN_BASE_URL,
  CLICKSIGN_SANDBOX_API_KEY: process.env.CLICKSIGN_SANDBOX_API_KEY,
  CLICKSIGN_SANDBOX_BASE_URL: process.env.CLICKSIGN_SANDBOX_BASE_URL,
  CLICKSIGN_SANDBOX_WEBHOOK_SECRET: process.env.CLICKSIGN_SANDBOX_WEBHOOK_SECRET,
  CLICKSIGN_PRODUCTION_API_KEY: process.env.CLICKSIGN_PRODUCTION_API_KEY,
  CLICKSIGN_PRODUCTION_BASE_URL: process.env.CLICKSIGN_PRODUCTION_BASE_URL,
  CLICKSIGN_PRODUCTION_WEBHOOK_SECRET: process.env.CLICKSIGN_PRODUCTION_WEBHOOK_SECRET,
  CLICKSIGN_CONTRATADA_SIGNER_BIRTH: process.env.CLICKSIGN_CONTRATADA_SIGNER_BIRTH,
  CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT: process.env.CLICKSIGN_CONTRATADA_SIGNER_DOCUMENT,
  CLICKSIGN_CONTRATADA_SIGNER_EMAIL: process.env.CLICKSIGN_CONTRATADA_SIGNER_EMAIL,
  CLICKSIGN_CONTRATADA_SIGNER_NAME: process.env.CLICKSIGN_CONTRATADA_SIGNER_NAME,
  CLICKSIGN_WEBHOOK_SECRET: process.env.CLICKSIGN_WEBHOOK_SECRET,
  IDDAS_API_BASE_URL: process.env.IDDAS_API_BASE_URL,
  IDDAS_TOKEN_ENDPOINT: process.env.IDDAS_TOKEN_ENDPOINT,
  IDDAS_ACCESS_KEY: process.env.IDDAS_ACCESS_KEY,
  IDDAS_SYNC_LOOKBACK_DAYS: process.env.IDDAS_SYNC_LOOKBACK_DAYS,
  IDDAS_SYNC_MAX_PAGES: process.env.IDDAS_SYNC_MAX_PAGES,
  IDDAS_SYNC_ORCAMENTOS_PER_PAGE: process.env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE,
  IDDAS_SYNC_PESSOAS_PER_PAGE: process.env.IDDAS_SYNC_PESSOAS_PER_PAGE,
  IDDAS_SYNC_VENDAS_PER_PAGE: process.env.IDDAS_SYNC_VENDAS_PER_PAGE,
});

export const clicksignConfig = resolveClicksignConfig();
export const iddasConfig = resolveIddasConfig();

function resolveClicksignConfig() {
  const profile = env.CLICKSIGN_PROFILE;

  if (profile === "production") {
    return {
      apiKey: env.CLICKSIGN_PRODUCTION_API_KEY ?? env.CLICKSIGN_API_KEY ?? null,
      baseUrl: env.CLICKSIGN_PRODUCTION_BASE_URL ?? env.CLICKSIGN_BASE_URL,
      profile,
      webhookSecret:
        env.CLICKSIGN_PRODUCTION_WEBHOOK_SECRET ?? env.CLICKSIGN_WEBHOOK_SECRET ?? null,
    };
  }

  return {
    apiKey: env.CLICKSIGN_SANDBOX_API_KEY ?? env.CLICKSIGN_API_KEY ?? null,
    baseUrl: env.CLICKSIGN_SANDBOX_BASE_URL ?? env.CLICKSIGN_BASE_URL,
    profile,
    webhookSecret:
      env.CLICKSIGN_SANDBOX_WEBHOOK_SECRET ?? env.CLICKSIGN_WEBHOOK_SECRET ?? null,
  };
}

function resolveIddasConfig() {
  return {
    accessKey: env.IDDAS_ACCESS_KEY ?? null,
    apiBaseUrl: env.IDDAS_API_BASE_URL,
    syncLookbackDays: env.IDDAS_SYNC_LOOKBACK_DAYS,
    syncMaxPages: env.IDDAS_SYNC_MAX_PAGES,
    syncOrcamentosPerPage: env.IDDAS_SYNC_ORCAMENTOS_PER_PAGE,
    syncPessoasPerPage: env.IDDAS_SYNC_PESSOAS_PER_PAGE,
    syncVendasPerPage: env.IDDAS_SYNC_VENDAS_PER_PAGE,
    tokenEndpoint: env.IDDAS_TOKEN_ENDPOINT,
  };
}
