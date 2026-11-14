import { NextResponse } from "next/server";
import { relay } from "@/lib/near/server";
import { body, fail, limit } from "@/lib/near/api";

export async function POST(request: Request) {
  try {
    limit(request, "relay", 30);
    const { signedDelegate } = await body<{ signedDelegate?: string }>(request);
    if (typeof signedDelegate !== "string") return NextResponse.json({ error: "Missing signedDelegate" }, { status: 400 });
    return NextResponse.json(await relay(signedDelegate));
  } catch (error) { return fail(error); }
}
