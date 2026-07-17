import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Paths that don't require authentication
const PUBLIC_PREFIXES = ["/login", "/api/health", "/api/auth", "/_next/", "/favicon.ico"];

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const apiBase = process.env["API_BASE_URL"] ?? "http://localhost:4000";
  const cookieHeader = req.headers.get("cookie") ?? "";

  try {
    const meRes = await fetch(`${apiBase}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (!meRes.ok) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } catch {
    // API unreachable — redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
