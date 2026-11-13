import { NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/http";
import { solanaRead } from "@/lib/checkout/rpc";
export async function POST(request: Request) {
  try {
    const input = z
      .object({
        jsonrpc: z.literal("2.0"),
        id: z.union([z.number(), z.string()]),
        method: z.string(),
        params: z.array(z.unknown()).max(4),
      })
      .parse(await readBody(request));
    const result = await solanaRead(input.method, input.params);
    return NextResponse.json(
      { jsonrpc: "2.0", id: input.id, result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32000,
          message:
            error instanceof Error ? error.message : "Network read failed",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
