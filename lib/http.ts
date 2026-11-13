import { NextResponse } from "next/server";
import { ZodError } from "zod";

export async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 12000) throw new Error("REQUEST_TOO_LARGE");
  return JSON.parse(text);
}
export function apiError(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError)
    return NextResponse.json(
      { error: "Please check the request fields and try again." },
      { status: 400 },
    );
  if (error instanceof Error && error.message === "REQUEST_TOO_LARGE")
    return NextResponse.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    },
    { status: 422 },
  );
}
