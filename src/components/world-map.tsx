"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Polygon,
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
import {
  createMover3DLayer,
  MOVER_3D_MODEL_URLS,
  type Mover3DLayerHandle,
} from "@/lib/create-mover-3d-layer";
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

export interface WorldMapViewport {
  center: WorldMapCoordinate;
  zoom: number;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  visibleSpotIds: string[];
  visibleEventIds: string[];
  visiblePersonIds: string[];
}

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
  kind?: "verified-hub" | "discovery";
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
  id?: string;
  nickname?: string;
  initials?: string;
  avatarUrl?: string;
  modelId?: "nova" | "lumi" | "dash" | "mint";
  level?: number;
}

export interface WorldMapPerson {
  id: string;
  nickname: string;
  modelId: "nova" | "lumi" | "dash" | "mint";
  longitude?: number;
  latitude?: number;
  visibility: "hidden" | "approximate" | "precise";
  status?: string;
  updatedAt?: string;
  expiresAt?: string;
  accuracyMeters?: number;
  bearing?: number;
  moving?: boolean;
}

export interface WorldMapProps {
  spots?: readonly WorldMapSpot[];
  events?: readonly WorldMapEvent[];
  selectedEventId?: string | null;
  selectedSpotId?: string | null;
  onSelectEvent?: (event: WorldMapEvent) => void;
  onSelectSpot?: (spot: WorldMapSpot) => void;
  people?: readonly WorldMapPerson[];
  onSelectPerson?: (person: WorldMapPerson) => void;
  onViewportChange?: (viewport: WorldMapViewport) => void;
  isNight?: boolean;
  movingProgress?: number;
  movingLabel?: string;
  recordedRoute?: readonly WorldMapCoordinate[];
  isTracking?: boolean;
  followUser?: boolean;
  gpsAccuracyMeters?: number | null;
  routeMatched?: boolean;
  center?: WorldMapCoordinate;
  userPosition?: WorldMapCoordinate;
  user?: WorldMapUser;
  operatingEndsAt?: string;
  className?: string;
  showHud?: boolean;
}

type MapState = "loading" | "ready" | "fallback";

const DEFAULT_CENTER: WorldMapCoordinate = [126.9360586, 37.5256731];
const DEFAULT_USER: WorldMapUser = {
  id: "nova",
  nickname: "NOVA",
  initials: "N",
  modelId: "nova",
  level: 7,
};

const MOVER_3D_MODEL_BY_ID: Record<
  NonNullable<WorldMapUser["modelId"]>,
  string
> = {
  nova: MOVER_3D_MODEL_URLS[0],
  lumi: MOVER_3D_MODEL_URLS[1],
  dash: MOVER_3D_MODEL_URLS[2],
  mint: MOVER_3D_MODEL_URLS[3],
};

const MOVER_ACCENT_BY_ID: Record<
  NonNullable<WorldMapUser["modelId"]>,
  string
> = {
  nova: "#ceff3d",
  lumi: "#56e1d2",
  dash: "#ff975f",
  mint: "#58e6b7",
};
const MOVER_3D_MIN_ZOOM = 13.8;

