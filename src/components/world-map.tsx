"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Polygon,
} from "geojson";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  StyleSpecification,
} from "maplibre-gl";
import {
  Compass,
  LocateFixed,
  Minus,
  Moon,
  Navigation,
  Plus,
  Sun,
  WifiOff,
} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./world-map.css";

export type WorldMapSport =
  | "running"
  | "walking"
  | "basketball"
  | "football"
  | "badminton"
  | "plogging";

export type WorldMapCoordinate = [longitude: number, latitude: number];

export type WorldMapSpotLevel =
  | "seed"
  | "trail"
  | "active"
  | "pulse"
  | "landmark";

export interface WorldMapSpot {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  longitude: number;
  latitude: number;
  level?: WorldMapSpotLevel;
  levelNumber?: number;
  distanceLabel?: string;
  verified?: boolean;
  closesAt?: string;
}

export interface WorldMapEvent {
  id: string;
  spotId: string;
  title: string;
  sport: WorldMapSport;
  longitude?: number;
  latitude?: number;
  startLabel?: string;
  participants?: number;
  capacity?: number;
  status?: "scheduled" | "check-in" | "active" | "completed";
  beginnerFriendly?: boolean;
}

export interface WorldMapUser {
  nickname?: string;
  initials?: string;
  avatarUrl?: string;
  level?: number;
}

export interface WorldMapProps {
  spots?: readonly WorldMapSpot[];
  events?: readonly WorldMapEvent[];
  selectedEventId?: string | null;
  selectedSpotId?: string | null;
  onSelectEvent?: (event: WorldMapEvent) => void;
  onSelectSpot?: (spot: WorldMapSpot) => void;
  isNight?: boolean;
  movingProgress?: number;
  movingLabel?: string;
  center?: WorldMapCoordinate;
  userPosition?: WorldMapCoordinate;
  user?: WorldMapUser;
  operatingEndsAt?: string;
  className?: string;
  showHud?: boolean;
}

type MapState = "loading" | "ready" | "fallback";

const DEFAULT_CENTER: WorldMapCoordinate = [126.9256, 37.5264];

const DEFAULT_SPOTS: readonly WorldMapSpot[] = [
  {
    id: "spot-river",
    name: "한강 러닝 게이트",
    shortName: "러닝 게이트",
    longitude: 126.9218,
    latitude: 37.5287,
    level: "landmark",
    levelNumber: 8,
    distanceLabel: "620m",
    verified: true,
    closesAt: "21:00",
  },
  {
    id: "spot-court",
    name: "브릿지 농구 코트",
    shortName: "농구 코트",
    longitude: 126.9298,
    latitude: 37.5249,
    level: "pulse",
    levelNumber: 6,
    distanceLabel: "1.2km",
    verified: true,
    closesAt: "20:30",
  },
  {
    id: "spot-plaza",
    name: "무버스 커뮤니티 광장",
    shortName: "커뮤니티 광장",
    longitude: 126.9269,
    latitude: 37.5309,
    level: "active",
    levelNumber: 4,
    distanceLabel: "840m",
    verified: true,
    closesAt: "20:00",
  },
  {
    id: "spot-seed",
    name: "그린필드 풋살 스팟",
    shortName: "풋살 스팟",
    longitude: 126.9336,
    latitude: 37.5282,
    level: "seed",
    levelNumber: 1,
    distanceLabel: "1.7km",
    verified: false,
    closesAt: "19:30",
  },
] as const;

const DEFAULT_EVENTS: readonly WorldMapEvent[] = [
  {
    id: "event-run",
    spotId: "spot-river",
    title: "선셋 20분 런앤워크",
    sport: "running",
    startLabel: "오늘 19:40",
    participants: 6,
    capacity: 8,
    status: "check-in",
    beginnerFriendly: true,
  },
  {
    id: "event-basketball",
    spotId: "spot-court",
    title: "초보자 농구 3 × 3",
    sport: "basketball",
    startLabel: "내일 16:00",
    participants: 4,
    capacity: 6,
    status: "scheduled",
    beginnerFriendly: true,
  },
  {
    id: "event-badminton",
    spotId: "spot-plaza",
    title: "배드민턴 가벼운 랠리",
    sport: "badminton",
    startLabel: "내일 17:30",
    participants: 3,
    capacity: 4,
    status: "scheduled",
    beginnerFriendly: true,
  },
  {
    id: "event-football",
    spotId: "spot-seed",
    title: "패스 300회 스팟 레이드",
    sport: "football",
    startLabel: "토요일 15:00",
    participants: 5,
    capacity: 10,
    status: "scheduled",
    beginnerFriendly: true,
  },
] as const;

