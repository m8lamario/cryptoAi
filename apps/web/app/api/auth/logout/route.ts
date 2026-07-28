import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env["API_BASE_URL"] ?? "http://localhost:4000";

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3001";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const base = getBaseUrl(req);

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "API unavailable" }, { status: 503 });
  }

  const setCookie = apiRes.headers.get("set-cookie");
  const response = NextResponse.redirect(new URL("/login", base), 303);

  // Forward cookie-clear header from API
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
