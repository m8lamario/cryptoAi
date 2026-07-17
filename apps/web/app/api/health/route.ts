import type { HealthStatus } from "@cryptoai/contracts";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(): NextResponse<HealthStatus> {
  const body: HealthStatus = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