const SPORT_META: Record<
  WorldMapSport,
  { label: string; symbol: string; tone: string }
> = {
  running: { label: "러닝", symbol: "↗", tone: "lime" },
  walking: { label: "걷기", symbol: "⌁", tone: "mint" },
  basketball: { label: "농구", symbol: "●", tone: "orange" },
  football: { label: "축구", symbol: "◆", tone: "green" },
  badminton: { label: "배드민턴", symbol: "✦", tone: "sky" },
  plogging: { label: "플로깅", symbol: "♧", tone: "teal" },
};

const ROUTE_OFFSETS: readonly WorldMapCoordinate[] = [
  [-0.0035, -0.0021],
  [-0.0029, -0.0012],
  [-0.0022, -0.0004],
  [-0.0012, 0.0005],
  [-0.0001, 0.0011],
  [0.0011, 0.00135],
  [0.0022, 0.00105],
  [0.0031, 0.0003],
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeProgress(progress: number | undefined) {
  if (!Number.isFinite(progress)) return 0;
  const value = progress ?? 0;
  return clamp(value > 1 ? value / 100 : value, 0, 1);
}

function routeCoordinates(center: WorldMapCoordinate): WorldMapCoordinate[] {
  return ROUTE_OFFSETS.map(([longitude, latitude]) => [
    center[0] + longitude,
    center[1] + latitude,
  ]);
}

function pointAlongRoute(
  coordinates: readonly WorldMapCoordinate[],
  progress: number,
): WorldMapCoordinate {
  if (coordinates.length === 0) return DEFAULT_CENTER;
  if (coordinates.length === 1) return coordinates[0];

  const scaled = clamp(progress, 0, 1) * (coordinates.length - 1);
  const index = Math.min(Math.floor(scaled), coordinates.length - 2);
  const fraction = scaled - index;
  const current = coordinates[index];
  const next = coordinates[index + 1];

  return [
    current[0] + (next[0] - current[0]) * fraction,
    current[1] + (next[1] - current[1]) * fraction,
  ];
}

function progressCoordinates(
  coordinates: readonly WorldMapCoordinate[],
  progress: number,
): WorldMapCoordinate[] {
  if (coordinates.length < 2) return [...coordinates];

  const scaled = clamp(progress, 0, 1) * (coordinates.length - 1);
  const index = Math.min(Math.floor(scaled), coordinates.length - 2);
  return [
    ...coordinates.slice(0, index + 1),
    pointAlongRoute(coordinates, progress),
  ];
}

function makeLineFeature(
  coordinates: readonly WorldMapCoordinate[],
): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: [...coordinates] },
  };
}

