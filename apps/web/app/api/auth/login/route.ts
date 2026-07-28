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
  const contentType = req.headers.get("content-type") ?? "";
  const base = getBaseUrl(req);

  let body: string;
  let apiContentType: string;

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    // HTML form submission — convert to JSON for the Express API
    const formData = await req.formData();
    const username = formData.get("username") as string | null;
    const password = formData.get("password") as string | null;
    body = JSON.stringify({ username: username ?? "", password: password ?? "" });
    apiContentType = "application/json";
  } else {
    body = await req.text();
    apiContentType = contentType || "application/json";
  }

  let apiRes: Response;
  try {
    apiRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": apiContentType },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "API unavailable" }, { status: 503 });
  }

  const setCookie = apiRes.headers.get("set-cookie");

  // HTML form submission: redirect on success, back to login on failure
  if (contentType.includes("application/x-www-form-urlencoded")) {
    if (apiRes.ok && setCookie) {
      const redirect = NextResponse.redirect(new URL("/", base));
      redirect.headers.set("set-cookie", setCookie);
      return redirect;
    }
    return NextResponse.redirect(new URL("/login?error=1", base));
  }

  // JSON / API call: forward the response
  const data: unknown = await apiRes.json();
  const response = NextResponse.json(data, { status: apiRes.status });
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }
  return response;
}
