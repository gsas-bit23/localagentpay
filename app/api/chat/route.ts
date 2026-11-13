import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { chatSchema } from "@/lib/validation";
import { apiError, readBody } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const body = chatSchema.parse(await readBody(request));
    return NextResponse.json(
      await runAgent(body.message, body.location, body.category),
    );
  } catch (error) {
    return apiError(error);
  }
}