function createBuildingCollection(
  center: WorldMapCoordinate,
): FeatureCollection<Polygon, { height: number; base: number; tint: string }> {
  const blocks: Array<
    [x: number, y: number, width: number, depth: number, height: number, tint: string]
  > = [
    [-0.0045, 0.0028, 0.00072, 0.00042, 46, "#b8d8cc"],
    [-0.0036, 0.00255, 0.00046, 0.00078, 72, "#b5cfe0"],
    [-0.0027, 0.003, 0.00058, 0.0005, 34, "#d5dbc4"],
    [-0.0017, 0.00265, 0.00072, 0.00046, 92, "#adc9cf"],
    [-0.0006, 0.0028, 0.00056, 0.00068, 58, "#c7d8d1"],
    [0.0004, 0.00255, 0.00042, 0.0005, 110, "#b5ccd6"],
    [0.0014, 0.0027, 0.00075, 0.00044, 54, "#cbd8c4"],
    [0.0026, 0.0024, 0.00048, 0.00072, 78, "#b9d4ca"],
    [0.0037, 0.0026, 0.00068, 0.00047, 42, "#d2d7c5"],
    [-0.0042, -0.0025, 0.00055, 0.0008, 64, "#b4cbd5"],
    [-0.0031, -0.0028, 0.0008, 0.00048, 38, "#cbd8c3"],
    [-0.002, -0.0025, 0.0005, 0.00064, 84, "#acc8d0"],
    [-0.0009, -0.0027, 0.00065, 0.00045, 48, "#d2d8c8"],
    [0.0002, -0.00245, 0.00046, 0.0008, 104, "#aac7d2"],
    [0.0012, -0.00275, 0.00072, 0.00046, 52, "#c7d4c0"],
    [0.00235, -0.00245, 0.0005, 0.00072, 70, "#b4d0ca"],
    [0.00335, -0.0027, 0.00076, 0.00045, 44, "#d0d7c5"],
  ];

  return {
    type: "FeatureCollection",
    features: blocks.map(([x, y, width, depth, height, tint]) => {
      const west = center[0] + x - width / 2;
      const east = center[0] + x + width / 2;
      const south = center[1] + y - depth / 2;
      const north = center[1] + y + depth / 2;

      return {
        type: "Feature",
        properties: { height, base: 0, tint },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      };
    }),
  };
}

function createKeylessStyle(isNight: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: [
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "moverse-background",
        type: "background",
        paint: {
          "background-color": isNight ? "#081b2c" : "#bcebc9",
          "background-opacity": 0.24,
        },
      },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-opacity": isNight ? 0.56 : 0.76,
          "raster-saturation": isNight ? -0.72 : -0.25,
          "raster-contrast": isNight ? 0.18 : -0.08,
          "raster-brightness-min": isNight ? 0.05 : 0.35,
          "raster-brightness-max": isNight ? 0.42 : 1,
        },
      },
    ],
  };
}

function positionForFallback(
  longitude: number,
  latitude: number,
  center: WorldMapCoordinate,
) {
  return {
    left: `${clamp(50 + (longitude - center[0]) * 2350, 8, 92)}%`,
    top: `${clamp(48 - (latitude - center[1]) * 3500, 15, 82)}%`,
  };
}

function createSpotElement(
  spot: WorldMapSpot,
  selected: boolean,
  onClick: () => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `mw-marker mw-spot-marker mw-spot-marker--${spot.level ?? "active"}${
    selected ? " is-selected" : ""
  }`;
  button.setAttribute(
    "aria-label",
    `${spot.name} Move Spot${spot.distanceLabel ? `, ${spot.distanceLabel}` : ""}`,
  );
  button.title = spot.name;

  const halo = document.createElement("span");
  halo.className = "mw-marker__halo";
  halo.setAttribute("aria-hidden", "true");

  const beam = document.createElement("span");
  beam.className = "mw-spot-marker__beam";
  beam.setAttribute("aria-hidden", "true");

  const tower = document.createElement("span");
  tower.className = "mw-spot-marker__tower";
  tower.setAttribute("aria-hidden", "true");

  const core = document.createElement("span");
  core.className = "mw-spot-marker__core";
  core.textContent = spot.level === "seed" ? "+" : "M";

  const level = document.createElement("span");
  level.className = "mw-spot-marker__level";
  level.textContent = `LV.${spot.levelNumber ?? 1}`;

  const label = document.createElement("span");
  label.className = "mw-marker__label";
  label.textContent = spot.shortName ?? spot.name;

  tower.append(core);
  button.append(halo, beam, tower, level, label);
  button.addEventListener("click", onClick);
  return button;
}

