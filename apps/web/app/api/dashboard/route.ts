import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const apiBase = process.env["API_BASE_URL"] ?? "http://localhost:4000";

  try {
    const cookie = (await cookies()).toString();
    const res = await fetch(`${apiBase}/dashboard`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "API unreachable" },
      { status: 502 },
    );
  }
}