const DEFAULT_SPOTS: readonly WorldMapSpot[] = [
  {
    id: "spot-river",
    name: "한강 러닝 게이트",
    shortName: "러닝 게이트",
    longitude: 126.9360586,
    latitude: 37.5256731,
    level: "landmark",
    levelNumber: 8,
    distanceLabel: "620m",
    verified: true,
    closesAt: "21:00",
  },
  {
    id: "spot-court",
    name: "브릿지 팀플레이 노드",
    shortName: "팀플레이 노드",
    longitude: 126.9331,
    latitude: 37.5285,
    level: "pulse",
    levelNumber: 6,
    distanceLabel: "280m",
    verified: true,
    closesAt: "20:30",
  },
  {
    id: "spot-plaza",
    name: "무버스 커뮤니티 광장",
    shortName: "커뮤니티 광장",
    longitude: 126.934,
    latitude: 37.5282,
    level: "active",
    levelNumber: 4,
    distanceLabel: "360m",
    verified: true,
    closesAt: "20:00",
  },
  {
    id: "spot-seed",
    name: "그린필드 풋살 스팟",
    shortName: "풋살 스팟",
    longitude: 126.935,
    latitude: 37.5279,
    level: "seed",
    levelNumber: 1,
    distanceLabel: "480m",
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
    spotId: "spot-boramae",
    title: "보라매 초보자 농구 3 × 3",
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
  running: { label: "러닝", symbol: "런", color: "#008f5a" },
  walking: { label: "걷기", symbol: "걷", color: "#007f73" },
  basketball: { label: "농구", symbol: "농", color: "#d85e10" },
  football: { label: "축구", symbol: "축", color: "#087c3b" },
  badminton: { label: "배드민턴", symbol: "배", color: "#0879b5" },
  plogging: { label: "플로깅", symbol: "줍", color: "#18725e" },
};

const SPOT_COLOR: Record<WorldMapSpotLevel, string> = {
  seed: "#6f8f1f",
  trail: "#23865c",
  active: "#087a53",
  pulse: "#007987",
  landmark: "#005a42",
};

const SPOT_STRUCTURE_HEIGHT: Record<WorldMapSpotLevel, number> = {
  seed: 28,
  trail: 40,
  active: 52,
  pulse: 64,
  landmark: 78,
};

const EVENT_STRUCTURE_HEIGHT: Record<
  NonNullable<WorldMapEvent["status"]>,
  number
> = {
  scheduled: 34,
  "check-in": 48,
  active: 60,
  completed: 24,
};

type SpotFeatureProperties = {
  id: string;
  label: string;
  symbol: string;
  color: string;
  selected: number;
  levelLabel: string;
  kind: "verified-hub" | "discovery";
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
  id: string;
  initials: string;
  nickname: string;
  moving: number;
};

type PersonFeatureProperties = {
  id: string;
  nickname: string;
  visibility: "approximate" | "precise";
  moving: number;
};

type StructureFeatureProperties = {
  id: string;
  kind: "spot" | "event";
  part: string;
  color: string;
  base: number;
  height: number;
  selected: number;
  live: number;
};

const EMPTY_POINT_COLLECTION: FeatureCollection<Point> = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_POLYGON_COLLECTION: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_LINE_COLLECTION: FeatureCollection<LineString> = {
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

function makeLineData(
  coordinates: readonly WorldMapCoordinate[],
): Feature<LineString> | FeatureCollection<LineString> {
  return coordinates.length >= 2 ? makeLineFeature(coordinates) : EMPTY_LINE_COLLECTION;
}

function polygonAround(
  [longitude, latitude]: WorldMapCoordinate,
  radiusMeters: number,
  sides: number,
  rotationRadians = 0,
): Polygon {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const latitudeScale = radiusMeters / 111_320;
  const longitudeScale =
    radiusMeters / (111_320 * Math.max(Math.cos(latitudeRadians), 0.2));
  const ring: WorldMapCoordinate[] = Array.from({ length: sides }, (_, index) => {
    const angle = rotationRadians + (index / sides) * Math.PI * 2;
    return [
      longitude + Math.cos(angle) * longitudeScale,
      latitude + Math.sin(angle) * latitudeScale,
    ];
  });

  ring.push([...ring[0]] as WorldMapCoordinate);
  return { type: "Polygon", coordinates: [ring] };
}

function polygonRingAround(
  center: WorldMapCoordinate,
  outerRadiusMeters: number,
  innerRadiusMeters: number,
  sides: number,
  rotationRadians = 0,
): Polygon {
  const outerRing = polygonAround(
    center,
    outerRadiusMeters,
    sides,
    rotationRadians,
  ).coordinates[0];
  const innerRing = polygonAround(
    center,
    innerRadiusMeters,
    sides,
    rotationRadians,
  ).coordinates[0]
    .slice()
    .reverse();

  return { type: "Polygon", coordinates: [outerRing, innerRing] };
}

function offsetCoordinateMeters(
  [longitude, latitude]: WorldMapCoordinate,
  eastMeters: number,
  northMeters: number,
): WorldMapCoordinate {
  const latitudeRadians = (latitude * Math.PI) / 180;
  return [
    longitude +
      eastMeters / (111_320 * Math.max(Math.cos(latitudeRadians), 0.2)),
    latitude + northMeters / 111_320,
  ];
}

function mixHexColor(color: string, target: string, amount: number) {
  const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);
  if (!isHex(color) || !isHex(target)) return color;

  const sourceValue = Number.parseInt(color.slice(1), 16);
  const targetValue = Number.parseInt(target.slice(1), 16);
  const mixChannel = (shift: number) =>
    Math.round(
      ((sourceValue >> shift) & 255) * (1 - amount) +
        ((targetValue >> shift) & 255) * amount,
    );

  return `#${[16, 8, 0]
    .map((shift) => mixChannel(shift).toString(16).padStart(2, "0"))
    .join("")}`;
}

function createStructureFeature({
  featureId,
  entityId,
  kind,
  part,
  color,
  base,
  height,
  selected,
  live,
  geometry,
}: {
  featureId: string;
  entityId: string;
  kind: StructureFeatureProperties["kind"];
  part: string;
  color: string;
  base: number;
  height: number;
  selected: number;
  live: number;
  geometry: Polygon;
}): Feature<Polygon, StructureFeatureProperties> {
  return {
    type: "Feature",
    id: featureId,
    properties: {
      id: entityId,
      kind,
      part,
      color,
      base,
      height,
      selected,
      live,
    },
    geometry,
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
          "background-color": isNight ? "#101f26" : "#cbd3ce",
          "background-opacity": 1,
        },
      },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-opacity": isNight ? 0.88 : 1,
          "raster-saturation": isNight ? -0.38 : 0.12,
          "raster-contrast": isNight ? 0.28 : 0.14,
          "raster-brightness-min": isNight ? 0.02 : 0.06,
          "raster-brightness-max": isNight ? 0.58 : 1,
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
          symbol: spot.kind === "discovery" ? "+" : level === "seed" ? "+" : "M",
          color: SPOT_COLOR[level],
          selected: selectedSpotId === spot.id ? 1 : 0,
          levelLabel: `${spot.levelNumber ?? 1}단계`,
          kind: spot.kind ?? "verified-hub",
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

function createStructureCollection(
  spots: readonly WorldMapSpot[],
  events: readonly WorldMapEvent[],
  getEventCoordinate: (
    event: WorldMapEvent,
    index: number,
  ) => WorldMapCoordinate,
  selectedSpotId: string | null | undefined,
  selectedEventId: string | null | undefined,
): FeatureCollection<Polygon, StructureFeatureProperties> {
  const spotFeatures: Feature<Polygon, StructureFeatureProperties>[] = spots
    .filter((spot) => spot.kind !== "discovery")
    .flatMap(
    (spot) => {
      const level = spot.level ?? "active";
      const selected = selectedSpotId === spot.id ? 1 : 0;
      const center: WorldMapCoordinate = [spot.longitude, spot.latitude];
      const mainColor = SPOT_COLOR[level];
      const baseColor = mixHexColor(mainColor, "#061b15", 0.48);
      const crownColor = selected
        ? "#ceff3d"
        : mixHexColor(mainColor, "#dffff2", 0.3);
      const bodyTop = SPOT_STRUCTURE_HEIGHT[level] + selected * 10;
      const pedestalRadius =
        level === "landmark" ? 17 : level === "pulse" ? 15.5 : 14;
      const crownHeight = level === "landmark" ? 8 : 6;
      const crownBase = bodyTop - 1.5;
      const crownTop = bodyTop + crownHeight;
      const usesTwinColumns = level !== "seed";
      const hasBeacon =
        selected === 1 || level === "active" || level === "pulse" || level === "landmark";
      const features: Feature<Polygon, StructureFeatureProperties>[] = [
        createStructureFeature({
          featureId: `${spot.id}:pedestal`,
          entityId: spot.id,
          kind: "spot",
          part: "pedestal",
          color: baseColor,
          base: 0.4,
          height: 4.8,
          selected,
          live: 0,
          geometry: polygonAround(center, pedestalRadius, 10, Math.PI / 10),
        }),
      ];

      if (usesTwinColumns) {
        const columnOffset = level === "landmark" ? 6 : 5.2;
        const columnRadius = level === "landmark" ? 5.2 : 4.5;
        ([
          ["west", -columnOffset],
          ["east", columnOffset],
        ] as const).forEach(([side, eastMeters]) => {
          features.push(
            createStructureFeature({
              featureId: `${spot.id}:body-${side}`,
              entityId: spot.id,
              kind: "spot",
              part: `body-${side}`,
              color: mainColor,
              base: 3.8,
              height: bodyTop,
              selected,
              live: 0,
              geometry: polygonAround(
                offsetCoordinateMeters(center, eastMeters, 0),
                columnRadius,
                8,
                Math.PI / 8,
              ),
            }),
          );
        });
      } else {
        features.push(
          createStructureFeature({
            featureId: `${spot.id}:body`,
            entityId: spot.id,
            kind: "spot",
            part: "body",
            color: mainColor,
            base: 3.8,
            height: bodyTop,
            selected,
            live: 0,
            geometry: polygonAround(center, 7.6, 8, Math.PI / 8),
          }),
        );
      }

      features.push(
        createStructureFeature({
          featureId: `${spot.id}:crown`,
          entityId: spot.id,
          kind: "spot",
          part: "crown",
          color: crownColor,
          base: crownBase,
          height: crownTop,
          selected,
          live: 0,
          geometry: polygonAround(
            center,
            pedestalRadius * 0.72,
            10,
            Math.PI / 10,
          ),
        }),
      );

      if (hasBeacon) {
        const beaconHeight =
          level === "landmark" ? 20 : level === "pulse" ? 15 : 11;
        features.push(
          createStructureFeature({
            featureId: `${spot.id}:beacon`,
            entityId: spot.id,
            kind: "spot",
            part: "beacon",
            color: selected ? "#efffb3" : "#bfffe5",
            base: crownTop - 0.8,
            height: crownTop + beaconHeight,
            selected,
            live: 0,
            geometry: polygonAround(
              center,
              level === "landmark" ? 3 : 2.4,
              6,
              Math.PI / 6,
            ),
          }),
        );
      }

      return features;
    },
  );

  const eventFeatures: Feature<Polygon, StructureFeatureProperties>[] = events.flatMap(
    (event, index) => {
      const status = event.status ?? "scheduled";
      const live = status === "active" || status === "check-in";
      const selected = selectedEventId === event.id ? 1 : 0;
      const liveValue = live ? 1 : 0;
      const center = getEventCoordinate(event, index);
      const mainColor = SPORT_META[event.sport].color;
      const baseColor = mixHexColor(mainColor, "#071b16", 0.5);
      const floorColor = mixHexColor(mainColor, "#ffffff", 0.45);
      const rimColor = selected ? "#ceff3d" : mainColor;
      const pylonTop =
        EVENT_STRUCTURE_HEIGHT[status] + selected * 10 + liveValue * 8;
      const features: Feature<Polygon, StructureFeatureProperties>[] = [
        createStructureFeature({
          featureId: `${event.id}:arena-base`,
          entityId: event.id,
          kind: "event",
          part: "arena-base",
          color: baseColor,
          base: 0.4,
          height: 3.6,
          selected,
          live: liveValue,
          geometry: polygonAround(center, 16, 12, Math.PI / 12),
        }),
        createStructureFeature({
          featureId: `${event.id}:arena-floor`,
          entityId: event.id,
          kind: "event",
          part: "arena-floor",
          color: floorColor,
          base: 3.4,
          height: 4.8,
          selected,
          live: liveValue,
          geometry: polygonAround(center, 8.8, 12, Math.PI / 12),
        }),
        createStructureFeature({
          featureId: `${event.id}:arena-rim`,
          entityId: event.id,
          kind: "event",
          part: "arena-rim",
          color: rimColor,
          base: 3.4,
          height: 10 + selected * 2 + liveValue * 2,
          selected,
          live: liveValue,
          geometry: polygonRingAround(center, 14, 9, 12, Math.PI / 12),
        }),
      ];

      for (let pylonIndex = 0; pylonIndex < 4; pylonIndex += 1) {
        const angle = Math.PI / 4 + (pylonIndex * Math.PI) / 2;
        features.push(
          createStructureFeature({
            featureId: `${event.id}:pylon-${pylonIndex}`,
            entityId: event.id,
            kind: "event",
            part: "arena-pylon",
            color: mainColor,
            base: 3.5,
            height: pylonTop,
            selected,
            live: liveValue,
            geometry: polygonAround(
              offsetCoordinateMeters(
                center,
                Math.cos(angle) * 11.2,
                Math.sin(angle) * 11.2,
              ),
              2.2,
              6,
              Math.PI / 6,
            ),
          }),
        );
      }

      if (live || selected === 1) {
        features.push(
          createStructureFeature({
            featureId: `${event.id}:arena-beacon`,
            entityId: event.id,
            kind: "event",
            part: "arena-beacon",
            color: selected ? "#efffb3" : "#bfffe5",
            base: 4.6,
            height: pylonTop + 9,
            selected,
            live: liveValue,
            geometry: polygonAround(center, 1.9, 6, Math.PI / 6),
          }),
        );
      }

      return features;
    },
  );

  return {
    type: "FeatureCollection",
    features: [...spotFeatures, ...eventFeatures],
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
          id: user.id ?? "nova",
          initials: (user.initials ?? user.nickname?.slice(0, 1) ?? "N").slice(0, 2),
          nickname: user.nickname ?? "NOVA",
          moving: moving ? 1 : 0,
        },
        geometry: { type: "Point", coordinates: position },
      },
    ],
  };
}

