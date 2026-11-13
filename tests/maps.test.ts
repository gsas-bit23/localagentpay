import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accuracyPolygon,
  countryViews,
  isCoordinates,
  knownCity,
  locationsBounds,
  parseCoordinates,
} from "../lib/maps/geo";
import { mapSearchSchema, normalizePhoton } from "../lib/maps/photon";
import { countries } from "../lib/commerce/config";

test("typed latitude, longitude is converted to map longitude, latitude without losing precision", () => {
  assert.deepEqual(
    parseCoordinates("24.8546842, 67.0207055"),
    [67.0207055, 24.8546842],
  );
  for (const value of ["91, 20", "20, 181", "Karachi", "", "NaN, 0"])
    assert.equal(parseCoordinates(value), undefined);
  assert.equal(isCoordinates([Infinity, 0]), false);
});
test("every supported market has a valid camera extent containing its overview center", () => {
  for (const country of countries) {
    const {
      center,
      bounds: [w, s, e, n],
    } = countryViews[country.code];
    assert.ok(isCoordinates(center));
    assert.ok(
      w < e &&
        s < n &&
        center[0] >= w &&
        center[0] <= e &&
        center[1] >= s &&
        center[1] <= n,
    );
  }
});
test("city presets are labeled as city centers and respect the selected market", () => {
  assert.equal(knownCity("groceries in Karachi", "PK")?.source, "city-center");
  assert.match(knownCity("Karachi")!.address, /city center/);
  assert.equal(knownCity("Karachi", "IN"), undefined);
  assert.equal(knownCity("book in Bangalore")?.name, "Bengaluru");
  assert.equal(knownCity("Londoner"), undefined);
});
const point = (id: number, code = "pk", coordinates = [67.02, 24.85]) => ({
  geometry: { type: "Point", coordinates },
  properties: {
    osm_id: id,
    osm_type: "N",
    name: "A mapped place",
    countrycode: code,
    country: "Pakistan",
    extent: [66, 26, 68, 24],
  },
});
test("Photon results preserve actual OSM coordinates, reorder extents, and filter countries and duplicate records", () => {
  const places = normalizePhoton(
    {
      features: [
        point(1),
        point(1),
        point(2, "in"),
        point(3, "pk", [400, 24]),
        { invalid: true },
      ],
    },
    "PK",
  );
  assert.equal(places.length, 1);
  assert.deepEqual(places[0].coordinates, [67.02, 24.85]);
  assert.deepEqual(places[0].bounds, [66, 24, 68, 26]);
  assert.equal(places[0].source, "photon");
  assert.equal(places[0].countryCode, "PK");
  assert.equal("payment" in places[0], false);
});
test("location search rejects unsupported markets, excessive queries and invalid bias coordinates", () => {
  for (const value of [
    { q: "x" },
    { q: "a".repeat(161) },
    { q: "shop", country: "ZZ" },
    { q: "shop", lng: 181 },
    { q: "shop", lat: 91 },
  ])
    assert.equal(mapSearchSchema.safeParse(value).success, false);
});
test("GPS accuracy ring contains valid points and is closed, including near the date line", () => {
  for (const center of [
    [67.02, 24.85],
    [179.999, 0],
  ] as [number, number][]) {
    const ring = accuracyPolygon(center, 500).geometry.coordinates[0];
    assert.equal(ring.length, 65);
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    assert.ok(ring.every(isCoordinates));
  }
});
test("a collection camera extent is derived from returned positions, not merchant names", () => {
  const places = normalizePhoton({
    features: [point(1), point(2, "pk", [68, 25])],
  });
  assert.deepEqual(locationsBounds(places), [67.02, 24.85, 68, 25]);
  assert.equal(locationsBounds([]), undefined);
});
