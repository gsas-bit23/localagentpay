import { NextResponse } from "next/server";
import { chatSchema } from "@/lib/validation";
import { getNearbyOptions, interpretRequest } from "@/lib/merchants";
import { apiError, readBody } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const body = chatSchema.parse(await readBody(request));
    const parsed = interpretRequest(body.message, body.category);
    return NextResponse.json({
      location: body.location,
      options: getNearbyOptions(parsed.category, parsed.budget),
      dataSource: "fictional-fixtures",
      distances: "illustrative",
    });
  } catch (error) {
    return apiError(error);
  }
}
