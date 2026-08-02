import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ asset: string }> },
): Promise<NextResponse> {
  const { asset } = await params;
  return proxy("GET", `/watchlist/assets/${asset}`);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ asset: string }> },
): Promise<NextResponse> {
  const { asset } = await params;
  const body = await req.json();
  return proxy("PUT", `/watchlist/assets/${asset}`, body);
}

async function proxy(method: string, path: string, body?: unknown) {
  const apiBase = process.env["API_BASE_URL"] ?? "http://localhost:4000";
  const cookie = (await cookies()).toString();
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

