import { NextResponse } from "next/server";
import { mapSearchSchema, normalizePhoton } from "@/lib/maps/photon";
import { countryViews } from "@/lib/maps/geo";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const input = mapSearchSchema.parse({
      q: params.get("q"),
      country: params.get("country") || undefined,
      lng: params.get("lng") ?? undefined,
      lat: params.get("lat") ?? undefined,
    });
    const url = new URL(
      "api/",
      process.env.PHOTON_BASE_URL || "https://photon.komoot.io/",
    );
    url.searchParams.set("q", input.q);
    url.searchParams.set("limit", "8");
    url.searchParams.set("lang", "en");
    if (input.country)
      url.searchParams.set(
        "bbox",
        countryViews[input.country].bounds.join(","),
      );
    if (input.lat !== undefined && input.lng !== undefined) {
      url.searchParams.set("lat", String(input.lat));
      url.searchParams.set("lon", String(input.lng));
    }
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "LocalAgentPay/0.2 (https://localagentpay.mateen-nibtap.workers.dev)",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            "The location search service is unavailable or busy. Try again shortly; the map and merchant search still work.",
        },
        { status: 503 },
      );
    return NextResponse.json(
      {
        places: normalizePhoton(await response.json(), input.country),
        source: "Photon / OpenStreetMap",
        note: "Map listings are not verified payment acceptance or live stock.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    )
      return NextResponse.json(
        {
          error:
            "Location search timed out. You can still choose a country or share your device location.",
        },
        { status: 504 },
      );
    return apiError(error);
  }
}
