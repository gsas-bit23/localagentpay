import { countries, type CountryCode } from "../commerce/config";

export type Coordinates = [number, number]; // longitude, latitude
export type MapBounds = [number, number, number, number]; // west, south, east, north
export type MapLocation = {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  countryCode?: string;
  city?: string;
  bounds?: MapBounds;
  source: "photon" | "city-center" | "gps" | "coordinates" | "provider";
  accuracy?: number;
  kind?: string;
};
export type MapTarget = {
  id: number;
  kind: "world" | "country" | "location" | "places";
  label: string;
  center?: Coordinates;
  bounds?: MapBounds;
  zoom?: number;
};
export const countryViews: Record<
  CountryCode,
  { center: Coordinates; bounds: MapBounds }
> = {
  PK: { center: [69.35, 30.38], bounds: [60.87, 23.63, 77.84, 37.1] },
  IN: { center: [78.96, 22.59], bounds: [68.1, 6.75, 97.4, 35.5] },
  US: { center: [-110, 42], bounds: [-179, 18, -66, 72] },
  GB: { center: [-3.44, 55.38], bounds: [-8.7, 49.8, 1.8, 60.9] },
  AE: { center: [53.85, 24.28], bounds: [51.4, 22.6, 56.4, 26.1] },
  DE: { center: [10.45, 51.16], bounds: [5.86, 47.27, 15.05, 55.06] },
  SG: { center: [103.82, 1.35], bounds: [103.6, 1.16, 104.1, 1.48] },
  NG: { center: [8.68, 9.08], bounds: [2.67, 4.2, 14.7, 13.9] },
  CA: { center: [-106.35, 59.13], bounds: [-141, 41.7, -52.6, 83] },
  AU: { center: [133.78, -25.27], bounds: [112.9, -43.8, 154, -10.6] },
  FR: { center: [2.21, 46.23], bounds: [-5.2, 41.3, 9.6, 51.1] },
  JP: { center: [138.25, 36.2], bounds: [122.9, 24, 145.9, 45.7] },
};

const cityCenters: [string, CountryCode, number, number, string?][] = [
  ["Karachi", "PK", 67.0207, 24.8547],
  ["Lahore", "PK", 74.3436, 31.5497],
  ["Islamabad", "PK", 73.0479, 33.6844],
  ["Rawalpindi", "PK", 73.0169, 33.5651],
  ["Mumbai", "IN", 72.8777, 19.076],
  ["Delhi", "IN", 77.209, 28.6139],
  ["Bengaluru", "IN", 77.5946, 12.9716, "bangalore"],
  ["New York", "US", -74.006, 40.7128],
  ["San Francisco", "US", -122.4194, 37.7749],
  ["Los Angeles", "US", -118.2437, 34.0522],
  ["London", "GB", -0.1276, 51.5074],
  ["Manchester", "GB", -2.2426, 53.4808],
  ["Dubai", "AE", 55.2708, 25.2048],
  ["Abu Dhabi", "AE", 54.3773, 24.4539],
  ["Sharjah", "AE", 55.4033, 25.3463],
  ["Berlin", "DE", 13.405, 52.52],
  ["Munich", "DE", 11.582, 48.1351],
  ["Hamburg", "DE", 9.9937, 53.5511],
  ["Singapore", "SG", 103.8198, 1.3521],
  ["Lagos", "NG", 3.3792, 6.5244],
  ["Abuja", "NG", 7.4898, 9.0765],
  ["Toronto", "CA", -79.3832, 43.6532],
  ["Vancouver", "CA", -123.1207, 49.2827],
  ["Montreal", "CA", -73.5673, 45.5019],
  ["Sydney", "AU", 151.2093, -33.8688],
  ["Melbourne", "AU", 144.9631, -37.8136],
  ["Paris", "FR", 2.3522, 48.8566],
  ["Lyon", "FR", 4.8357, 45.764],
  ["Tokyo", "JP", 139.6917, 35.6895],
  ["Osaka", "JP", 135.5023, 34.6937],
];
export function isCoordinates(value: unknown): value is Coordinates {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[0]) <= 180 &&
    Math.abs(value[1]) <= 90
  );
}
export function parseCoordinates(text: string): Coordinates | undefined {
  const match = text
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return;
  const point: Coordinates = [Number(match[2]), Number(match[1])];
  return isCoordinates(point) ? point : undefined;
}
export function knownCity(
  text: string,
  country?: CountryCode,
): MapLocation | undefined {
  const match = cityCenters.find(
    ([name, code, , , alias]) =>
      (!country || code === country) &&
      [name, alias]
        .filter(Boolean)
        .some((value) => new RegExp(`\\b${value}\\b`, "i").test(text)),
  );
  if (!match) return;
  const [name, code, lng, lat] = match;
  return {
    id: `city-${code}-${name}`,
    name,
    address: `${name}, ${countries.find((c) => c.code === code)!.name} · city center`,
    countryCode: code,
    city: name,
    coordinates: [lng, lat],
    source: "city-center",
    kind: "city",
  };
}
export function locationsBounds(
  locations: MapLocation[],
): MapBounds | undefined {
  if (!locations.length) return;
  const points = locations.map((place) => place.coordinates);
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
export function accuracyPolygon(center: Coordinates, radius: number) {
  const lat = (center[1] * Math.PI) / 180,
    lng = (center[0] * Math.PI) / 180;
  const angular = Math.min(Math.max(radius, 1), 100000) / 6371008.8;
  const ring: number[][] = [];
  for (let i = 0; i <= 64; i++) {
    const bearing = (i / 64) * Math.PI * 2;
    const nextLat = Math.asin(
      Math.sin(lat) * Math.cos(angular) +
        Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const nextLng =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(nextLat),
      );
    ring.push([
      (((nextLng * 180) / Math.PI + 540) % 360) - 180,
      (nextLat * 180) / Math.PI,
    ]);
  }
  ring[ring.length - 1] = [...ring[0]];
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [ring] },
  };
}
