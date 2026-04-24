import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, isAuthConfigured, verifySessionToken } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const clicksignWebhookRewrite = shouldRewriteClicksignRootWebhook(request);
  if (clicksignWebhookRewrite) {
    return NextResponse.rewrite(new URL("/api/clicksign/webhook", request.url));
  }

  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionToken);

  if (session) {
    if (request.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (isPublicPath(request)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (nextPath !== "/login") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isPublicPath(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  return (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/clicksign/webhook" ||
    pathname === "/api/iddas/webhook"
  );
}

function shouldRewriteClicksignRootWebhook(request: NextRequest) {
  if (request.method !== "POST") {
    return false;
  }

  const contentType = request.headers.get("content-type") ?? "";
  const contentHmac = request.headers.get("content-hmac");
  const eventName = request.headers.get("event");

  return (
    contentType.includes("application/json") &&
    Boolean(contentHmac?.trim()) &&
    Boolean(eventName?.trim())
  );
}
