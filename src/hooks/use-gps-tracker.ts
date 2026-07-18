"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createGeoFilterConfig,
  evaluateGeoPoint,
  paceMinutesPerKm,
  pointFromGeolocationPosition,
  signalQualityFromAccuracy,
  type GeoFilterConfig,
  type GeoPoint,
  type GeoPointRejectionReason,
  type GeoSignalQuality,
} from "@/lib/geo";

export type GpsTrackerStatus =
  | "idle"
  | "requesting-permission"
  | "tracking"
  | "weak-signal"
  | "paused"
  | "stopped"
  | "permission-denied"
  | "unsupported"
  | "error";

export type GpsTrackerErrorCode =
  | "permission-denied"
  | "position-unavailable"
  | "timeout"
  | "unsupported"
  | "unknown";

export interface GpsTrackerError {
  code: GpsTrackerErrorCode;
  message: string;
}

export interface UseGpsTrackerOptions {
  filter?: Partial<GeoFilterConfig>;
  positionOptions?: PositionOptions;
  maxStoredPoints?: number;
}

export interface GpsTrackerResult {
  status: GpsTrackerStatus;
  signalQuality: GeoSignalQuality;
  error: GpsTrackerError | null;
  acceptedDistanceMeters: number;
  distanceKm: number;
  activeDurationMs: number;
  paceMinutesPerKm: number | null;
  accuracyMeters: number | null;
  rawPoints: GeoPoint[];
  acceptedPoints: GeoPoint[];
  rejectedPointCount: number;
  lastRejectionReason: GeoPointRejectionReason | null;
  isActive: boolean;
  isPaused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

const DEFAULT_MAX_STORED_POINTS = 5_000;

const isRunningStatus = (status: GpsTrackerStatus) =>
  status === "requesting-permission" || status === "tracking" || status === "weak-signal";

function appendBounded(points: GeoPoint[], point: GeoPoint, maxPoints: number) {
  if (points.length < maxPoints) return [...points, point];
  return [...points.slice(points.length - maxPoints + 1), point];
}

export function useGpsTracker(options: UseGpsTrackerOptions = {}): GpsTrackerResult {
  const filterConfig = useMemo(() => createGeoFilterConfig(options.filter), [options.filter]);
  const maxStoredPoints = Math.max(
    1,
    Math.floor(options.maxStoredPoints ?? DEFAULT_MAX_STORED_POINTS),
  );
  const watchOptions = useMemo<PositionOptions>(
    () => ({
      maximumAge: 0,
      timeout: 12_000,
      ...options.positionOptions,
      enableHighAccuracy: true,
    }),
    [options.positionOptions],
  );

  const [status, setStatus] = useState<GpsTrackerStatus>("idle");
  const [signalQuality, setSignalQuality] = useState<GeoSignalQuality>("unknown");
  const [error, setError] = useState<GpsTrackerError | null>(null);
  const [acceptedDistanceMeters, setAcceptedDistanceMeters] = useState(0);
  const [activeDurationMs, setActiveDurationMs] = useState(0);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [rawPoints, setRawPoints] = useState<GeoPoint[]>([]);
  const [acceptedPoints, setAcceptedPoints] = useState<GeoPoint[]>([]);
  const [rejectedPointCount, setRejectedPointCount] = useState(0);
  const [lastRejectionReason, setLastRejectionReason] =
    useState<GeoPointRejectionReason | null>(null);
  const [clockRunning, setClockRunning] = useState(false);

  const statusRef = useRef<GpsTrackerStatus>("idle");
  const watchIdRef = useRef<number | null>(null);
  const watchGenerationRef = useRef(0);
  const lastAcceptedPointRef = useRef<GeoPoint | null>(null);
  const acceptedDistanceRef = useRef(0);
  const accumulatedActiveMsRef = useRef(0);
  const activeStartedAtRef = useRef<number | null>(null);

  const updateStatus = useCallback((nextStatus: GpsTrackerStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const clearWatch = useCallback(() => {
    watchGenerationRef.current += 1;
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const beginClock = useCallback(() => {
    if (activeStartedAtRef.current === null) activeStartedAtRef.current = Date.now();
    setClockRunning(true);
  }, []);

  const finalizeClock = useCallback(() => {
    if (activeStartedAtRef.current !== null) {
      accumulatedActiveMsRef.current += Date.now() - activeStartedAtRef.current;
      activeStartedAtRef.current = null;
    }
    setActiveDurationMs(accumulatedActiveMsRef.current);
    setClockRunning(false);
  }, []);

  useEffect(() => {
    if (!clockRunning) return;
    const updateElapsed = () => {
      const currentSegment =
        activeStartedAtRef.current === null ? 0 : Date.now() - activeStartedAtRef.current;
      setActiveDurationMs(accumulatedActiveMsRef.current + currentSegment);
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(timer);
  }, [clockRunning]);

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const point = pointFromGeolocationPosition(position);
      setRawPoints((current) => appendBounded(current, point, maxStoredPoints));
      setAccuracyMeters(point.accuracyMeters);

      const evaluation = evaluateGeoPoint(lastAcceptedPointRef.current, point, filterConfig);
      setSignalQuality(evaluation.signalQuality);

      if (!evaluation.accepted) {
        setRejectedPointCount((count) => count + 1);
        setLastRejectionReason(evaluation.reason);
        if (evaluation.signalQuality === "weak" || evaluation.signalQuality === "unusable") {
          updateStatus("weak-signal");
        }
        return;
      }

      lastAcceptedPointRef.current = point;
      setAcceptedPoints((current) => appendBounded(current, point, maxStoredPoints));
      setLastRejectionReason(null);

      if (evaluation.distanceMeters > 0) {
        acceptedDistanceRef.current += evaluation.distanceMeters;
        setAcceptedDistanceMeters(acceptedDistanceRef.current);
      }

      updateStatus(evaluation.signalQuality === "good" ? "tracking" : "weak-signal");
      setError(null);
    },
    [filterConfig, maxStoredPoints, updateStatus],
  );

  const handlePositionError = useCallback(
    (positionError: GeolocationPositionError) => {
      if (positionError.code === positionError.PERMISSION_DENIED) {
        clearWatch();
        finalizeClock();
        setSignalQuality("unknown");
        setError({ code: "permission-denied", message: "위치 권한이 거부되었어요." });
        updateStatus("permission-denied");
        return;
      }

      const timedOut = positionError.code === positionError.TIMEOUT;
      setSignalQuality("weak");
      setError({
        code: timedOut ? "timeout" : "position-unavailable",
        message: timedOut
          ? "GPS 신호를 기다리는 중이에요. 하늘이 열린 곳으로 이동해 주세요."
          : "현재 위치를 확인하기 어려워요. GPS 신호를 확인해 주세요.",
      });
      updateStatus("weak-signal");
    },
    [clearWatch, finalizeClock, updateStatus],
  );

  const beginWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError({ code: "unsupported", message: "이 기기는 GPS 위치 추적을 지원하지 않아요." });
      updateStatus("unsupported");
      return;
    }
    if (isRunningStatus(statusRef.current)) return;

    clearWatch();
    lastAcceptedPointRef.current = null;
    setError(null);
    setSignalQuality("unknown");
    updateStatus("requesting-permission");
    beginClock();

    const generation = watchGenerationRef.current + 1;
    watchGenerationRef.current = generation;

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (watchGenerationRef.current === generation) handlePosition(position);
        },
        (positionError) => {
          if (watchGenerationRef.current === generation) handlePositionError(positionError);
        },
        watchOptions,
      );
    } catch {
      clearWatch();
      finalizeClock();
      setError({ code: "unknown", message: "GPS 추적을 시작하지 못했어요." });
      updateStatus("error");
    }
  }, [beginClock, clearWatch, finalizeClock, handlePosition, handlePositionError, updateStatus, watchOptions]);

  const pause = useCallback(() => {
    if (!isRunningStatus(statusRef.current)) return;
    clearWatch();
    finalizeClock();
    lastAcceptedPointRef.current = null;
    updateStatus("paused");
  }, [clearWatch, finalizeClock, updateStatus]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") return;
    beginWatch();
  }, [beginWatch]);

  const stop = useCallback(() => {
    clearWatch();
    finalizeClock();
    lastAcceptedPointRef.current = null;
    updateStatus("stopped");
  }, [clearWatch, finalizeClock, updateStatus]);

  const reset = useCallback(() => {
    clearWatch();
    activeStartedAtRef.current = null;
    accumulatedActiveMsRef.current = 0;
    acceptedDistanceRef.current = 0;
    lastAcceptedPointRef.current = null;
    setClockRunning(false);
    setAcceptedDistanceMeters(0);
    setActiveDurationMs(0);
    setAccuracyMeters(null);
    setRawPoints([]);
    setAcceptedPoints([]);
    setRejectedPointCount(0);
    setLastRejectionReason(null);
    setSignalQuality("unknown");
    setError(null);
    updateStatus("idle");
  }, [clearWatch, updateStatus]);

  useEffect(
    () => () => {
      watchGenerationRef.current += 1;
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    },
    [],
  );

  return {
    status,
    signalQuality,
    error,
    acceptedDistanceMeters,
    distanceKm: acceptedDistanceMeters / 1000,
    activeDurationMs,
    paceMinutesPerKm: paceMinutesPerKm(acceptedDistanceMeters, activeDurationMs),
    accuracyMeters,
    rawPoints,
    acceptedPoints,
    rejectedPointCount,
    lastRejectionReason,
    isActive: isRunningStatus(status),
    isPaused: status === "paused",
    start: beginWatch,
    pause,
    resume,
    stop,
    reset,
  };
}

export { signalQualityFromAccuracy };
