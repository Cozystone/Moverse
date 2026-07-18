"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
} from "geojson";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
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
  { label: string; symbol: string; color: string }
> = {
  running: { label: "러닝", symbol: "런", color: "#42b883" },
  walking: { label: "걷기", symbol: "걷", color: "#2ca58d" },
  basketball: { label: "농구", symbol: "농", color: "#e77b3b" },
  football: { label: "축구", symbol: "축", color: "#278a55" },
  badminton: { label: "배드민턴", symbol: "배", color: "#388fc4" },
  plogging: { label: "플로깅", symbol: "줍", color: "#318a78" },
};

const SPOT_COLOR: Record<WorldMapSpotLevel, string> = {
  seed: "#79a944",
  trail: "#4b9d73",
  active: "#238863",
  pulse: "#247f86",
  landmark: "#176f55",
};

type SpotFeatureProperties = {
  id: string;
  label: string;
  symbol: string;
  color: string;
  selected: number;
  levelLabel: string;
};

type EventFeatureProperties = {
  id: string;
  index: number;
  label: string;
  symbol: string;
  color: string;
  selected: number;
  live: number;
};

type UserFeatureProperties = {
  initials: string;
  moving: number;
};

const EMPTY_POINT_COLLECTION: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
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

function createKeylessStyle(isNight: boolean): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
          "background-color": isNight ? "#14242d" : "#d9e3dc",
          "background-opacity": 1,
        },
      },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-opacity": isNight ? 0.66 : 0.92,
          "raster-saturation": isNight ? -0.78 : -0.12,
          "raster-contrast": isNight ? 0.12 : 0.02,
          "raster-brightness-min": isNight ? 0.06 : 0.2,
          "raster-brightness-max": isNight ? 0.46 : 0.98,
        },
      },
    ],
  };
}

function createSpotCollection(
  spots: readonly WorldMapSpot[],
  selectedSpotId: string | null | undefined,
): FeatureCollection<Point, SpotFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: spots.map((spot) => {
      const level = spot.level ?? "active";
      return {
        type: "Feature",
        properties: {
          id: spot.id,
          label: spot.shortName ?? spot.name,
          symbol: level === "seed" ? "+" : "M",
          color: SPOT_COLOR[level],
          selected: selectedSpotId === spot.id ? 1 : 0,
          levelLabel: `${spot.levelNumber ?? 1}단계`,
        },
        geometry: {
          type: "Point",
          coordinates: [spot.longitude, spot.latitude],
        },
      };
    }),
  };
}

function createEventCollection(
  events: readonly WorldMapEvent[],
  getCoordinate: (event: WorldMapEvent, index: number) => WorldMapCoordinate,
  selectedEventId: string | null | undefined,
): FeatureCollection<Point, EventFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: events.map((event, index) => {
      const meta = SPORT_META[event.sport];
      const live = event.status === "active" || event.status === "check-in";
      return {
        type: "Feature",
        properties: {
          id: event.id,
          index,
          label: event.startLabel
            ? `${meta.label} · ${event.startLabel}`
            : meta.label,
          symbol: meta.symbol,
          color: meta.color,
          selected: selectedEventId === event.id ? 1 : 0,
          live: live ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: getCoordinate(event, index) },
      };
    }),
  };
}

function createUserCollection(
  position: WorldMapCoordinate,
  user: WorldMapUser,
  moving: boolean,
): FeatureCollection<Point, UserFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          initials: (user.initials ?? user.nickname?.slice(0, 1) ?? "N").slice(0, 2),
          moving: moving ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: position },
      },
    ],
  };
}

