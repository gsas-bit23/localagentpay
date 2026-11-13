import { NextResponse } from "next/server";
import { planCommerce, routingSchema } from "@/lib/commerce/planner";
import { infrastructureReferences } from "@/lib/commerce/providers";
import { apiError, readBody } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const input = routingSchema.parse(await readBody(request));
    return NextResponse.json(planCommerce(input), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function GET() {
  return NextResponse.json({
    references: infrastructureReferences,
    reviewedAt: "2026-11-14",
    note: "Infrastructure references are not connected payment integrations.",
  });
}
