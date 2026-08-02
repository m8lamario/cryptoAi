import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

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

export async function GET(): Promise<NextResponse> {
  return proxy("GET", "/scanner-config");
}

export async function PUT(req: Request): Promise<NextResponse> {
  const body = await req.json();
  return proxy("PUT", "/scanner-config", body);
}

