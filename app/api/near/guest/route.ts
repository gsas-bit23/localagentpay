import { NextResponse } from "next/server";
import { createGuest } from "@/lib/near/server";
import { body, fail, limit } from "@/lib/near/api";

export async function POST(request: Request) {
  try {
    limit(request, "guest", 3, 10 * 60_000);
    const { publicKey } = await body<{ publicKey?: string }>(request);
    if (typeof publicKey !== "string" || !publicKey.startsWith("ed25519:")) return NextResponse.json({ error: "Send an ed25519 public key" }, { status: 400 });
    return NextResponse.json(await createGuest(publicKey));
  } catch (error) { return fail(error); }
}
