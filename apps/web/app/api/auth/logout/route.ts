import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = process.env["API_BASE_URL"] ?? "http://localhost:4000";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieHeader = req.headers.get("cookie") ?? "";

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
  const response = NextResponse.redirect(new URL("/login", req.url), 303);

  // Forward cookie-clear header from API
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