function createPeopleCollection(
  people: readonly WorldMapPerson[],
): FeatureCollection<Point, PersonFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: people.flatMap((person) => {
      if (
        person.visibility === "hidden" ||
        !Number.isFinite(person.longitude) ||
        !Number.isFinite(person.latitude)
      ) {
        return [];
      }

      return [
        {
          type: "Feature" as const,
          properties: {
            id: person.id,
            nickname: person.nickname,
            visibility: person.visibility,
            moving: person.moving ? 1 : 0,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [person.longitude as number, person.latitude as number],
          },
        },
      ];
    }),
  };
}

function addStructureLayers(map: MapLibreMap, isNight: boolean) {
  try {
    map.addSource("moverse-structures", {
      type: "geojson",
      maxzoom: 19,
      data: EMPTY_POLYGON_COLLECTION,
    });

    map.addLayer(
      {
        id: "moverse-spots-3d",
        type: "fill-extrusion",
        source: "moverse-structures",
        minzoom: 14.2,
        filter: ["==", ["get", "kind"], "spot"],
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-opacity": isNight ? 0.86 : 0.92,
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-vertical-gradient": true,
        },
      },
      "moverse-spots-symbol",
    );

    map.addLayer(
      {
        id: "moverse-events-3d",
        type: "fill-extrusion",
        source: "moverse-structures",
        minzoom: 14.2,
        filter: ["==", ["get", "kind"], "event"],
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-opacity": isNight ? 0.88 : 0.94,
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-vertical-gradient": true,
        },
      },
      "moverse-events-symbol",
    );
  } catch {
    // Keep the existing 2D point layers as a complete fallback on older WebGL devices.
  }
}

