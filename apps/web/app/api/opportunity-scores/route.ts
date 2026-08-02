import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const apiBase = process.env["API_BASE_URL"] ?? "http://localhost:4000";
  const cookie = (await cookies()).toString();
  const { searchParams } = new URL(req.url);
  const query = searchParams.toString();
  const path = `/opportunity-scores${query ? `?${query}` : ""}`;

  try {
    const res = await fetch(`${apiBase}${path}`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "API unreachable" }, { status: 502 });
  }
}