function createEventElement(
  event: WorldMapEvent,
  selected: boolean,
  onClick: () => void,
) {
  const meta = SPORT_META[event.sport];
  const button = document.createElement("button");
  button.type = "button";
  button.className = `mw-marker mw-event-marker mw-event-marker--${meta.tone}${
    event.status === "active" || event.status === "check-in" ? " is-live" : ""
  }${selected ? " is-selected" : ""}`;
  button.setAttribute(
    "aria-label",
    `${meta.label} 이벤트, ${event.title}${event.startLabel ? `, ${event.startLabel}` : ""}`,
  );
  button.title = event.title;

  const rings = document.createElement("span");
  rings.className = "mw-event-marker__rings";
  rings.setAttribute("aria-hidden", "true");

  const orb = document.createElement("span");
  orb.className = "mw-event-marker__orb";
  orb.setAttribute("aria-hidden", "true");

  const symbol = document.createElement("span");
  symbol.className = "mw-event-marker__symbol";
  symbol.textContent = meta.symbol;
  symbol.setAttribute("aria-hidden", "true");

  const badge = document.createElement("span");
  badge.className = "mw-event-marker__badge";
  badge.textContent = event.status === "active" || event.status === "check-in" ? "LIVE" : meta.label;

  const label = document.createElement("span");
  label.className = "mw-marker__label mw-marker__label--event";
  label.textContent = event.startLabel
    ? `${event.title} · ${event.startLabel}`
    : event.title;

  orb.append(symbol);
  button.append(rings, orb, badge, label);
  button.addEventListener("click", onClick);
  return button;
}

function createUserElement(user: WorldMapUser, moving: boolean) {
  const root = document.createElement("div");
  root.className = `mw-player${moving ? " is-moving" : ""}`;
  root.setAttribute("aria-label", `${user.nickname ?? "NOVA"}의 현재 위치`);
  root.setAttribute("role", "img");

  const compass = document.createElement("span");
  compass.className = "mw-player__direction";
  compass.setAttribute("aria-hidden", "true");

  const aura = document.createElement("span");
  aura.className = "mw-player__aura";
  aura.setAttribute("aria-hidden", "true");

  const avatar = document.createElement("span");
  avatar.className = "mw-player__avatar";
  if (user.avatarUrl) {
    const image = document.createElement("img");
    image.src = user.avatarUrl;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    avatar.append(image);
  } else {
    avatar.textContent = user.initials ?? "N";
  }

  const shadow = document.createElement("span");
  shadow.className = "mw-player__shadow";
  shadow.setAttribute("aria-hidden", "true");

  root.append(compass, aura, shadow, avatar);
  return root;
}

function FallbackSpotMarker({
  spot,
  center,
  selected,
  disabled,
  onSelect,
}: {
  spot: WorldMapSpot;
  center: WorldMapCoordinate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`mw-fallback-marker mw-spot-marker mw-spot-marker--${spot.level ?? "active"}${
        selected ? " is-selected" : ""
      }`}
      style={positionForFallback(spot.longitude, spot.latitude, center)}
      tabIndex={disabled ? -1 : 0}
      aria-hidden={disabled}
      aria-label={`${spot.name} Move Spot`}
      onClick={onSelect}
    >
      <span className="mw-marker__halo" aria-hidden="true" />
      <span className="mw-spot-marker__beam" aria-hidden="true" />
      <span className="mw-spot-marker__tower" aria-hidden="true">
        <span className="mw-spot-marker__core">{spot.level === "seed" ? "+" : "M"}</span>
      </span>
      <span className="mw-spot-marker__level">LV.{spot.levelNumber ?? 1}</span>
      <span className="mw-marker__label">{spot.shortName ?? spot.name}</span>
    </button>
  );
}

