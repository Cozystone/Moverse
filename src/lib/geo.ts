export const EARTH_RADIUS_METERS = 6_371_000;

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
  altitudeMeters: number | null;
  altitudeAccuracyMeters: number | null;
  headingDegrees: number | null;
  speedMps: number | null;
}

export type GeoSignalQuality = "unknown" | "good" | "weak" | "unusable";

export type GeoPointAcceptanceReason = "initial-anchor" | "movement" | "gap-anchor";

export type GeoPointRejectionReason =
  | "invalid-coordinate"
  | "poor-accuracy"
  | "non-monotonic-time"
  | "sample-too-soon"
  | "unrealistic-jump"
  | "stationary-jitter";

export interface GeoFilterConfig {
  maxAccuracyMeters: number;
  weakSignalAccuracyMeters: number;
  minMovementMeters: number;
  stationaryAccuracyFactor: number;
  maxSpeedMps: number;
  minSampleIntervalMs: number;
  maxSampleGapMs: number;
}

export const DEFAULT_GEO_FILTER_CONFIG: Readonly<GeoFilterConfig> = Object.freeze({
  maxAccuracyMeters: 45,
  weakSignalAccuracyMeters: 28,
  minMovementMeters: 3,
  stationaryAccuracyFactor: 0.35,
  maxSpeedMps: 12,
  minSampleIntervalMs: 400,
  maxSampleGapMs: 30_000,
});

interface GeoPointEvaluationBase {
  distanceMeters: number;
  elapsedMs: number;
  speedMps: number | null;
  signalQuality: GeoSignalQuality;
}

export type GeoPointEvaluation =
  | (GeoPointEvaluationBase & {
      accepted: true;
      reason: GeoPointAcceptanceReason;
    })
  | (GeoPointEvaluationBase & {
      accepted: false;
      reason: GeoPointRejectionReason;
    });

const positiveOr = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) && (value ?? 0) > 0 ? (value as number) : fallback;

export function createGeoFilterConfig(overrides: Partial<GeoFilterConfig> = {}): GeoFilterConfig {
  const maxAccuracyMeters = positiveOr(
    overrides.maxAccuracyMeters,
    DEFAULT_GEO_FILTER_CONFIG.maxAccuracyMeters,
  );

  return {
    maxAccuracyMeters,
    weakSignalAccuracyMeters: Math.min(
      maxAccuracyMeters,
      positiveOr(
        overrides.weakSignalAccuracyMeters,
        DEFAULT_GEO_FILTER_CONFIG.weakSignalAccuracyMeters,
      ),
    ),
    minMovementMeters: positiveOr(
      overrides.minMovementMeters,
      DEFAULT_GEO_FILTER_CONFIG.minMovementMeters,
    ),
    stationaryAccuracyFactor: positiveOr(
      overrides.stationaryAccuracyFactor,
      DEFAULT_GEO_FILTER_CONFIG.stationaryAccuracyFactor,
    ),
    maxSpeedMps: positiveOr(overrides.maxSpeedMps, DEFAULT_GEO_FILTER_CONFIG.maxSpeedMps),
    minSampleIntervalMs: positiveOr(
      overrides.minSampleIntervalMs,
      DEFAULT_GEO_FILTER_CONFIG.minSampleIntervalMs,
    ),
    maxSampleGapMs: positiveOr(
      overrides.maxSampleGapMs,
      DEFAULT_GEO_FILTER_CONFIG.maxSampleGapMs,
    ),
  };
}

export function pointFromGeolocationPosition(position: GeolocationPosition): GeoPoint {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    timestamp: position.timestamp,
    altitudeMeters: position.coords.altitude,
    altitudeAccuracyMeters: position.coords.altitudeAccuracy,
    headingDegrees: position.coords.heading,
    speedMps: position.coords.speed,
  };
}

export function isValidGeoPoint(point: GeoPoint): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    Number.isFinite(point.timestamp) &&
    Number.isFinite(point.accuracyMeters) &&
    point.accuracyMeters > 0
  );
}

export function haversineDistanceMeters(
  start: Pick<GeoPoint, "latitude" | "longitude">,
  end: Pick<GeoPoint, "latitude" | "longitude">,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const a = Math.min(
    1,
    Math.max(
      0,
      Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2,
    ),
  );

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function signalQualityFromAccuracy(
  accuracyMeters: number | null,
  config: GeoFilterConfig = DEFAULT_GEO_FILTER_CONFIG,
): GeoSignalQuality {
  if (accuracyMeters === null || !Number.isFinite(accuracyMeters)) return "unknown";
  if (accuracyMeters <= config.weakSignalAccuracyMeters) return "good";
  if (accuracyMeters <= config.maxAccuracyMeters) return "weak";
  return "unusable";
}

export function evaluateGeoPoint(
  previousAccepted: GeoPoint | null,
  candidate: GeoPoint,
  config: GeoFilterConfig = DEFAULT_GEO_FILTER_CONFIG,
): GeoPointEvaluation {
  const signalQuality = signalQualityFromAccuracy(candidate.accuracyMeters, config);
  const rejected = (
    reason: GeoPointRejectionReason,
    distanceMeters = 0,
    elapsedMs = 0,
    speedMps: number | null = null,
  ): GeoPointEvaluation => ({
    accepted: false,
    reason,
    distanceMeters,
    elapsedMs,
    speedMps,
    signalQuality,
  });

  if (!isValidGeoPoint(candidate)) return rejected("invalid-coordinate");
  if (candidate.accuracyMeters > config.maxAccuracyMeters) return rejected("poor-accuracy");

  if (!previousAccepted) {
    return {
      accepted: true,
      reason: "initial-anchor",
      distanceMeters: 0,
      elapsedMs: 0,
      speedMps: null,
      signalQuality,
    };
  }

  const elapsedMs = candidate.timestamp - previousAccepted.timestamp;
  if (elapsedMs <= 0) return rejected("non-monotonic-time", 0, elapsedMs);
  if (elapsedMs < config.minSampleIntervalMs) return rejected("sample-too-soon", 0, elapsedMs);

  if (elapsedMs > config.maxSampleGapMs) {
    return {
      accepted: true,
      reason: "gap-anchor",
      distanceMeters: 0,
      elapsedMs,
      speedMps: null,
      signalQuality,
    };
  }

  const distanceMeters = haversineDistanceMeters(previousAccepted, candidate);
  const segmentSpeedMps = distanceMeters / (elapsedMs / 1000);
  const reportedSpeedMps =
    candidate.speedMps !== null && Number.isFinite(candidate.speedMps)
      ? Math.max(0, candidate.speedMps)
      : 0;
  const speedMps = Math.max(segmentSpeedMps, reportedSpeedMps);

  if (speedMps > config.maxSpeedMps) {
    return rejected("unrealistic-jump", distanceMeters, elapsedMs, speedMps);
  }

  const jitterRadiusMeters = Math.max(
    config.minMovementMeters,
    Math.min(previousAccepted.accuracyMeters, candidate.accuracyMeters) *
      config.stationaryAccuracyFactor,
  );
  if (distanceMeters < jitterRadiusMeters) {
    return rejected("stationary-jitter", distanceMeters, elapsedMs, speedMps);
  }

  return {
    accepted: true,
    reason: "movement",
    distanceMeters,
    elapsedMs,
    speedMps,
    signalQuality,
  };
}

export function paceMinutesPerKm(
  acceptedDistanceMeters: number,
  activeDurationMs: number,
): number | null {
  if (acceptedDistanceMeters < 20 || activeDurationMs <= 0) return null;
  return activeDurationMs / 60_000 / (acceptedDistanceMeters / 1000);
}
