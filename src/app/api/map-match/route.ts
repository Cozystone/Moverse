const GEOAPIFY_MAP_MATCHING_URL = "https://api.geoapify.com/v1/mapmatching";
const MAX_POINTS = 1_000;
const MAX_ACCURACY_METERS = 10_000;
const MAX_BODY_BYTES = 512_000;
const UPSTREAM_TIMEOUT_MS = 8_000;
const EARTH_RADIUS_METERS = 6_371_008.8;

type Coordinate = [longitude: number, latitude: number];

type NormalizedPoint = {
  coordinate: Coordinate;
  timestamp?: string;
};

type ValidationResult =
  | { ok: true; points: NormalizedPoint[] }
  | { ok: false; message: string };

type FallbackReason =
  | "missing_api_key"
  | "upstream_timeout"
  | "upstream_error"
  | "invalid_upstream_response";

type MapMatchResult = {
  coordinates: Coordinate[];
  distance: number;
};

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return Response.json(data, { ...init, headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" && !isFiniteNumber(value)) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function validateBody(body: unknown): ValidationResult {
  if (!isRecord(body) || !Array.isArray(body.points)) {
    return { ok: false, message: "points must be an array" };
  }

  if (body.points.length < 2 || body.points.length > MAX_POINTS) {
    return {
      ok: false,
      message: `points must contain between 2 and ${MAX_POINTS} entries`,
    };
  }

  const points: NormalizedPoint[] = [];

  for (let index = 0; index < body.points.length; index += 1) {
    const candidate = body.points[index];
    if (!isRecord(candidate)) {
      return { ok: false, message: `points[${index}] must be an object` };
    }

    const { longitude, latitude, accuracy } = candidate;
    if (
      !isFiniteNumber(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !isFiniteNumber(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      return {
        ok: false,
        message: `points[${index}] must contain valid longitude and latitude`,
      };
    }

    if (
      accuracy !== undefined &&
      (!isFiniteNumber(accuracy) || accuracy < 0 || accuracy > MAX_ACCURACY_METERS)
    ) {
      return {
        ok: false,
        message: `points[${index}].accuracy must be between 0 and ${MAX_ACCURACY_METERS}`,
      };
    }

    const timestamp = normalizeTimestamp(candidate.timestamp);
    if (timestamp === null) {
      return {
        ok: false,
        message: `points[${index}].timestamp must be an ISO date or epoch milliseconds`,
      };
    }

    points.push({
      coordinate: [longitude, latitude],
      ...(timestamp === undefined ? {} : { timestamp }),
    });
  }

  return { ok: true, points };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistance(coordinates: readonly Coordinate[]) {
  let distance = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const [startLongitude, startLatitude] = coordinates[index - 1];
    const [endLongitude, endLatitude] = coordinates[index];
    const latitudeDelta = toRadians(endLatitude - startLatitude);
    const longitudeDelta = toRadians(endLongitude - startLongitude);
    const startLatitudeRadians = toRadians(startLatitude);
    const endLatitudeRadians = toRadians(endLatitude);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(startLatitudeRadians) *
        Math.cos(endLatitudeRadians) *
        Math.sin(longitudeDelta / 2) ** 2;

    distance +=
      2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }

  return Math.round(distance);
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

function appendCoordinate(coordinates: Coordinate[], coordinate: Coordinate) {
  const previous = coordinates.at(-1);
  if (previous?.[0] === coordinate[0] && previous[1] === coordinate[1]) {
    return;
  }

  coordinates.push([coordinate[0], coordinate[1]]);
}

function extractMapMatchResult(payload: unknown): MapMatchResult | null {
  if (!isRecord(payload) || !Array.isArray(payload.features) || payload.features.length === 0) {
    return null;
  }

  const feature = payload.features[0];
  if (!isRecord(feature) || !isRecord(feature.geometry)) {
    return null;
  }

  const { geometry } = feature;
  const coordinates: Coordinate[] = [];

  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    for (const line of geometry.coordinates) {
      if (!Array.isArray(line)) {
        return null;
      }

      for (const coordinate of line) {
        if (!isCoordinate(coordinate)) {
          return null;
        }

        appendCoordinate(coordinates, coordinate);
      }
    }
  } else if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    for (const coordinate of geometry.coordinates) {
      if (!isCoordinate(coordinate)) {
        return null;
      }

      appendCoordinate(coordinates, coordinate);
    }
  } else {
    return null;
  }

  if (coordinates.length < 2) {
    return null;
  }

  const upstreamDistance =
    isRecord(feature.properties) &&
    isFiniteNumber(feature.properties.distance) &&
    feature.properties.distance >= 0
      ? feature.properties.distance
      : null;

  return {
    coordinates,
    distance: Math.round(upstreamDistance ?? calculateDistance(coordinates)),
  };
}

function fallback(points: readonly NormalizedPoint[], reason: FallbackReason) {
  const coordinates = points.map(({ coordinate }) => coordinate);

  return json({
    available: false,
    matched: false,
    source: "raw",
    reason,
    coordinates,
    distanceMeters: calculateDistance(coordinates),
  });
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export async function POST(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin) {
    return json(
      {
        available: false,
        matched: false,
        source: "raw",
        reason: "invalid_request",
        coordinates: [],
        distanceMeters: 0,
        error: "cross-origin requests are not allowed",
      },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(
      {
        available: false,
        matched: false,
        source: "raw",
        reason: "invalid_request",
        coordinates: [],
        distanceMeters: 0,
        error: "request body is too large",
      },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      {
        available: false,
        matched: false,
        source: "raw",
        reason: "invalid_request",
        coordinates: [],
        distanceMeters: 0,
        error: "request body must be valid JSON",
      },
      { status: 400 },
    );
  }

  const validation = validateBody(body);
  if (!validation.ok) {
    return json(
      {
        available: false,
        matched: false,
        source: "raw",
        reason: "invalid_request",
        coordinates: [],
        distanceMeters: 0,
        error: validation.message,
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) {
    return fallback(validation.points, "missing_api_key");
  }

  const url = new URL(GEOAPIFY_MAP_MATCHING_URL);
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "walk",
        waypoints: validation.points.map(({ coordinate, timestamp }) => ({
          location: coordinate,
          ...(timestamp === undefined ? {} : { timestamp }),
        })),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return fallback(validation.points, "upstream_error");
    }

    const payload: unknown = await response.json().catch(() => null);
    const result = extractMapMatchResult(payload);
    if (!result) {
      return fallback(validation.points, "invalid_upstream_response");
    }

    return json({
      available: true,
      matched: true,
      source: "geoapify",
      coordinates: result.coordinates,
      distanceMeters: result.distance,
    });
  } catch (error) {
    return fallback(
      validation.points,
      isTimeoutError(error) ? "upstream_timeout" : "upstream_error",
    );
  }
}
