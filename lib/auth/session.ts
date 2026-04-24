import { env } from "@/lib/env";

const SESSION_COOKIE_NAME = "iddas_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type SessionPayload = {
  exp: number;
  sub: string;
};

export { SESSION_COOKIE_NAME };

export function isAuthConfigured() {
  return Boolean(env.AUTH_SECRET && env.AUTH_USERNAME && env.AUTH_PASSWORD);
}

export function getAuthConfigurationError() {
  if (isAuthConfigured()) {
    return null;
  }

  return "Defina AUTH_SECRET, AUTH_USERNAME e AUTH_PASSWORD para habilitar o login.";
}

export function isValidLogin(username: string, password: string) {
  if (!isAuthConfigured()) {
    return false;
  }

  return username === env.AUTH_USERNAME && password === env.AUTH_PASSWORD;
}

export async function createSessionToken(username: string) {
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  return signPayload(payload);
}

export async function verifySessionToken(token: string | undefined) {
  if (!token || !isAuthConfigured()) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload);
  if (signature !== expectedSignature) {
    return null;
  }

  const payload = parsePayload(encodedPayload);
  if (!payload || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function getSessionMaxAge() {
  return SESSION_TTL_SECONDS;
}

async function signPayload(payload: SessionPayload) {
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.AUTH_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function parsePayload(encodedPayload: string) {
  try {
    const parsed = JSON.parse(decoder.decode(decodeBase64Url(encodedPayload))) as Partial<SessionPayload>;
    if (typeof parsed.sub !== "string" || typeof parsed.exp !== "number") {
      return null;
    }

    return {
      sub: parsed.sub,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
