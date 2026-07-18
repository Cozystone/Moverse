"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorldMapCoordinate } from "@/components/world-map";

export type DemoNavigationStatus =
  | "idle"
  | "loading"
  | "ready"
  | "walking"
  | "paused"
  | "arrived"
  | "error";

export type DemoRouteSource = "osrm" | "fallback";

export interface DemoNavigationDestination {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
}

export interface DemoNavigationPlan {
  coordinates: WorldMapCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  estimatedWalkingMinutes: number;
  source: DemoRouteSource;
  attribution?: string;
  fallbackReason?: string;
}

export interface UseDemoNavigationOptions {
  /** Stable, public demo origin used before a device position is available. */
  initialPosition: WorldMapCoordinate;
  /** Optional latest device position. This hook never starts or reads GPS itself. */
  currentPosition?: WorldMapCoordinate | null;
}

export interface UseDemoNavigationResult {
  status: DemoNavigationStatus;
  destination: DemoNavigationDestination | null;
  plan: DemoNavigationPlan | null;
  progress: number;
  currentPosition: WorldMapCoordinate;
  bearing: number;
  remainingMeters: number;
  error: string | null;
  isWalking: boolean;
  isActive: boolean;
  planTo: (
    destination: DemoNavigationDestination,
  ) => Promise<DemoNavigationPlan | null>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  end: () => void;
  replay: () => void;
  reset: () => void;
  clear: () => void;
}

type DirectionsResponse = {
  ok: true;
  source: "osrm";
  geometry: {
    type: "LineString";
    coordinates: WorldMapCoordinate[];
  };
  distanceMeters: number;
  durationSeconds: number;
  estimatedWalkingMinutes: number;
  attribution?: string;
};

type RouteMetrics = {
  cumulativeMeters: number[];
  geometryDistanceMeters: number;
};

type MotionSnapshot = {
  progress: number;
  currentPosition: WorldMapCoordinate;
  bearing: number;
};

