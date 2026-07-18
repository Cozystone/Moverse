import type { NextRequest } from "next/server";

const OSRM_FOOT_ROUTE_URL =
  "https://routing.openstreetmap.de/routed-foot/route/v1/foot";
const UPSTREAM_TIMEOUT_MS = 7_000;
const UPSTREAM_REVALIDATE_SECONDS = 5 * 60;
const MAX_ROUTE_SPAN_METERS = 50_000;
const MAX_GEOMETRY_POINTS = 20_000;
const EARTH_RADIUS_METERS = 6_371_008.8;

type Coordinate = [longitude: number, latitude: number];

type ParsedDirectionsRequest =
  | { ok: true; start: Coordinate; end: Coordinate }
  | { ok: false; message: string };

type DirectionsGeometry = {
  type: "LineString";
  coordinates: Coordinate[];
};

type OsrmRoute = {
  geometry: DirectionsGeometry;
  distance: number;
  duration: number;
};

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return Response.json(data, { ...init, headers });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  retryable = false,
) {
  return json(
    {
      ok: false,
      error: { code, message, retryable },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function parseCoordinate(value: string | null, label: string) {
  if (!value) {
    return { ok: false as const, message: `${label} is required as lon,lat` };
  }

  const parts = value.split(",").map((part) => part.trim());
  if (parts.length !== 2 || parts.some((part) => part.length === 0)) {
    return { ok: false as const, message: `${label} must use lon,lat format` };
  }

  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return { ok: false as const, message: `${label} must be a valid lon,lat pair` };
  }

  return {
    ok: true as const,
    coordinate: [roundCoordinate(longitude), roundCoordinate(latitude)] as Coordinate,
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceBetween(start: Coordinate, end: Coordinate) {
  const latitudeDelta = toRadians(end[1] - start[1]);
  const longitudeDelta = toRadians(end[0] - start[0]);
  const startLatitude = toRadians(start[1]);
  const endLatitude = toRadians(end[1]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function parseRequest(searchParams: URLSearchParams): ParsedDirectionsRequest {
  const start = parseCoordinate(searchParams.get("start"), "start");
  if (!start.ok) {
    return start;
  }

  const end = parseCoordinate(searchParams.get("end"), "end");
  if (!end.ok) {
    return end;
  }

  if (distanceBetween(start.coordinate, end.coordinate) > MAX_ROUTE_SPAN_METERS) {
    return {
      ok: false,
      message: `start and end must be within ${MAX_ROUTE_SPAN_METERS / 1_000} km`,
    };
  }

  return { ok: true, start: start.coordinate, end: end.coordinate };
}

function isCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isFiniteNumber(value[0]) &&
    value[0] >= -180 &&
    value[0] <= 180 &&
    isFiniteNumber(value[1]) &&
    value[1] >= -90 &&
    value[1] <= 90
  );
}

function parseOsrmRoute(payload: unknown): OsrmRoute | null {
  if (!isRecord(payload) || payload.code !== "Ok" || !Array.isArray(payload.routes)) {
    return null;
  }

  const candidate = payload.routes[0];
  if (
    !isRecord(candidate) ||
    !isFiniteNumber(candidate.distance) ||
    candidate.distance < 0 ||
    !isFiniteNumber(candidate.duration) ||
    candidate.duration < 0 ||
    !isRecord(candidate.geometry) ||
    candidate.geometry.type !== "LineString" ||
    !Array.isArray(candidate.geometry.coordinates) ||
    candidate.geometry.coordinates.length < 2 ||
    candidate.geometry.coordinates.length > MAX_GEOMETRY_POINTS ||
    !candidate.geometry.coordinates.every(isCoordinate)
  ) {
    return null;
  }

  return {
    geometry: {
      type: "LineString",
      coordinates: candidate.geometry.coordinates.map((coordinate) => [
        coordinate[0],
        coordinate[1],
      ]),
    },
    distance: candidate.distance,
    duration: candidate.duration,
  };
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function buildOsrmUrl(start: Coordinate, end: Coordinate) {
  const coordinates = `${start[0]},${start[1]};${end[0]},${end[1]}`;
  const url = new URL(`${OSRM_FOOT_ROUTE_URL}/${coordinates}`);
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("steps", "false");
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  return url;
}

export async function GET(request: NextRequest) {
  const parsed = parseRequest(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return errorResponse(400, "invalid_request", parsed.message);
  }

  const url = buildOsrmUrl(parsed.start, parsed.end);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Moverse-Demo/0.1 (https://github.com/Cozystone/Moverse)",
      },
      cache: "force-cache",
      next: { revalidate: UPSTREAM_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return errorResponse(
        response.status === 429 ? 503 : 502,
        "upstream_unavailable",
        "Walking directions are temporarily unavailable.",
        true,
      );
    }

    const payload: unknown = await response.json().catch(() => null);
    const route = parseOsrmRoute(payload);
    if (!route) {
      const isNoRoute = isRecord(payload) && payload.code === "NoRoute";
      return errorResponse(
        isNoRoute ? 422 : 502,
        isNoRoute ? "route_not_found" : "invalid_upstream_response",
        isNoRoute
          ? "No walkable route was found between these points."
          : "The routing service returned an invalid response.",
        !isNoRoute,
      );
    }

    const durationSeconds = Math.round(route.duration);
    return json(
      {
        ok: true,
        source: "osrm",
        profile: "walking",
        geometry: route.geometry,
        distanceMeters: Math.round(route.distance),
        durationSeconds,
        estimatedWalkingMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
        attribution: "Routing data © OpenStreetMap contributors",
      },
      {
        headers: {
          // Keep precise trip coordinates out of shared browser/CDN caches. The
          // upstream OSRM response is still cached server-side for five minutes.
          "Cache-Control": "private, max-age=30",
        },
      },
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      return errorResponse(
        504,
        "upstream_timeout",
        "Walking directions took too long to calculate.",
        true,
      );
    }

    return errorResponse(
      502,
      "upstream_error",
      "Walking directions could not be calculated.",
      true,
    );
  }
}
