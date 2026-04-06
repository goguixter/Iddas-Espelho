import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (!shouldRewriteClicksignRootWebhook(request)) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL("/api/clicksign/webhook", request.url));
}

export const config = {
  matcher: ["/"],
};

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
