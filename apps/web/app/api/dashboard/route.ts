import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const apiBase = process.env["API_BASE_URL"] ?? "http://localhost:4000";

  try {
    const res = await fetch(`${apiBase}/dashboard`, {
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
  } catch (err) {
    return NextResponse.json(
      { error: "API unreachable" },
      { status: 502 },
    );
  }
}