function addMapLayers(
  map: MapLibreMap,
  route: readonly WorldMapCoordinate[],
  isNight: boolean,
) {
  map.addSource("moverse-route", {
    type: "geojson",
    lineMetrics: true,
    data: makeLineFeature(route),
  });
  map.addLayer({
    id: "moverse-route-base",
    type: "line",
    source: "moverse-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": isNight ? "#183f37" : "#ffffff",
      "line-width": 7,
      "line-opacity": isNight ? 0.62 : 0.82,
    },
  });
  map.addLayer({
    id: "moverse-route-line",
    type: "line",
    source: "moverse-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": isNight ? "#55caa6" : "#258d65",
      "line-width": 3,
      "line-opacity": 0.92,
      "line-dasharray": [1, 1.5],
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
      "line-color": isNight ? "#d7fff3" : "#163e34",
      "line-width": 4.5,
      "line-opacity": 0.94,
    },
  });

  map.addSource("moverse-spots", {
    type: "geojson",
    data: EMPTY_POINT_COLLECTION,
  });
  map.addLayer({
    id: "moverse-spots-halo",
    type: "circle",
    source: "moverse-spots",
    paint: {
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 24, 18],
      "circle-color": ["get", "color"],
      "circle-opacity": isNight ? 0.28 : 0.2,
      "circle-blur": 0.35,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-spots-core",
    type: "circle",
    source: "moverse-spots",
    paint: {
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 12, 9],
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 3, 2],
      "circle-opacity": 0.98,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-spots-symbol",
    type: "symbol",
    source: "moverse-spots",
    layout: {
      "text-field": ["get", "symbol"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "moverse-spots-label",
    type: "symbol",
    source: "moverse-spots",
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-anchor": "top",
      "text-offset": [0, 1.35],
      "text-max-width": 12,
      "text-optional": true,
      "text-padding": 6,
    },
    paint: {
      "text-color": isNight ? "#f4fbf8" : "#18322d",
      "text-halo-color": isNight ? "#10252b" : "#ffffff",
      "text-halo-width": 2,
    },
  });
  map.addLayer({
    id: "moverse-spots-hit",
    type: "circle",
    source: "moverse-spots",
    paint: { "circle-radius": 24, "circle-opacity": 0 },
  });

  map.addSource("moverse-events", {
    type: "geojson",
    data: EMPTY_POINT_COLLECTION,
  });
  map.addLayer({
    id: "moverse-events-halo",
    type: "circle",
    source: "moverse-events",
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "selected"], 1],
        25,
        ["==", ["get", "live"], 1],
        22,
        18,
      ],
      "circle-color": ["get", "color"],
      "circle-opacity": [
        "case",
        ["==", ["get", "live"], 1],
        isNight ? 0.34 : 0.26,
        isNight ? 0.24 : 0.18,
      ],
      "circle-blur": 0.4,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-events-core",
    type: "circle",
    source: "moverse-events",
    paint: {
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 13, 10],
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 3, 2],
      "circle-opacity": 0.98,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-events-symbol",
    type: "symbol",
    source: "moverse-events",
    layout: {
      "text-field": ["get", "symbol"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "moverse-events-label",
    type: "symbol",
    source: "moverse-events",
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-anchor": "top",
      "text-offset": [0, 1.55],
      "text-max-width": 14,
      "text-optional": true,
      "text-padding": 8,
    },
    paint: {
      "text-color": isNight ? "#f4fbf8" : "#1b2f2a",
      "text-halo-color": isNight ? "#10252b" : "#ffffff",
      "text-halo-width": 2,
    },
  });
  map.addLayer({
    id: "moverse-events-hit",
    type: "circle",
    source: "moverse-events",
    paint: { "circle-radius": 26, "circle-opacity": 0 },
  });

  map.addSource("moverse-user", {
    type: "geojson",
    data: EMPTY_POINT_COLLECTION,
  });
  map.addLayer({
    id: "moverse-user-aura",
    type: "circle",
    source: "moverse-user",
    paint: {
      "circle-radius": ["case", ["==", ["get", "moving"], 1], 27, 21],
      "circle-color": "#1e8f68",
      "circle-opacity": 0.2,
      "circle-blur": 0.25,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-user-core",
    type: "circle",
    source: "moverse-user",
    paint: {
      "circle-radius": 13,
      "circle-color": isNight ? "#d5fff0" : "#173f36",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: "moverse-user-label",
    type: "symbol",
    source: "moverse-user",
    layout: {
      "text-field": ["get", "initials"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": isNight ? "#173f36" : "#ffffff" },
  });
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
        pitch: 48,
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
        pitch: 48,
        duration: 720,
      });
    },
    [eventCoordinate, onSelectEvent],
  );

  const interactionRef = useRef({ spots, events, selectSpot, selectEvent });
  useEffect(() => {
    interactionRef.current = { spots, events, selectSpot, selectEvent };
  }, [events, selectEvent, selectSpot, spots]);

  const spotCollection = useMemo(
    () => createSpotCollection(spots, actualSelectedSpotId),
    [actualSelectedSpotId, spots],
  );
  const eventCollection = useMemo(
    () => createEventCollection(events, eventCoordinate, actualSelectedEventId),
    [actualSelectedEventId, eventCoordinate, events],
  );
  const userCollection = useMemo(
    () =>
      createUserCollection(
        currentUserPosition,
        user,
        progress > 0 && progress < 1,
      ),
    [currentUserPosition, progress, user],
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

        map = new maplibre.Map({
          container: mapContainerRef.current,
          style: createKeylessStyle(initialNightRef.current),
          center: stableCenter,
          zoom: 14.95,
          pitch: 42,
          bearing: -18,
          minZoom: 12,
          maxZoom: 19,
          maxPitch: 60,
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
        map.getCanvas().setAttribute("aria-label", "Moverse 여의도 활동 지도");
        map.getCanvas().setAttribute("role", "region");

        const onLoad = () => {
          if (disposed || !map) return;
          if (loadTimer) clearTimeout(loadTimer);

          try {
            addMapLayers(map, route, initialNightRef.current);

            const onMapClick = (event: MapMouseEvent) => {
              if (!map) return;
              const features = map.queryRenderedFeatures(event.point, {
                layers: ["moverse-events-hit", "moverse-spots-hit"],
              });
              const feature = features[0];
              const id = feature?.properties?.id;
              if (typeof id !== "string") return;

              if (feature.source === "moverse-events") {
                const index = Number(feature.properties?.index);
                const target = interactionRef.current.events.find(
                  (candidate) => candidate.id === id,
                );
                if (target) {
                  interactionRef.current.selectEvent(
                    target,
                    Number.isFinite(index) ? index : 0,
                  );
                }
                return;
              }

              const target = interactionRef.current.spots.find(
                (candidate) => candidate.id === id,
              );
              if (target) interactionRef.current.selectSpot(target);
            };
            const onPointerMove = (event: MapMouseEvent) => {
              if (!map) return;
              const interactive = map.queryRenderedFeatures(event.point, {
                layers: ["moverse-events-hit", "moverse-spots-hit"],
              }).length > 0;
              map.getCanvas().style.cursor = interactive ? "pointer" : "";
            };
            const resetPointer = () => {
              if (map) map.getCanvas().style.cursor = "";
            };

            map.on("click", onMapClick);
            map.on("mousemove", onPointerMove);
            map.on("mouseout", resetPointer);
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
      map?.remove();
      mapRef.current = null;
    };
  }, [route, stableCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapBooted || mapState !== "ready") return;

    try {
      map.setPaintProperty(
        "moverse-background",
        "background-color",
        isNight ? "#14242d" : "#d9e3dc",
      );
      map.setPaintProperty("osm", "raster-opacity", isNight ? 0.66 : 0.92);
      map.setPaintProperty("osm", "raster-saturation", isNight ? -0.78 : -0.12);
      map.setPaintProperty("osm", "raster-brightness-min", isNight ? 0.06 : 0.2);
      map.setPaintProperty("osm", "raster-brightness-max", isNight ? 0.46 : 0.98);
      map.setPaintProperty("moverse-route-base", "line-color", isNight ? "#183f37" : "#ffffff");
      map.setPaintProperty("moverse-route-line", "line-color", isNight ? "#55caa6" : "#258d65");
      map.setPaintProperty("moverse-progress-line", "line-color", isNight ? "#d7fff3" : "#163e34");
      map.setPaintProperty("moverse-spots-label", "text-color", isNight ? "#f4fbf8" : "#18322d");
      map.setPaintProperty("moverse-spots-label", "text-halo-color", isNight ? "#10252b" : "#ffffff");
      map.setPaintProperty("moverse-events-label", "text-color", isNight ? "#f4fbf8" : "#1b2f2a");
      map.setPaintProperty("moverse-events-label", "text-halo-color", isNight ? "#10252b" : "#ffffff");
      map.setPaintProperty("moverse-user-core", "circle-color", isNight ? "#d5fff0" : "#173f36");
      map.setPaintProperty("moverse-user-label", "text-color", isNight ? "#173f36" : "#ffffff");
    } catch {
      // A style can briefly be unavailable while the map is initializing.
    }
  }, [isNight, mapBooted, mapState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;

    const spotSource = map.getSource("moverse-spots") as GeoJSONSource | undefined;
    const eventSource = map.getSource("moverse-events") as GeoJSONSource | undefined;
    const userSource = map.getSource("moverse-user") as GeoJSONSource | undefined;
    const progressSource = map.getSource("moverse-progress") as GeoJSONSource | undefined;
    spotSource?.setData(spotCollection);
    eventSource?.setData(eventCollection);
    userSource?.setData(userCollection);
    progressSource?.setData(makeLineFeature(progressCoordinates(route, progress)));
  }, [
    eventCollection,
    mapState,
    progress,
    route,
    spotCollection,
    userCollection,
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
        mapRef.current?.easeTo({ center: next, zoom: 16.2, pitch: 46, duration: 700 });
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
      aria-label="Moverse 활동 지도"
    >
      <div ref={mapContainerRef} className="mw-world-map__canvas" />
      <div className="mw-world-map__vignette" aria-hidden="true" />

      {mapState === "fallback" ? (
        <div className="mw-map-fallback-panel" role="status">
          <WifiOff size={20} aria-hidden="true" />
          <strong>지도를 불러오지 못했어요</strong>
          <span>아래 활동 목록에서 계속 둘러볼 수 있어요.</span>
        </div>
      ) : null}

      <div className="mw-map-activity-list" aria-label="주변 활동 목록">
        <strong>주변 활동</strong>
        <div className="mw-map-activity-list__items">
          {spots.map((spot) => (
            <button
              type="button"
              key={spot.id}
              className={actualSelectedSpotId === spot.id ? "is-selected" : undefined}
              onClick={() => selectSpot(spot)}
            >
              <span className="mw-map-activity-list__dot is-spot" aria-hidden="true" />
              <span>
                <b>{spot.name}</b>
                <small>
                  활동 스팟 · {spot.distanceLabel ?? `${spot.levelNumber ?? 1}단계`}
                </small>
              </span>
            </button>
          ))}
          {events.map((event, index) => (
            <button
              type="button"
              key={event.id}
              className={actualSelectedEventId === event.id ? "is-selected" : undefined}
              onClick={() => selectEvent(event, index)}
            >
              <span
                className="mw-map-activity-list__dot"
                style={{ backgroundColor: SPORT_META[event.sport].color }}
                aria-hidden="true"
              />
              <span>
                <b>{event.title}</b>
                <small>
                  {SPORT_META[event.sport].label}
                  {event.startLabel ? ` · ${event.startLabel}` : ""}
                </small>
              </span>
            </button>
          ))}
        </div>
      </div>

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
            {isNight ? "대면 활동 종료 · 내일 예약 가능" : `활동 스팟 ${operatingEndsAt} 종료`}
          </div>

          {progress > 0 ? (
            <div className="mw-move-progress" role="status">
              <span className="mw-move-progress__icon" aria-hidden="true">
                <Navigation size={16} />
              </span>
              <span className="mw-move-progress__copy">
                <strong>{movingLabel ?? "스팟으로 이동 중"}</strong>
                <small>{Math.max(0.1, progress * 1.4).toFixed(1)}km · 에너지 +{Math.round(progress * 18)}</small>
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
          활동 목록으로 보기
        </div>
      ) : null}

      <p className="mw-sr-only" aria-live="polite">
        {locationMessage ||
          (mapState === "loading"
            ? "활동 지도를 불러오는 중입니다."
            : mapState === "fallback"
              ? "지도를 불러오지 못해 주변 활동 목록을 표시합니다."
              : "활동 지도를 사용할 수 있습니다.")}
      </p>
    </section>
  );
}

export default WorldMap;
