"use client";

import { useEffect, useRef, useState } from "react";
import {
  Compass,
  Crosshair,
  Layers,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { Map as LibreMap, Marker, GeoJSONSource } from "maplibre-gl";
import {
  accuracyPolygon,
  type MapLocation,
  type MapTarget,
} from "@/lib/maps/geo";

type Props = {
  target: MapTarget;
  location?: MapLocation;
  places: MapLocation[];
  onPick: (location: MapLocation) => void;
  onLocate: () => void;
  locating: boolean;
};
function cameraPadding() {
  return window.innerWidth <= 760
    ? {
        top: 80,
        right: 24,
        bottom: Math.round(window.innerHeight * 0.53),
        left: 24,
      }
    : {
        top: 100,
        right: 60,
        bottom: 65,
        left: window.innerWidth <= 1100 ? 430 : 495,
      };
}
export default function MapCanvas({
  target,
  location,
  places,
  onPick,
  onLocate,
  locating,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const library = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef<Marker[]>([]);
  const callbacks = useRef({ onPick, onLocate });
  const targetRef = useRef(target);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const [style, setStyle] = useState<"liberty" | "positron">("liberty");
  const [layers, setLayers] = useState(false);
  const [restart, setRestart] = useState(0);
  const [view, setView] = useState({ lng: 35, lat: 25, zoom: 2.4 });
  useEffect(() => {
    callbacks.current = { onPick, onLocate };
  }, [onPick, onLocate]);
  useEffect(() => {
    targetRef.current = target;
  }, [target]);
  useEffect(() => {
    let disposed = false;
    let instance: LibreMap | undefined;
    setReady(false);
    setProblem("");
    void import("maplibre-gl")
      .then((lib) => {
        if (disposed || !container.current) return;
        library.current = lib;
        lib.setWorkerUrl(
          `/maplibre/maplibre-gl-worker-${lib.getVersion()}.mjs`,
        );
        instance = new lib.Map({
          container: container.current,
          style: `https://tiles.openfreemap.org/styles/${style}`,
          center: [35, 25],
          zoom: 2.4,
          maxZoom: 19,
          attributionControl: { compact: true },
          canvasContextAttributes: { antialias: true },
        });
        map.current = instance;
        instance.addControl(
          new lib.ScaleControl({ unit: "metric", maxWidth: 110 }),
          "bottom-right",
        );
        instance.once("load", () => {
          if (!disposed) setReady(true);
        });
        instance.on("moveend", () => {
          if (disposed || !instance) return;
          const center = instance.getCenter();
          setView({
            lng: center.lng,
            lat: center.lat,
            zoom: instance.getZoom(),
          });
        });
        instance.on("error", (event) => {
          if (
            !disposed &&
            /webgl|worker.*(?:fail|load)|style.*(?:load|fetch)|failed to fetch/i.test(
              event.error?.message || "",
            )
          )
            setProblem(
              "Some map data could not load. Check your connection or retry the map.",
            );
        });
        instance.getCanvas().addEventListener("webglcontextlost", () => {
          if (!disposed)
            setProblem(
              "The map graphics connection was interrupted. Retry the map to continue.",
            );
        });
      })
      .catch(() => {
        if (!disposed)
          setProblem(
            "This browser couldn't start the interactive map. Merchant search is still available.",
          );
      });
    return () => {
      disposed = true;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      instance?.remove();
      map.current = null;
    };
    // Style changes are handled separately, preserving the single map instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restart]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    m.stop();
    if (target.bounds)
      m.fitBounds(target.bounds, {
        absolutePadding: true,
        padding: cameraPadding(),
        duration: reduced ? 0 : 1500,
        maxZoom: target.kind === "places" ? 16 : 12,
        linear: false,
      });
    else
      m.flyTo({
        center: target.center || [35, 25],
        zoom: target.zoom ?? 2.4,
        padding: cameraPadding(),
        duration: reduced ? 0 : 1600,
        curve: 1.5,
      });
  }, [target, ready]);

  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const m = map.current,
          focus = targetRef.current;
        if (!m) return;
        m.resize();
        if (focus.bounds)
          m.fitBounds(focus.bounds, {
            absolutePadding: true,
            padding: cameraPadding(),
            duration: 0,
            maxZoom: focus.kind === "places" ? 16 : 12,
          });
        else
          m.jumpTo({
            center: focus.center || [35, 25],
            zoom: focus.zoom ?? 2.4,
            padding: cameraPadding(),
          });
      });
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !map.current || !library.current) return;
    const m = map.current,
      lib = library.current;
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];
    const all = [...places];
    if (location && !all.some((place) => place.id === location.id))
      all.push(location);
    for (const [index, place] of all.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `geo-pin ${place.source === "gps" ? "is-gps" : ""} ${place.id === location?.id ? "is-active" : ""}`;
      button.textContent = place.source === "gps" ? "" : String(index + 1);
      button.setAttribute("aria-label", `Show ${place.name} on map`);
      button.title = `${place.name} · ${place.source === "city-center" ? "city center" : "map location"}`;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        callbacks.current.onPick(place);
      });
      markers.current.push(
        new lib.Marker({ element: button, anchor: "center" })
          .setLngLat(place.coordinates)
          .addTo(m),
      );
    }
    const empty = { type: "FeatureCollection" as const, features: [] };
    const accuracy =
      location?.source === "gps" && location.accuracy
        ? accuracyPolygon(location.coordinates, location.accuracy)
        : empty;
    const drawAccuracy = () => {
      if (!m.getSource("device-accuracy")) {
        m.addSource("device-accuracy", { type: "geojson", data: accuracy });
        m.addLayer({
          id: "device-accuracy-fill",
          type: "fill",
          source: "device-accuracy",
          paint: { "fill-color": "#4285f4", "fill-opacity": 0.12 },
        });
        m.addLayer({
          id: "device-accuracy-line",
          type: "line",
          source: "device-accuracy",
          paint: {
            "line-color": "#4285f4",
            "line-opacity": 0.5,
            "line-width": 1,
          },
        });
      } else
        (m.getSource("device-accuracy") as GeoJSONSource).setData(accuracy);
    };
    if (m.isStyleLoaded()) drawAccuracy();
    else {
      m.once("style.load", drawAccuracy);
      // A style can be loaded while its tiles are still arriving.
      m.once("idle", drawAccuracy);
    }
    return () => {
      m.off("style.load", drawAccuracy);
      m.off("idle", drawAccuracy);
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
    };
  }, [places, location, ready, style]);

  function changeStyle(next: "liberty" | "positron") {
    setStyle(next);
    setLayers(false);
    map.current?.setStyle(`https://tiles.openfreemap.org/styles/${next}`);
  }
  function recenter() {
    const m = map.current,
      focus = targetRef.current;
    if (!m) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 1200;
    if (focus.bounds)
      m.fitBounds(focus.bounds, {
        absolutePadding: true,
        padding: cameraPadding(),
        duration,
        maxZoom: focus.kind === "places" ? 16 : 12,
      });
    else
      m.flyTo({
        center: focus.center || [35, 25],
        zoom: focus.zoom ?? 2.4,
        padding: cameraPadding(),
        duration,
      });
  }
  return (
    <div className="map-background" aria-label="Interactive world map">
      <div
        ref={container}
        className="map-canvas"
        data-map-ready={ready}
        data-center-lng={view.lng.toFixed(5)}
        data-center-lat={view.lat.toFixed(5)}
        data-zoom={view.zoom.toFixed(2)}
      />
      {!ready && !problem ? (
        <div className="map-loading">
          <LoaderCircle className="spin" size={20} />
          <span>Opening your world…</span>
        </div>
      ) : null}
      {problem ? (
        <div className="map-load-error" role="status">
          <span>{problem}</span>
          <button onClick={() => setRestart((value) => value + 1)}>
            Retry map
          </button>
        </div>
      ) : null}
      <div className="map-tools" aria-label="Map controls">
        <button aria-label="Recenter map" onClick={recenter} disabled={!ready}>
          <RotateCcw size={19} />
        </button>
        <button
          aria-label="Use my location"
          onClick={onLocate}
          disabled={locating}
        >
          {locating ? (
            <LoaderCircle size={19} className="spin" />
          ) : (
            <Crosshair size={20} />
          )}
        </button>
        <div className="map-zoom">
          <button
            aria-label="Zoom in"
            onClick={() => map.current?.zoomIn()}
            disabled={!ready}
          >
            <Plus size={20} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => map.current?.zoomOut()}
            disabled={!ready}
          >
            <Minus size={20} />
          </button>
        </div>
        <button
          aria-label="Reset north"
          onClick={() => map.current?.resetNorth()}
          disabled={!ready}
        >
          <Compass size={20} />
        </button>
      </div>
      <div className="map-layers">
        <button
          className="map-layer-toggle"
          aria-expanded={layers}
          onClick={() => setLayers((value) => !value)}
        >
          <Layers size={18} />
          <span>Layers</span>
        </button>
        {layers ? (
          <div className="map-layer-options">
            <button
              aria-pressed={style === "liberty"}
              onClick={() => changeStyle("liberty")}
            >
              Streets
            </button>
            <button
              aria-pressed={style === "positron"}
              onClick={() => changeStyle("positron")}
            >
              Light
            </button>
          </div>
        ) : null}
      </div>
      <div className="map-view-label">
        <span className="map-status-dot" />
        <span>{target.label}</span>
      </div>
      <div className="map-provider-credit">
        <a href="https://maplibre.org/" target="_blank" rel="noreferrer">
          MapLibre
        </a>
        <span>·</span>
        <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
      </div>
    </div>
  );
}
