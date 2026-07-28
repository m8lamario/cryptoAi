import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Paths that don't require authentication
const PUBLIC_PREFIXES = ["/login", "/api/health", "/api/auth", "/_next/", "/favicon.ico"];

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3001";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const apiBase = process.env["API_BASE_URL"] ?? "http://localhost:4000";
  const cookieHeader = req.headers.get("cookie") ?? "";
  const base = getBaseUrl(req);

  try {
    const meRes = await fetch(`${apiBase}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!meRes.ok) {
      return NextResponse.redirect(new URL("/login", base));
    }
  } catch {
    // API unreachable — redirect to login
    return NextResponse.redirect(new URL("/login", base));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