function addMapLayers(
  map: MapLibreMap,
  route: readonly WorldMapCoordinate[],
  isNight: boolean,
) {
  map.addSource("moverse-route", {
    type: "geojson",
    lineMetrics: true,
    data: makeLineData(route),
  });
  map.addLayer({
    id: "moverse-route-base",
    type: "line",
    source: "moverse-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": isNight ? "#102d28" : "#ffffff",
      "line-width": 8,
      "line-opacity": isNight ? 0.82 : 0.96,
    },
  });
  map.addLayer({
    id: "moverse-route-line",
    type: "line",
    source: "moverse-route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": isNight ? "#5dd2aa" : "#006b49",
      "line-width": 3.5,
      "line-opacity": 1,
      "line-dasharray": [1, 1.5],
    },
  });

  map.addSource("moverse-progress", {
    type: "geojson",
    data: makeLineData(progressCoordinates(route, 0)),
  });
  map.addLayer({
    id: "moverse-progress-line",
    type: "line",
    source: "moverse-progress",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": isNight ? "#f4fff9" : "#091f1a",
      "line-width": 5,
      "line-opacity": 1,
    },
  });

  map.addSource("moverse-spots", {
    type: "geojson",
    data: EMPTY_POINT_COLLECTION,
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 58,
  });
  map.addLayer({
    id: "moverse-spot-clusters",
    type: "circle",
    source: "moverse-spots",
    maxzoom: 14,
    filter: ["has", "point_count"],
    paint: {
      "circle-radius": ["step", ["get", "point_count"], 20, 4, 24, 8, 29],
      "circle-color": isNight ? "#163e34" : "#0b664c",
      "circle-stroke-color": isNight ? "#d9fff1" : "#ffffff",
      "circle-stroke-width": 3,
      "circle-opacity": 0.96,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-spot-cluster-count",
    type: "symbol",
    source: "moverse-spots",
    maxzoom: 14,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 12,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "moverse-spots-halo",
    type: "circle",
    source: "moverse-spots",
    minzoom: 13.8,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "selected"], 1],
        24,
        ["==", ["get", "kind"], "discovery"],
        13,
        18,
      ],
      "circle-color": ["get", "color"],
      "circle-opacity": isNight ? 0.32 : 0.24,
      "circle-blur": 0.28,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-spots-core",
    type: "circle",
    source: "moverse-spots",
    minzoom: 13.8,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "selected"], 1],
        13,
        ["==", ["get", "kind"], "discovery"],
        7,
        10,
      ],
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
    minzoom: 13.8,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "text-field": ["get", "symbol"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "moverse-spots-label",
    type: "symbol",
    source: "moverse-spots",
    minzoom: 15.3,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 1.35],
      "text-max-width": 12,
      "text-optional": true,
      "text-padding": 6,
    },
    paint: {
      "text-color": isNight ? "#ffffff" : "#071b16",
      "text-halo-color": isNight ? "#07161a" : "#ffffff",
      "text-halo-width": 2.5,
      "text-halo-blur": 0.2,
    },
  });
  map.addLayer({
    id: "moverse-spots-hit",
    type: "circle",
    source: "moverse-spots",
    minzoom: 13.8,
    filter: ["!", ["has", "point_count"]],
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
    minzoom: 13.8,
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
        isNight ? 0.38 : 0.3,
        isNight ? 0.28 : 0.22,
      ],
      "circle-blur": 0.3,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-events-core",
    type: "circle",
    source: "moverse-events",
    minzoom: 13.8,
    paint: {
      "circle-radius": ["case", ["==", ["get", "selected"], 1], 14, 11],
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
    minzoom: 13.8,
    layout: {
      "text-field": ["get", "symbol"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: "moverse-events-label",
    type: "symbol",
    source: "moverse-events",
    minzoom: 15.3,
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 1.55],
      "text-max-width": 14,
      "text-optional": true,
      "text-padding": 8,
    },
    paint: {
      "text-color": isNight ? "#ffffff" : "#071b16",
      "text-halo-color": isNight ? "#07161a" : "#ffffff",
      "text-halo-width": 2.5,
      "text-halo-blur": 0.2,
    },
  });
  map.addLayer({
    id: "moverse-events-hit",
    type: "circle",
    source: "moverse-events",
    minzoom: 13.8,
    paint: { "circle-radius": 26, "circle-opacity": 0 },
  });

  addStructureLayers(map, isNight);

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
      "circle-radius": 9,
      "circle-color": "#020504",
      "circle-opacity": 0.28,
      "circle-stroke-color": "#c8ff38",
      "circle-stroke-width": 2,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-user-label",
    type: "symbol",
    source: "moverse-user",
    layout: {
      "text-field": ["get", "nickname"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11.5,
      "text-anchor": "top",
      "text-offset": [0, 3.25],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#07110e",
      "text-halo-width": 3,
    },
  });

  map.addSource("moverse-people", {
    type: "geojson",
    data: EMPTY_POINT_COLLECTION,
  });
  map.addLayer({
    id: "moverse-people-aura",
    type: "circle",
    source: "moverse-people",
    minzoom: 13.8,
    paint: {
      "circle-radius": ["case", ["==", ["get", "moving"], 1], 24, 18],
      "circle-color": [
        "case",
        ["==", ["get", "visibility"], "approximate"],
        "#79a89b",
        "#66e7c0",
      ],
      "circle-opacity": [
        "case",
        ["==", ["get", "visibility"], "approximate"],
        0.12,
        0.2,
      ],
      "circle-blur": 0.32,
      "circle-pitch-alignment": "map",
    },
  });
  map.addLayer({
    id: "moverse-people-label",
    type: "symbol",
    source: "moverse-people",
    minzoom: 14.8,
    layout: {
      "text-field": ["get", "nickname"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 3.1],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#07110e",
      "text-halo-width": 3,
    },
  });
  map.addLayer({
    id: "moverse-people-hit",
    type: "circle",
    source: "moverse-people",
    minzoom: 13.8,
    paint: { "circle-radius": 36, "circle-opacity": 0.001 },
  });
}

