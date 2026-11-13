# Map workspace

The home page uses MapLibre GL JS with OpenFreeMap vector tiles derived from OpenStreetMap and OpenMapTiles. No Google Maps key, Google billing account, or paid map SDK is required for this configuration. Public services have availability and fair-use limits; production traffic can be moved to a dedicated provider or self-hosted services.

## Interaction

- A single persistent map sits behind a floating merchant/payment panel. Country selection animates to an overview; a recognized city in a purchase request focuses its city center. These presets are approximate viewports, not authoritative boundaries or merchant addresses.
- Search a city, address, place, or `latitude, longitude`, then choose a returned map listing. Known city centers and coordinates work without geocoding. Other submitted searches go to Photon. Nothing is sent on each keystroke.
- Device location requires browser permission and HTTPS or localhost. The marker shows the device's reported accuracy, with an uncertainty circle. It is an estimate, not guaranteed exact GPS. Denial and timeout leave manual search available.
- Zoom, north reset, recenter, and Streets/Light layers operate on the live map. Camera transitions respect reduced-motion preferences.
- On phones the app becomes a bottom panel with an expand/collapse handle. Map attribution remains visible above it.
- Provider matches are country/category recommendations, not geocoded branches. Selecting one shows payment evidence and keeps the map on the selected market/location. A small set of physical retailers has an explicit branch-discovery action; these are actual Photon/OSM results, not generated shop coordinates. An OSM listing does not verify stock, opening hours, payment acceptance, or ordering support.

## Data and privacy

Selected location and device coordinates live in browser memory; this app has no location database. Country/city context goes to the merchant routing API. A submitted address/place search goes through `/api/map/search` to Photon. Explicit nearby store discovery can also send the selected coordinates as search bias. Map tiles requested directly from OpenFreeMap reflect the visible area. Public providers receive ordinary network metadata.

Searches are cached only in browser memory, up to 20 queries. The server validates query length, supported market codes, and optional coordinate ranges; requests have timeouts. Geocoder throttling/failure shows a recoverable message rather than fabricated locations. Country presets, coordinate input, and merchant recommendations remain independent of geocoder availability. WebGL or tile failure leaves the merchant interface usable.

## Configuration and builds

The default geocoder is `https://photon.komoot.io/`. Set `PHOTON_BASE_URL` to a compatible Photon deployment (including a trailing slash) to change it. The endpoint must provide `api/` with Photon GeoJSON responses. Keep higher-volume deployments within the public service's fair-use policy or use your own service.

`npm install` prepares the matching MapLibre module worker in `public/maplibre/`. The same preparation runs before both builds. This avoids bundler-specific worker URL rewriting and works with both Next.js and Vinext/Cloudflare. The generated versioned worker and BSD license come from the installed package and are not source-controlled.

Main files: `components/MapCanvas.tsx`, `components/RouteFinder.tsx`, `lib/maps/geo.ts`, `lib/maps/photon.ts`, and `app/api/map/search/route.ts`. Camera targets and normalized locations are separate from the renderer so a future map provider can replace the map component without changing merchant/payment routing.

References: [MapLibre](https://maplibre.org/), [OpenFreeMap quick start](https://openfreemap.org/quick_start/), [Photon public service and fair use](https://github.com/komoot/photon), [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).