const EARTH_RADIUS_METERS = 6_371_008.8;
const FRAME_INTERVAL_MS = 50;
const MIN_DEMO_DURATION_MS = 10_000;
const MAX_DEMO_DURATION_MS = 18_000;
const REDUCED_MOTION_DURATION_MS = 1_200;
const FALLBACK_WALKING_SPEED_MPS = 1.35;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCoordinate(value: unknown): value is WorldMapCoordinate {
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

function copyCoordinate(coordinate: WorldMapCoordinate): WorldMapCoordinate {
  return [coordinate[0], coordinate[1]];
}

function destinationCoordinate(
  destination: DemoNavigationDestination,
): WorldMapCoordinate | null {
  const coordinate: WorldMapCoordinate = [
    destination.longitude,
    destination.latitude,
  ];
  return isCoordinate(coordinate) ? coordinate : null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function distanceBetween(
  start: WorldMapCoordinate,
  end: WorldMapCoordinate,
) {
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

function bearingBetween(
  start: WorldMapCoordinate,
  end: WorldMapCoordinate,
) {
  if (start[0] === end[0] && start[1] === end[1]) return 0;

  const startLatitude = toRadians(start[1]);
  const endLatitude = toRadians(end[1]);
  const longitudeDelta = toRadians(end[0] - start[0]);
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) *
      Math.cos(endLatitude) *
      Math.cos(longitudeDelta);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function normalizeCoordinates(value: unknown): WorldMapCoordinate[] | null {
  if (!Array.isArray(value)) return null;

  const coordinates: WorldMapCoordinate[] = [];
  for (const candidate of value) {
    if (!isCoordinate(candidate)) return null;
    const coordinate: WorldMapCoordinate = [candidate[0], candidate[1]];
    const previous = coordinates.at(-1);
    if (
      !previous ||
      previous[0] !== coordinate[0] ||
      previous[1] !== coordinate[1]
    ) {
      coordinates.push(coordinate);
    }
  }

  return coordinates.length >= 2 ? coordinates : null;
}

function routeMetrics(coordinates: readonly WorldMapCoordinate[]): RouteMetrics {
  const cumulativeMeters = [0];
  for (let index = 1; index < coordinates.length; index += 1) {
    cumulativeMeters.push(
      cumulativeMeters[index - 1] +
        distanceBetween(coordinates[index - 1], coordinates[index]),
    );
  }

  return {
    cumulativeMeters,
    geometryDistanceMeters: cumulativeMeters.at(-1) ?? 0,
  };
}

function motionAtProgress(
  coordinates: readonly WorldMapCoordinate[],
  metrics: RouteMetrics,
  rawProgress: number,
): MotionSnapshot {
  const progress = Math.min(1, Math.max(0, rawProgress));
  const first = coordinates[0];
  const last = coordinates.at(-1) ?? first;

  if (coordinates.length < 2 || metrics.geometryDistanceMeters <= 0) {
    return { progress, currentPosition: copyCoordinate(first), bearing: 0 };
  }

  if (progress >= 1) {
    return {
      progress: 1,
      currentPosition: copyCoordinate(last),
      bearing: bearingBetween(coordinates.at(-2) ?? first, last),
    };
  }

  const targetDistance = progress * metrics.geometryDistanceMeters;
  let lower = 0;
  let upper = metrics.cumulativeMeters.length - 1;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (metrics.cumulativeMeters[middle] < targetDistance) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  const endIndex = Math.min(
    coordinates.length - 1,
    Math.max(1, lower),
  );
  const startIndex = endIndex - 1;
  const segmentStartDistance = metrics.cumulativeMeters[startIndex];
  const segmentDistance = Math.max(
    0.000_001,
    metrics.cumulativeMeters[endIndex] - segmentStartDistance,
  );
  const segmentProgress = Math.min(
    1,
    Math.max(0, (targetDistance - segmentStartDistance) / segmentDistance),
  );
  const segmentStart = coordinates[startIndex];
  const segmentEnd = coordinates[endIndex];

  return {
    progress,
    currentPosition: [
      segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * segmentProgress,
      segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * segmentProgress,
    ],
    bearing: bearingBetween(segmentStart, segmentEnd),
  };
}

function parseDirectionsResponse(value: unknown): DirectionsResponse | null {
  if (
    !isRecord(value) ||
    value.ok !== true ||
    value.source !== "osrm" ||
    !isRecord(value.geometry) ||
    value.geometry.type !== "LineString" ||
    !isFiniteNumber(value.distanceMeters) ||
    value.distanceMeters < 0 ||
    !isFiniteNumber(value.durationSeconds) ||
    value.durationSeconds < 0 ||
    !isFiniteNumber(value.estimatedWalkingMinutes) ||
    value.estimatedWalkingMinutes < 0
  ) {
    return null;
  }

  const coordinates = normalizeCoordinates(value.geometry.coordinates);
  if (!coordinates) return null;

  return {
    ok: true,
    source: "osrm",
    geometry: { type: "LineString", coordinates },
    distanceMeters: Math.round(value.distanceMeters),
    durationSeconds: Math.round(value.durationSeconds),
    estimatedWalkingMinutes: Math.max(
      1,
      Math.round(value.estimatedWalkingMinutes),
    ),
    attribution:
      typeof value.attribution === "string" ? value.attribution : undefined,
  };
}

function fallbackPlan(
  origin: WorldMapCoordinate,
  destination: WorldMapCoordinate,
  reason: string,
): DemoNavigationPlan {
  const straightLineMeters = distanceBetween(origin, destination);
  const coordinates: WorldMapCoordinate[] = [
    copyCoordinate(origin),
    [
      origin[0] + (destination[0] - origin[0]) / 3,
      origin[1] + (destination[1] - origin[1]) / 3,
    ],
    [
      origin[0] + ((destination[0] - origin[0]) * 2) / 3,
      origin[1] + ((destination[1] - origin[1]) * 2) / 3,
    ],
    copyCoordinate(destination),
  ];
  const durationSeconds = Math.round(
    straightLineMeters / FALLBACK_WALKING_SPEED_MPS,
  );

  return {
    coordinates,
    distanceMeters: Math.round(straightLineMeters),
    durationSeconds,
    estimatedWalkingMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
    source: "fallback",
    fallbackReason: reason,
  };
}

function demoDurationMs(distanceMeters: number) {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return REDUCED_MOTION_DURATION_MS;
  }

  return Math.round(
    Math.min(
      MAX_DEMO_DURATION_MS,
      Math.max(MIN_DEMO_DURATION_MS, MIN_DEMO_DURATION_MS + distanceMeters * 3.2),
    ),
  );
}

function requestUrl(
  origin: WorldMapCoordinate,
  destination: WorldMapCoordinate,
) {
  const searchParams = new URLSearchParams({
    start: `${origin[0]},${origin[1]}`,
    end: `${destination[0]},${destination[1]}`,
  });
  return `/api/directions?${searchParams.toString()}`;
}

function abortReason(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function useDemoNavigation({
  initialPosition,
  currentPosition: externalCurrentPosition,
}: UseDemoNavigationOptions): UseDemoNavigationResult {
  const safeInitialPosition = isCoordinate(initialPosition)
    ? initialPosition
    : ([127.05245, 37.512934] as WorldMapCoordinate);
  const [status, setStatus] = useState<DemoNavigationStatus>("idle");
  const [destination, setDestination] =
    useState<DemoNavigationDestination | null>(null);
  const [plan, setPlan] = useState<DemoNavigationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [motion, setMotion] = useState<MotionSnapshot>(() => ({
    progress: 0,
    currentPosition: copyCoordinate(safeInitialPosition),
    bearing: 0,
  }));

  const statusRef = useRef<DemoNavigationStatus>("idle");
  const planRef = useRef<DemoNavigationPlan | null>(null);
  const routeMetricsRef = useRef<RouteMetrics | null>(null);
  const motionRef = useRef(motion);
  const latestExternalPositionRef = useRef<WorldMapCoordinate>(
    isCoordinate(externalCurrentPosition)
      ? copyCoordinate(externalCurrentPosition)
      : copyCoordinate(safeInitialPosition),
  );
  const hasAdvancedDemoPositionRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const elapsedBeforeRunRef = useRef(0);
  const demoDurationRef = useRef(MIN_DEMO_DURATION_MS);

  useEffect(() => {
    if (isCoordinate(externalCurrentPosition)) {
      latestExternalPositionRef.current = copyCoordinate(externalCurrentPosition);
    } else if (isCoordinate(initialPosition)) {
      latestExternalPositionRef.current = copyCoordinate(initialPosition);
    }
  }, [externalCurrentPosition, initialPosition]);

  const updateStatus = useCallback((nextStatus: DemoNavigationStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const updateMotion = useCallback((nextMotion: MotionSnapshot) => {
    motionRef.current = nextMotion;
    setMotion(nextMotion);
  }, []);

  const installPlan = useCallback(
    (nextPlan: DemoNavigationPlan, nextDestination: DemoNavigationDestination) => {
      const metrics = routeMetrics(nextPlan.coordinates);
      planRef.current = nextPlan;
      routeMetricsRef.current = metrics;
      demoDurationRef.current = demoDurationMs(nextPlan.distanceMeters);
      elapsedBeforeRunRef.current = 0;
      runStartedAtRef.current = null;
      setPlan(nextPlan);
      setDestination(nextDestination);
      updateMotion(
        motionAtProgress(nextPlan.coordinates, metrics, 0),
      );
      updateStatus("ready");
    },
    [updateMotion, updateStatus],
  );

  const planTo = useCallback(
    async (nextDestination: DemoNavigationDestination) => {
      const endCoordinate = destinationCoordinate(nextDestination);
      const origin = hasAdvancedDemoPositionRef.current
        ? motionRef.current.currentPosition
        : latestExternalPositionRef.current;

      requestGenerationRef.current += 1;
      const generation = requestGenerationRef.current;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      runStartedAtRef.current = null;
      elapsedBeforeRunRef.current = 0;
      hasAdvancedDemoPositionRef.current = false;

      if (!isCoordinate(origin) || !endCoordinate) {
        planRef.current = null;
        routeMetricsRef.current = null;
        setPlan(null);
        setDestination(null);
        setError("시연 경로에 사용할 위치가 올바르지 않아요.");
        updateStatus("error");
        return null;
      }

      const stableOrigin = copyCoordinate(origin);
      const controller = new AbortController();
      requestControllerRef.current = controller;
      planRef.current = null;
      routeMetricsRef.current = null;
      setPlan(null);
      setDestination(nextDestination);
      setError(null);
      updateMotion({
        progress: 0,
        currentPosition: stableOrigin,
        bearing: bearingBetween(stableOrigin, endCoordinate),
      });
      updateStatus("loading");

      try {
        const response = await fetch(requestUrl(stableOrigin, endCoordinate), {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (
          generation !== requestGenerationRef.current ||
          controller.signal.aborted
        ) {
          return null;
        }

        const directions = response.ok
          ? parseDirectionsResponse(payload)
          : null;
        if (!directions) {
          throw new Error(`directions ${response.status}`);
        }

        const nextPlan: DemoNavigationPlan = {
          coordinates: directions.geometry.coordinates,
          distanceMeters: directions.distanceMeters,
          durationSeconds: directions.durationSeconds,
          estimatedWalkingMinutes: directions.estimatedWalkingMinutes,
          source: "osrm",
          attribution: directions.attribution,
        };
        setError(null);
        installPlan(nextPlan, nextDestination);
        return nextPlan;
      } catch (requestError) {
        if (
          generation !== requestGenerationRef.current ||
          controller.signal.aborted ||
          abortReason(requestError)
        ) {
          return null;
        }

        const nextPlan = fallbackPlan(
          stableOrigin,
          endCoordinate,
          "도보 길찾기에 연결하지 못해 직선 시연 경로를 사용해요.",
        );
        setError(nextPlan.fallbackReason ?? null);
        installPlan(nextPlan, nextDestination);
        return nextPlan;
      } finally {
        if (requestControllerRef.current === controller) {
          requestControllerRef.current = null;
        }
      }
    },
    [installPlan, updateMotion, updateStatus],
  );

  const start = useCallback(() => {
    const activePlan = planRef.current;
    const metrics = routeMetricsRef.current;
    if (!activePlan || !metrics) return;

    let nextProgress = motionRef.current.progress;
    if (statusRef.current === "arrived" || nextProgress >= 1) {
      nextProgress = 0;
      updateMotion(motionAtProgress(activePlan.coordinates, metrics, 0));
    }
    if (statusRef.current !== "ready" && statusRef.current !== "paused" && statusRef.current !== "arrived") {
      return;
    }

    if (activePlan.distanceMeters <= 0 || metrics.geometryDistanceMeters <= 0) {
      updateMotion(motionAtProgress(activePlan.coordinates, metrics, 1));
      hasAdvancedDemoPositionRef.current = true;
      updateStatus("arrived");
      return;
    }

    hasAdvancedDemoPositionRef.current = true;
    elapsedBeforeRunRef.current = nextProgress * demoDurationRef.current;
    runStartedAtRef.current = performance.now();
    updateStatus("walking");
  }, [updateMotion, updateStatus]);

  const pause = useCallback(() => {
    if (statusRef.current !== "walking") return;
    const activePlan = planRef.current;
    const metrics = routeMetricsRef.current;
    const startedAt = runStartedAtRef.current;
    if (activePlan && metrics && startedAt !== null) {
      const elapsed =
        elapsedBeforeRunRef.current + performance.now() - startedAt;
      const nextProgress = Math.min(1, elapsed / demoDurationRef.current);
      updateMotion(
        motionAtProgress(activePlan.coordinates, metrics, nextProgress),
      );
      elapsedBeforeRunRef.current = nextProgress * demoDurationRef.current;
    }
    runStartedAtRef.current = null;
    updateStatus(motionRef.current.progress >= 1 ? "arrived" : "paused");
  }, [updateMotion, updateStatus]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") return;
    start();
  }, [start]);

  const end = useCallback(() => {
    const activePlan = planRef.current;
    const metrics = routeMetricsRef.current;
    if (!activePlan || !metrics) return;
    runStartedAtRef.current = null;
    elapsedBeforeRunRef.current = 0;
    hasAdvancedDemoPositionRef.current = false;
    updateMotion(motionAtProgress(activePlan.coordinates, metrics, 0));
    updateStatus("ready");
  }, [updateMotion, updateStatus]);

  const replay = useCallback(() => {
    const activePlan = planRef.current;
    const metrics = routeMetricsRef.current;
    if (!activePlan || !metrics) return;
    runStartedAtRef.current = null;
    elapsedBeforeRunRef.current = 0;
    hasAdvancedDemoPositionRef.current = true;
    updateMotion(motionAtProgress(activePlan.coordinates, metrics, 0));
    runStartedAtRef.current = performance.now();
    updateStatus("walking");
  }, [updateMotion, updateStatus]);

  const reset = useCallback(() => {
    requestGenerationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    runStartedAtRef.current = null;
    elapsedBeforeRunRef.current = 0;
    hasAdvancedDemoPositionRef.current = false;
    planRef.current = null;
    routeMetricsRef.current = null;
    setPlan(null);
    setDestination(null);
    setError(null);
    updateMotion({
      progress: 0,
      currentPosition: copyCoordinate(latestExternalPositionRef.current),
      bearing: 0,
    });
    updateStatus("idle");
  }, [updateMotion, updateStatus]);

  useEffect(() => {
    if (status !== "walking" || !plan) return;

    const tick = () => {
      const metrics = routeMetricsRef.current;
      const startedAt = runStartedAtRef.current;
      if (!metrics || startedAt === null) return;

      const elapsed =
        elapsedBeforeRunRef.current + performance.now() - startedAt;
      const nextProgress = Math.min(1, elapsed / demoDurationRef.current);
      updateMotion(motionAtProgress(plan.coordinates, metrics, nextProgress));

      if (nextProgress >= 1) {
        elapsedBeforeRunRef.current = demoDurationRef.current;
        runStartedAtRef.current = null;
        updateStatus("arrived");
      }
    };

    tick();
    const interval = window.setInterval(tick, FRAME_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [plan, status, updateMotion, updateStatus]);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
      requestControllerRef.current?.abort();
    },
    [],
  );

  const remainingMeters = useMemo(
    () => Math.max(0, Math.round((plan?.distanceMeters ?? 0) * (1 - motion.progress))),
    [motion.progress, plan?.distanceMeters],
  );

  return {
    status,
    destination,
    plan,
    progress: motion.progress,
    currentPosition: motion.currentPosition,
    bearing: motion.bearing,
    remainingMeters,
    error,
    isWalking: status === "walking",
    isActive: status === "walking" || status === "paused",
    planTo,
    start,
    pause,
    resume,
    end,
    replay,
    reset,
    clear: reset,
  };
}