function FallbackEventMarker({
  event,
  coordinate,
  center,
  selected,
  disabled,
  onSelect,
}: {
  event: WorldMapEvent;
  coordinate: WorldMapCoordinate;
  center: WorldMapCoordinate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const meta = SPORT_META[event.sport];
  return (
    <button
      type="button"
      className={`mw-fallback-marker mw-event-marker mw-event-marker--${meta.tone}${
        event.status === "active" || event.status === "check-in" ? " is-live" : ""
      }${selected ? " is-selected" : ""}`}
      style={positionForFallback(coordinate[0], coordinate[1], center)}
      tabIndex={disabled ? -1 : 0}
      aria-hidden={disabled}
      aria-label={`${meta.label} 이벤트, ${event.title}`}
      onClick={onSelect}
    >
      <span className="mw-event-marker__rings" aria-hidden="true" />
      <span className="mw-event-marker__orb" aria-hidden="true">
        <span className="mw-event-marker__symbol">{meta.symbol}</span>
      </span>
      <span className="mw-event-marker__badge">
        {event.status === "active" || event.status === "check-in" ? "LIVE" : meta.label}
      </span>
      <span className="mw-marker__label mw-marker__label--event">
        {event.title}
      </span>
    </button>
  );
}

export function WorldMap({
  spots: spotsProp,
  events: eventsProp,
  selectedEventId,
  selectedSpotId,
  onSelectEvent,
  onSelectSpot,
  isNight = false,
  movingProgress = 0,
  movingLabel,
  center = DEFAULT_CENTER,
  userPosition,
  user = { nickname: "NOVA", initials: "N", level: 7 },
  operatingEndsAt = "21:00",
  className,
  showHud = true,
}: WorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapModuleRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markerRefs = useRef<MapLibreMarker[]>([]);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const initialNightRef = useRef(isNight);
  const [mapState, setMapState] = useState<MapState>("loading");
  const [mapBooted, setMapBooted] = useState(false);
  const [bearing, setBearing] = useState(-18);
  const [locationMessage, setLocationMessage] = useState("");
  const [localSelectedEventId, setLocalSelectedEventId] = useState<string | null>(null);
  const [localSelectedSpotId, setLocalSelectedSpotId] = useState<string | null>(null);
  const [locatedPosition, setLocatedPosition] = useState<WorldMapCoordinate | null>(null);

  const spots = spotsProp ?? DEFAULT_SPOTS;
  const events = eventsProp ?? DEFAULT_EVENTS;
  const progress = normalizeProgress(movingProgress);
  const centerLongitude = center[0];
  const centerLatitude = center[1];
  const stableCenter = useMemo<WorldMapCoordinate>(
    () => [centerLongitude, centerLatitude],
    [centerLatitude, centerLongitude],
  );
  const actualSelectedEventId =
    selectedEventId === undefined ? localSelectedEventId : selectedEventId;
  const actualSelectedSpotId =
    selectedSpotId === undefined ? localSelectedSpotId : selectedSpotId;
  const route = useMemo(
    () => routeCoordinates(stableCenter),
    [stableCenter],
  );
  const simulatedPosition = useMemo(
    () => pointAlongRoute(route, progress),
    [progress, route],
  );
  const currentUserPosition = userPosition ?? locatedPosition ?? simulatedPosition;

  const spotById = useMemo(
    () => new Map(spots.map((spot) => [spot.id, spot] as const)),
    [spots],
  );

  const eventCoordinate = useCallback(
    (event: WorldMapEvent, index: number): WorldMapCoordinate => {
      if (event.longitude !== undefined && event.latitude !== undefined) {
        return [event.longitude, event.latitude];
      }
      const spot = spotById.get(event.spotId);
      if (!spot) return stableCenter;
      const direction = index % 2 === 0 ? 1 : -1;
      return [
        spot.longitude + direction * 0.00024,
        spot.latitude + 0.00022 + (index % 3) * 0.00006,
      ];
    },
    [stableCenter, spotById],
  );

  const selectSpot = useCallback(
    (spot: WorldMapSpot) => {
      setLocalSelectedSpotId(spot.id);
      setLocalSelectedEventId(null);
      onSelectSpot?.(spot);
      mapRef.current?.easeTo({
        center: [spot.longitude, spot.latitude],
        zoom: 16.35,
        pitch: 62,
        duration: 720,
      });
    },
    [onSelectSpot],
  );

  const selectEvent = useCallback(
    (event: WorldMapEvent, index: number) => {
      setLocalSelectedEventId(event.id);
      setLocalSelectedSpotId(null);
      onSelectEvent?.(event);
      mapRef.current?.easeTo({
        center: eventCoordinate(event, index),
        zoom: 16.65,
        pitch: 64,
        duration: 720,
      });
    },
    [eventCoordinate, onSelectEvent],
  );

  useEffect(() => {
    let disposed = false;
    let map: MapLibreMap | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    let mapErrorCount = 0;

    const boot = async () => {
      try {
        const maplibre = await import("maplibre-gl");
        if (disposed || !mapContainerRef.current) return;

        mapModuleRef.current = maplibre;
        map = new maplibre.Map({
          container: mapContainerRef.current,
          style: createKeylessStyle(initialNightRef.current),
          center: stableCenter,
          zoom: 15.35,
          pitch: 58,
          bearing: -18,
          minZoom: 12,
          maxZoom: 19,
          maxPitch: 72,
          attributionControl: false,
          renderWorldCopies: false,
          fadeDuration: 0,
        });
        mapRef.current = map;
        setMapBooted(true);

        map.addControl(
          new maplibre.AttributionControl({ compact: true }),
          "bottom-right",
        );
        map.getCanvas().setAttribute("aria-label", "Moverse 여의도 3D 활동 지도");
        map.getCanvas().setAttribute("role", "region");

        const onLoad = () => {
          if (disposed || !map) return;
          if (loadTimer) clearTimeout(loadTimer);

          try {
            map.addSource("moverse-buildings", {
              type: "geojson",
              data: createBuildingCollection(stableCenter),
            });
            map.addLayer({
              id: "moverse-buildings",
              type: "fill-extrusion",
              source: "moverse-buildings",
              minzoom: 13,
              paint: {
                "fill-extrusion-color": ["get", "tint"],
                "fill-extrusion-height": ["get", "height"],
                "fill-extrusion-base": ["get", "base"],
                "fill-extrusion-opacity": initialNightRef.current ? 0.42 : 0.62,
                "fill-extrusion-vertical-gradient": true,
              },
            });

            map.addSource("moverse-route", {
              type: "geojson",
              lineMetrics: true,
              data: makeLineFeature(route),
            });
            map.addLayer({
              id: "moverse-route-glow",
              type: "line",
              source: "moverse-route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": initialNightRef.current ? "#40f5c5" : "#35d6a1",
                "line-width": 8,
                "line-blur": 9,
                "line-opacity": 0.3,
              },
            });
            map.addLayer({
              id: "moverse-route-line",
              type: "line",
              source: "moverse-route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-width": 3.4,
                "line-opacity": 0.88,
                "line-gradient": [
                  "interpolate",
                  ["linear"],
                  ["line-progress"],
                  0,
                  "#68f0b0",
                  0.55,
                  "#d9f763",
                  1,
                  "#52d7ff",
                ],
              },
            });
            map.addSource("moverse-progress", {
              type: "geojson",
              data: makeLineFeature(progressCoordinates(route, 0)),
            });
            map.addLayer({
              id: "moverse-progress-line",
              type: "line",
              source: "moverse-progress",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#ffffff",
                "line-width": 5.5,
                "line-opacity": 0.9,
                "line-blur": 1.2,
              },
            });
          } catch {
            setMapState("fallback");
            return;
          }

          setMapState(mapErrorCount >= 4 ? "fallback" : "ready");
        };

        const onError = () => {
          mapErrorCount += 1;
          if (!disposed && mapErrorCount >= 4) setMapState("fallback");
        };

        const onRotateEnd = () => {
          if (!disposed && map) setBearing(map.getBearing());
        };

        map.on("load", onLoad);
        map.on("error", onError);
        map.on("rotateend", onRotateEnd);
        loadTimer = setTimeout(() => {
          if (!disposed) setMapState("fallback");
        }, 6500);
      } catch {
        if (!disposed) {
          setMapBooted(false);
          setMapState("fallback");
        }
      }
    };

    void boot();

    return () => {
      disposed = true;
      if (loadTimer) clearTimeout(loadTimer);
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map?.remove();
      mapRef.current = null;
      mapModuleRef.current = null;
    };
  }, [route, stableCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapBooted || !map.isStyleLoaded()) return;

    try {
      map.setPaintProperty(
        "moverse-background",
        "background-color",
        isNight ? "#081b2c" : "#bcebc9",
      );
      map.setPaintProperty("osm", "raster-opacity", isNight ? 0.56 : 0.76);
      map.setPaintProperty("osm", "raster-saturation", isNight ? -0.72 : -0.25);
      map.setPaintProperty("osm", "raster-brightness-min", isNight ? 0.05 : 0.35);
      map.setPaintProperty("osm", "raster-brightness-max", isNight ? 0.42 : 1);
      if (map.getLayer("moverse-buildings")) {
        map.setPaintProperty(
          "moverse-buildings",
          "fill-extrusion-opacity",
          isNight ? 0.42 : 0.62,
        );
      }
    } catch {
      // The CSS world remains visible while a style swap is settling.
    }
  }, [isNight, mapBooted]);

  useEffect(() => {
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    const map = mapRef.current;
    const maplibre = mapModuleRef.current;
    if (!map || !maplibre || !mapBooted) return;

    const newMarkers: MapLibreMarker[] = [];

    spots.forEach((spot) => {
      const element = createSpotElement(
        spot,
        actualSelectedSpotId === spot.id,
        () => selectSpot(spot),
      );
      const marker = new maplibre.Marker({ element, anchor: "bottom" })
        .setLngLat([spot.longitude, spot.latitude])
        .addTo(map);
      newMarkers.push(marker);
    });

    events.forEach((event, index) => {
      const element = createEventElement(
        event,
        actualSelectedEventId === event.id,
        () => selectEvent(event, index),
      );
      const marker = new maplibre.Marker({
        element,
        anchor: "bottom",
        offset: [0, -24],
      })
        .setLngLat(eventCoordinate(event, index))
        .addTo(map);
      newMarkers.push(marker);
    });

    markerRefs.current = newMarkers;
    return () => {
      newMarkers.forEach((marker) => marker.remove());
      if (markerRefs.current === newMarkers) markerRefs.current = [];
    };
  }, [
    actualSelectedEventId,
    actualSelectedSpotId,
    eventCoordinate,
    events,
    mapBooted,
    selectEvent,
    selectSpot,
    spots,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = mapModuleRef.current;
    if (!map || !maplibre || !mapBooted) return;

    if (!userMarkerRef.current) {
      userMarkerRef.current = new maplibre.Marker({
        element: createUserElement(user, progress > 0 && progress < 1),
        anchor: "bottom",
      })
        .setLngLat(currentUserPosition)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(currentUserPosition);
      const element = userMarkerRef.current.getElement();
      element.classList.toggle("is-moving", progress > 0 && progress < 1);
    }

    const progressSource = map.getSource("moverse-progress") as GeoJSONSource | undefined;
    progressSource?.setData(makeLineFeature(progressCoordinates(route, progress)));
  }, [
    currentUserPosition,
    mapBooted,
    progress,
    route,
    user,
  ]);

  const zoomIn = () => mapRef.current?.zoomIn({ duration: 320 });
  const zoomOut = () => mapRef.current?.zoomOut({ duration: 320 });
  const rotateMap = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: map.getBearing() + 45, duration: 520 });
  };

  const locateUser = () => {
    if (!navigator.geolocation) {
      setLocationMessage("이 기기에서는 데모 위치를 사용해요.");
      mapRef.current?.easeTo({ center: simulatedPosition, zoom: 16, duration: 650 });
      return;
    }

    setLocationMessage("현재 위치를 찾는 중…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: WorldMapCoordinate = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        setLocatedPosition(next);
        setLocationMessage("현재 위치로 이동했어요.");
        mapRef.current?.easeTo({ center: next, zoom: 16.2, pitch: 58, duration: 700 });
      },
      () => {
        setLocationMessage("위치가 꺼져 있어 여의도 데모 월드를 보여드려요.");
        mapRef.current?.easeTo({ center: simulatedPosition, zoom: 15.7, duration: 650 });
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60_000 },
    );
  };

  const mapClassName = [
    "mw-world-map",
    isNight ? "is-night" : "is-day",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const progressStyle = {
    "--mw-progress": progress,
    "--mw-bearing": `${-bearing}deg`,
  } as CSSProperties;

  return (
    <section
      className={mapClassName}
      data-map-state={mapState}
      data-moving={progress > 0 && progress < 1 ? "true" : "false"}
      style={progressStyle}
      aria-label="Moverse 3D 활동 지도"
    >
      <div className="mw-world-map__sky" aria-hidden="true" />

      <div className="mw-fallback-world" aria-hidden={mapState === "ready"}>
        <div className="mw-fallback-world__horizon" />
        <div className="mw-fallback-world__plane">
          <span className="mw-fallback-world__river" />
          <span className="mw-fallback-world__road mw-fallback-world__road--one" />
          <span className="mw-fallback-world__road mw-fallback-world__road--two" />
          <span className="mw-fallback-world__road mw-fallback-world__road--three" />
          <span className="mw-fallback-world__road mw-fallback-world__road--four" />
          <span className="mw-fallback-world__route" />
          {Array.from({ length: 18 }, (_, index) => (
            <span
              className={`mw-fallback-building mw-fallback-building--${(index % 6) + 1}`}
              key={index}
              style={
                {
                  "--mw-building-index": index,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {mapState !== "ready" ? (
          <div className="mw-fallback-world__markers">
            {spots.map((spot) => (
              <FallbackSpotMarker
                key={spot.id}
                spot={spot}
                center={stableCenter}
                selected={actualSelectedSpotId === spot.id}
                disabled={false}
                onSelect={() => selectSpot(spot)}
              />
            ))}
            {events.map((event, index) => (
              <FallbackEventMarker
                key={event.id}
                event={event}
                coordinate={eventCoordinate(event, index)}
                center={stableCenter}
                selected={actualSelectedEventId === event.id}
                disabled={false}
                onSelect={() => selectEvent(event, index)}
              />
            ))}
            <div
              className={`mw-fallback-player${progress > 0 && progress < 1 ? " is-moving" : ""}`}
              style={positionForFallback(
                currentUserPosition[0],
                currentUserPosition[1],
                stableCenter,
              )}
              aria-hidden="true"
            >
              <span className="mw-player__direction" />
              <span className="mw-player__aura" />
              <span className="mw-player__shadow" />
              <span className="mw-player__avatar">{user.initials ?? "N"}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div ref={mapContainerRef} className="mw-world-map__canvas" />
      <div className="mw-world-map__vignette" aria-hidden="true" />
      <div className="mw-world-map__scan" aria-hidden="true" />

      {showHud ? (
        <>
          <div className="mw-map-status">
            <div className="mw-map-status__place">
              <span className="mw-map-status__signal" aria-hidden="true" />
              <span>여의도 · 한강</span>
            </div>
            <span className="mw-map-status__divider" aria-hidden="true" />
            <div className="mw-map-status__mode">
              {isNight ? <Moon size={13} aria-hidden="true" /> : <Sun size={13} aria-hidden="true" />}
              {isNight ? "예약 모드" : `${events.length}개 활동`}
            </div>
          </div>

          <div className="mw-map-controls" aria-label="지도 조작">
            <button type="button" onClick={zoomIn} aria-label="지도 확대" title="확대">
              <Plus size={20} aria-hidden="true" />
            </button>
            <button type="button" onClick={zoomOut} aria-label="지도 축소" title="축소">
              <Minus size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={rotateMap}
              aria-label="지도를 45도 회전"
              title="지도 회전"
              className="mw-map-controls__compass"
            >
              <Compass size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={locateUser}
              aria-label="현재 위치로 이동"
              title="현재 위치"
              className="mw-map-controls__locate"
            >
              <LocateFixed size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="mw-map-safety-chip">
            <span className="mw-map-safety-chip__dot" aria-hidden="true" />
            {isNight ? "대면 활동 종료 · 내일 예약 가능" : `Run Spot ${operatingEndsAt} 종료`}
          </div>

          {progress > 0 ? (
            <div className="mw-move-progress" role="status">
              <span className="mw-move-progress__icon" aria-hidden="true">
                <Navigation size={16} />
              </span>
              <span className="mw-move-progress__copy">
                <strong>{movingLabel ?? "Spot으로 이동 중"}</strong>
                <small>{Math.max(0.1, progress * 1.4).toFixed(1)}km · Energy +{Math.round(progress * 18)}</small>
              </span>
              <span className="mw-move-progress__track" aria-hidden="true">
                <span />
              </span>
              <b>{Math.round(progress * 100)}%</b>
            </div>
          ) : null}
        </>
      ) : null}

      {mapState === "fallback" ? (
        <div className="mw-map-fallback-chip" role="status">
          <WifiOff size={13} aria-hidden="true" />
          3D 데모 월드
        </div>
      ) : null}

      <p className="mw-sr-only" aria-live="polite">
        {locationMessage ||
          (mapState === "loading"
            ? "3D 활동 지도를 불러오는 중입니다."
            : mapState === "fallback"
              ? "네트워크 없이 사용할 수 있는 3D 데모 지도를 표시합니다."
              : "3D 활동 지도를 사용할 수 있습니다.")}
      </p>
    </section>
  );
}

export default WorldMap;