export function WorldMap({
  spots: spotsProp,
  events: eventsProp,
  selectedEventId,
  selectedSpotId,
  onSelectEvent,
  onSelectSpot,
  people = [],
  onSelectPerson,
  onViewportChange,
  isNight = false,
  movingProgress = 0,
  movingLabel,
  recordedRoute,
  isTracking,
  followUser = true,
  gpsAccuracyMeters,
  routeMatched = false,
  center = DEFAULT_CENTER,
  userPosition,
  user = DEFAULT_USER,
  operatingEndsAt = "21:00",
  className,
  showHud = true,
}: WorldMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mover3DRef = useRef<Mover3DLayerHandle | null>(null);
  const initialNightRef = useRef(isNight);
  const [mapState, setMapState] = useState<MapState>("loading");
  const [mapBooted, setMapBooted] = useState(false);
  const [bearing, setBearing] = useState(-18);
  const [locationMessage, setLocationMessage] = useState("");
  const [localSelectedEventId, setLocalSelectedEventId] = useState<string | null>(null);
  const [localSelectedSpotId, setLocalSelectedSpotId] = useState<string | null>(null);
  const [localSelectedPersonId, setLocalSelectedPersonId] = useState<string | null>(null);
  const [locatedPosition, setLocatedPosition] = useState<WorldMapCoordinate | null>(null);
  const [visibleSpotIds, setVisibleSpotIds] = useState<string[] | null>(null);
  const [visibleEventIds, setVisibleEventIds] = useState<string[] | null>(null);
  const [visiblePersonIds, setVisiblePersonIds] = useState<string[] | null>(null);

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
  const demoRoute = useMemo(
    () => routeCoordinates(stableCenter),
    [stableCenter],
  );
  const hasRecordedRoute = recordedRoute !== undefined;
  const route = hasRecordedRoute ? recordedRoute : demoRoute;
  const simulatedPosition = useMemo(
    () => pointAlongRoute(demoRoute, progress),
    [demoRoute, progress],
  );
  const recordedPosition = route.length > 0 ? route[route.length - 1] : null;
  const currentUserPosition =
    userPosition ?? recordedPosition ?? locatedPosition ?? simulatedPosition;
  const initialCameraCenterRef = useRef<WorldMapCoordinate>(currentUserPosition);
  const moving = isTracking ?? (progress > 0 && progress < 1);
  const shareablePeople = useMemo(
    () =>
      people.filter(
        (person) =>
          person.visibility !== "hidden" &&
          Number.isFinite(person.longitude) &&
          Number.isFinite(person.latitude),
      ),
    [people],
  );
  const mover3DPeople = useMemo(() => {
    const selfModelId = user.modelId ?? "nova";
    return [
      {
        id: user.id ?? "nova",
        modelUrl: MOVER_3D_MODEL_BY_ID[selfModelId],
        lng: currentUserPosition[0],
        lat: currentUserPosition[1],
        bearing: moving ? 22 : -12,
        animation: moving ? ("sprint" as const) : ("idle" as const),
        accent: MOVER_ACCENT_BY_ID[selfModelId],
        privacy: "precise" as const,
        scale: 20,
      },
      ...shareablePeople.map((person) => ({
        id: person.id,
        modelUrl: MOVER_3D_MODEL_BY_ID[person.modelId],
        lng: person.longitude as number,
        lat: person.latitude as number,
        bearing: person.bearing ?? 0,
        animation: person.moving ? ("walk" as const) : ("idle" as const),
        accent: MOVER_ACCENT_BY_ID[person.modelId],
        privacy: person.visibility,
        scale: 17.5,
      })),
    ];
  }, [currentUserPosition, moving, shareablePeople, user.id, user.modelId]);

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

  const viewportDataRef = useRef({
    spots,
    events,
    people: shareablePeople,
    eventCoordinate,
    onViewportChange,
  });
  const publishViewportRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    viewportDataRef.current = {
      spots,
      events,
      people: shareablePeople,
      eventCoordinate,
      onViewportChange,
    };
  }, [eventCoordinate, events, onViewportChange, shareablePeople, spots]);

  const selectSpot = useCallback(
    (spot: WorldMapSpot) => {
      setLocalSelectedSpotId(spot.id);
      setLocalSelectedEventId(null);
      setLocalSelectedPersonId(null);
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
      setLocalSelectedPersonId(null);
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

  const selectPerson = useCallback(
    (person: WorldMapPerson) => {
      if (!Number.isFinite(person.longitude) || !Number.isFinite(person.latitude)) return;
      setLocalSelectedPersonId(person.id);
      setLocalSelectedEventId(null);
      setLocalSelectedSpotId(null);
      onSelectPerson?.(person);
      mapRef.current?.easeTo({
        center: [person.longitude as number, person.latitude as number],
        zoom: 16.7,
        pitch: 52,
        duration: 680,
      });
    },
    [onSelectPerson],
  );

  const interactionRef = useRef({
    spots,
    events,
    people: shareablePeople,
    selectSpot,
    selectEvent,
    selectPerson,
  });
  useEffect(() => {
    interactionRef.current = {
      spots,
      events,
      people: shareablePeople,
      selectSpot,
      selectEvent,
      selectPerson,
    };
  }, [events, selectEvent, selectPerson, selectSpot, shareablePeople, spots]);

  const spotCollection = useMemo(
    () => createSpotCollection(spots, actualSelectedSpotId),
    [actualSelectedSpotId, spots],
  );
  const eventCollection = useMemo(
    () => createEventCollection(events, eventCoordinate, actualSelectedEventId),
    [actualSelectedEventId, eventCoordinate, events],
  );
  const structureCollection = useMemo(
    () =>
      createStructureCollection(
        spots,
        events,
        eventCoordinate,
        actualSelectedSpotId,
        actualSelectedEventId,
      ),
    [
      actualSelectedEventId,
      actualSelectedSpotId,
      eventCoordinate,
      events,
      spots,
    ],
  );
  const userCollection = useMemo(
    () =>
      createUserCollection(
        currentUserPosition,
        user,
        moving,
      ),
    [currentUserPosition, moving, user],
  );
  const peopleCollection = useMemo(
    () => createPeopleCollection(shareablePeople),
    [shareablePeople],
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
          center: initialCameraCenterRef.current,
          zoom: 15.3,
          pitch: 42,
          bearing: -18,
          minZoom: 10.4,
          maxZoom: 19,
          maxPitch: 60,
          attributionControl: false,
          canvasContextAttributes: { antialias: true },
          renderWorldCopies: false,
          fadeDuration: 0,
        });
        mapRef.current = map;
        setMapBooted(true);

        map.addControl(
          new maplibre.AttributionControl({ compact: true }),
          "bottom-right",
        );
        map.getCanvas().setAttribute("aria-label", "Moverse 서울 활동 지도");
        map.getCanvas().setAttribute("role", "region");

        const onLoad = () => {
          if (disposed || !map) return;
          if (loadTimer) clearTimeout(loadTimer);

          try {
            addMapLayers(map, [], initialNightRef.current);

            try {
              const movers3D = createMover3DLayer({
                id: "moverse-people-3d",
                minZoom: MOVER_3D_MIN_ZOOM,
                maxPeople: 4,
                defaultScale: 2.45,
                referenceZoom: 15.3,
              });
              map.addLayer(movers3D.layer, "moverse-user-label");
              mover3DRef.current = movers3D;
            } catch {
              // The map remains fully usable with the footprint and name layers.
            }

            const publishViewport = () => {
              if (!map) return;
              const bounds = map.getBounds();
              const mapCenter = map.getCenter();
              const data = viewportDataRef.current;
              const nextVisibleSpotIds = data.spots
                .filter((spot) => bounds.contains([spot.longitude, spot.latitude]))
                .map((spot) => spot.id);
              const nextVisibleEventIds = data.events
                .filter((activity, index) =>
                  bounds.contains(data.eventCoordinate(activity, index)),
                )
                .map((activity) => activity.id);
              const nextVisiblePersonIds = data.people
                .filter(
                  (person) =>
                    typeof person.longitude === "number" &&
                    typeof person.latitude === "number" &&
                    bounds.contains([person.longitude, person.latitude]),
                )
                .map((person) => person.id);
              const viewport: WorldMapViewport = {
                center: [mapCenter.lng, mapCenter.lat],
                zoom: map.getZoom(),
                bounds: {
                  west: bounds.getWest(),
                  south: bounds.getSouth(),
                  east: bounds.getEast(),
                  north: bounds.getNorth(),
                },
                visibleSpotIds: nextVisibleSpotIds,
                visibleEventIds: nextVisibleEventIds,
                visiblePersonIds: nextVisiblePersonIds,
              };

              setVisibleSpotIds(nextVisibleSpotIds);
              setVisibleEventIds(nextVisibleEventIds);
              setVisiblePersonIds(nextVisiblePersonIds);
              data.onViewportChange?.(viewport);
            };
            publishViewportRef.current = publishViewport;

            const onMapClick = (event: MapMouseEvent) => {
              if (!map) return;
              const activeMap = map;

              const personAtPoint = activeMap.getZoom() >= MOVER_3D_MIN_ZOOM
                ? interactionRef.current.people
                .flatMap((person) => {
                  if (typeof person.longitude !== "number" || typeof person.latitude !== "number") {
                    return [];
                  }

                  const anchor = activeMap.project([person.longitude, person.latitude]);
                  const deltaX = Math.abs(event.point.x - anchor.x);
                  const deltaY = event.point.y - anchor.y;

                  // The GLB grows upward from its geographic anchor, so keep the
                  // whole visible character tappable without detaching the hit
                  // target from the map coordinate.
                  const isInsideModel = deltaX <= 42 && deltaY >= -82 && deltaY <= 28;
                  return {
                    person,
                    isInsideModel,
                    distance: Math.hypot(deltaX, deltaY),
                  };
                })
                .filter((candidate) => candidate.isInsideModel)
                .sort((left, right) => left.distance - right.distance)[0]
                : undefined;

              if (personAtPoint) {
                interactionRef.current.selectPerson(personAtPoint.person);
                return;
              }

              const features = map.queryRenderedFeatures(event.point, {
                layers: [
                  "moverse-people-hit",
                  "moverse-people-label",
                  "moverse-people-aura",
                  "moverse-spot-clusters",
                  "moverse-events-hit",
                  "moverse-spots-hit",
                ],
              });
              const personFeature = features.find(
                (candidate) => candidate.source === "moverse-people",
              );
              const personId = personFeature?.properties?.id;
              if (typeof personId === "string") {
                const target = interactionRef.current.people.find(
                  (candidate) => candidate.id === personId,
                );
                if (target) interactionRef.current.selectPerson(target);
                return;
              }

              const feature = features[0];
              if (feature?.layer.id === "moverse-spot-clusters") {
                const clusterId = Number(feature.properties?.cluster_id);
                if (feature.geometry.type !== "Point" || !Number.isFinite(clusterId)) return;
                const source = map.getSource("moverse-spots") as GeoJSONSource | undefined;
                const [longitude, latitude] = feature.geometry.coordinates;
                if (!source || typeof longitude !== "number" || typeof latitude !== "number") return;
                void source.getClusterExpansionZoom(clusterId).then((zoom) => {
                  map?.easeTo({
                    center: [longitude, latitude],
                    zoom: Math.min(zoom, 15.2),
                    pitch: 42,
                    duration: 620,
                  });
                });
                return;
              }
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
                layers: [
                  "moverse-people-hit",
                  "moverse-people-label",
                  "moverse-people-aura",
                  "moverse-spot-clusters",
                  "moverse-events-hit",
                  "moverse-spots-hit",
                ],
              }).length > 0;
              map.getCanvas().style.cursor = interactive ? "pointer" : "";
            };
            const resetPointer = () => {
              if (map) map.getCanvas().style.cursor = "";
            };

            map.on("click", onMapClick);
            map.on("mousemove", onPointerMove);
            map.on("mouseout", resetPointer);
            map.on("moveend", publishViewport);
            publishViewport();
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
      publishViewportRef.current = null;
      mover3DRef.current?.destroy();
      mover3DRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, [stableCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapBooted || mapState !== "ready") return;

    try {
      map.setPaintProperty(
        "moverse-background",
        "background-color",
        isNight ? "#101f26" : "#cbd3ce",
      );
      map.setPaintProperty("osm", "raster-opacity", isNight ? 0.88 : 1);
      map.setPaintProperty("osm", "raster-saturation", isNight ? -0.38 : 0.12);
      map.setPaintProperty("osm", "raster-contrast", isNight ? 0.28 : 0.14);
      map.setPaintProperty("osm", "raster-brightness-min", isNight ? 0.02 : 0.06);
      map.setPaintProperty("osm", "raster-brightness-max", isNight ? 0.58 : 1);
      map.setPaintProperty("moverse-route-base", "line-color", isNight ? "#102d28" : "#ffffff");
      map.setPaintProperty("moverse-route-line", "line-color", isNight ? "#5dd2aa" : "#006b49");
      map.setPaintProperty("moverse-progress-line", "line-color", isNight ? "#f4fff9" : "#091f1a");
      map.setPaintProperty("moverse-spots-halo", "circle-opacity", isNight ? 0.32 : 0.24);
      map.setPaintProperty("moverse-spots-label", "text-color", isNight ? "#ffffff" : "#071b16");
      map.setPaintProperty("moverse-spots-label", "text-halo-color", isNight ? "#07161a" : "#ffffff");
      map.setPaintProperty("moverse-events-halo", "circle-opacity", [
        "case",
        ["==", ["get", "live"], 1],
        isNight ? 0.38 : 0.3,
        isNight ? 0.28 : 0.22,
      ]);
      map.setPaintProperty("moverse-events-label", "text-color", isNight ? "#ffffff" : "#071b16");
      map.setPaintProperty("moverse-events-label", "text-halo-color", isNight ? "#07161a" : "#ffffff");
      if (map.getLayer("moverse-spots-3d")) {
        map.setPaintProperty(
          "moverse-spots-3d",
          "fill-extrusion-opacity",
          isNight ? 0.86 : 0.92,
        );
      }
      if (map.getLayer("moverse-events-3d")) {
        map.setPaintProperty(
          "moverse-events-3d",
          "fill-extrusion-opacity",
          isNight ? 0.88 : 0.94,
        );
      }
      map.setPaintProperty(
        "moverse-user-core",
        "circle-stroke-color",
        isNight ? "#d7ff63" : "#b8f236",
      );
      map.setPaintProperty("moverse-user-label", "text-color", "#ffffff");
    } catch {
      // A style can briefly be unavailable while the map is initializing.
    }
  }, [isNight, mapBooted, mapState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    try {
      map.setPaintProperty(
        "moverse-progress-line",
        "line-color",
        routeMatched ? "#d9ff63" : isNight ? "#f4fff9" : "#091f1a",
      );
    } catch {
      // The route layer can be unavailable during a style transition.
    }
  }, [isNight, mapState, routeMatched]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    const spotSource = map.getSource("moverse-spots") as GeoJSONSource | undefined;
    spotSource?.setData(spotCollection);
  }, [mapState, spotCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    const eventSource = map.getSource("moverse-events") as GeoJSONSource | undefined;
    eventSource?.setData(eventCollection);
  }, [eventCollection, mapState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    const userSource = map.getSource("moverse-user") as GeoJSONSource | undefined;
    const peopleSource = map.getSource("moverse-people") as GeoJSONSource | undefined;
    userSource?.setData(userCollection);
    peopleSource?.setData(peopleCollection);
  }, [mapState, peopleCollection, userCollection]);

  useEffect(() => {
    if (mapState !== "ready") return;
    mover3DRef.current?.update(mover3DPeople);
  }, [mapState, mover3DPeople]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;
    const routeSource = map.getSource("moverse-route") as GeoJSONSource | undefined;
    const progressSource = map.getSource("moverse-progress") as GeoJSONSource | undefined;
    routeSource?.setData(makeLineData(route));
    progressSource?.setData(
      makeLineData(hasRecordedRoute ? route : progressCoordinates(route, progress)),
    );
  }, [hasRecordedRoute, mapState, progress, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      mapState !== "ready" ||
      !moving ||
      !followUser ||
      !currentUserPosition ||
      map.isMoving()
    ) return;
    map.easeTo({
      center: currentUserPosition,
      zoom: Math.max(map.getZoom(), 16.1),
      pitch: Math.max(map.getPitch(), 46),
      duration: 360,
    });
  }, [currentUserPosition, followUser, mapState, moving]);

  useEffect(() => {
    if (mapState !== "ready") return;
    publishViewportRef.current?.();
  }, [eventCoordinate, events, mapState, shareablePeople, spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapState !== "ready") return;

    const structureSource = map.getSource("moverse-structures") as
      | GeoJSONSource
      | undefined;
    structureSource?.setData(structureCollection);
  }, [mapState, structureCollection]);

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

  const visibleSpotIdSet = visibleSpotIds ? new Set(visibleSpotIds) : null;
  const visibleEventIdSet = visibleEventIds ? new Set(visibleEventIds) : null;
  const visiblePersonIdSet = visiblePersonIds ? new Set(visiblePersonIds) : null;
  const visibleSpots = (
    visibleSpotIdSet
      ? spots.filter((spot) => visibleSpotIdSet.has(spot.id))
      : spots
  ).slice(0, 18);
  const visibleEvents = visibleEventIdSet
    ? events.filter((event) => visibleEventIdSet.has(event.id))
    : events;
  const visiblePeople = visiblePersonIdSet
    ? shareablePeople.filter((person) => visiblePersonIdSet.has(person.id))
    : shareablePeople;

  const progressStyle = {
    "--mw-progress": progress,
    "--mw-bearing": `${-bearing}deg`,
  } as CSSProperties;

  return (
    <section
      className={mapClassName}
      data-map-state={mapState}
      data-moving={moving ? "true" : "false"}
      data-route-matched={routeMatched ? "true" : "false"}
      data-gps-accuracy={gpsAccuracyMeters ? Math.round(gpsAccuracyMeters) : undefined}
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
          {visiblePeople.map((person) => (
            <button
              type="button"
              key={person.id}
              className={localSelectedPersonId === person.id ? "is-selected" : undefined}
              onClick={() => selectPerson(person)}
            >
              <span className="mw-map-activity-list__dot is-person" aria-hidden="true" />
              <span>
                <b>{person.nickname}</b>
                <small>
                  Move Mate · {person.visibility === "precise" ? "정밀 위치 공유" : "대략 위치 공유"}
                </small>
              </span>
            </button>
          ))}
          {visibleSpots.map((spot) => (
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
          {visibleEvents.map((event) => {
            const eventIndex = events.findIndex((candidate) => candidate.id === event.id);
            return (
            <button
              type="button"
              key={event.id}
              className={actualSelectedEventId === event.id ? "is-selected" : undefined}
              onClick={() => selectEvent(event, Math.max(0, eventIndex))}
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
            );
          })}
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
