import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  getAuthConfigurationError,
  getSessionMaxAge,
  isValidLogin,
} from "@/lib/auth/session";

export async function POST(request: Request) {
  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | { password?: string; username?: string }
    | null;

  if (!body?.username || !body.password || !isValidLogin(body.username, body.password)) {
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  const token = await createSessionToken(body.username);
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    maxAge: getSessionMaxAge(),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
