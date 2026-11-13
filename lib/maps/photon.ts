import { z } from "zod";
import { isCoordinates, type MapLocation, type MapBounds } from "./geo";

export const mapSearchSchema = z.object({
  q: z.string().trim().min(2).max(160),
  country: z
    .enum([
      "PK",
      "IN",
      "US",
      "GB",
      "AE",
      "DE",
      "SG",
      "NG",
      "CA",
      "AU",
      "FR",
      "JP",
    ])
    .optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
});
const featureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.array(z.number()).min(2),
  }),
  properties: z.object({
    osm_id: z.union([z.number(), z.string()]).optional(),
    osm_type: z.string().optional(),
    name: z.string().optional(),
    countrycode: z.string().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    county: z.string().optional(),
    street: z.string().optional(),
    housenumber: z.string().optional(),
    postcode: z.string().optional(),
    state: z.string().optional(),
    osm_value: z.string().optional(),
    type: z.string().optional(),
    extent: z.array(z.number()).length(4).optional(),
  }),
});
export function normalizePhoton(
  payload: unknown,
  country?: string,
): MapLocation[] {
  const container = z.object({ features: z.array(z.unknown()) }).parse(payload);
  const locations: MapLocation[] = [];
  for (const item of container.features) {
    const parsed = featureSchema.safeParse(item);
    if (!parsed.success || !isCoordinates(parsed.data.geometry.coordinates))
      continue;
    const { properties: p, geometry: g } = parsed.data;
    if (country && p.countrycode?.toUpperCase() !== country) continue;
    const coordinates: [number, number] = [g.coordinates[0], g.coordinates[1]];
    const name =
      p.name ||
      [p.housenumber, p.street].filter(Boolean).join(" ") ||
      "Map location";
    const extent = p.extent;
    const bounds: MapBounds | undefined =
      extent && extent[0] <= extent[2] && extent[3] <= extent[1]
        ? [extent[0], extent[3], extent[2], extent[1]]
        : undefined;
    const id = `osm-${p.osm_type || "point"}-${p.osm_id || coordinates.join(",")}`;
    if (locations.some((location) => location.id === id)) continue;
    locations.push({
      id,
      name,
      coordinates,
      address: [
        ...new Set(
          [
            p.housenumber && p.street
              ? `${p.housenumber} ${p.street}`
              : p.street,
            p.city || p.district || p.county,
            p.state,
            p.postcode,
            p.country,
          ].filter(Boolean),
        ),
      ].join(", "),
      countryCode: p.countrycode?.toUpperCase(),
      city:
        p.city ||
        (p.type === "city" || p.osm_value === "city" ? p.name : undefined),
      bounds,
      source: "photon",
      kind: p.osm_value || p.type,
    });
  }
  return locations.slice(0, 6);
}
