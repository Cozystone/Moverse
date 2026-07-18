"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldMapCoordinate } from "@/components/world-map";

type MatchablePoint = {
  longitude: number;
  latitude: number;
  accuracy?: number;
  timestamp: number;
};

export type StreetMatchState =
  | "idle"
  | "matching"
  | "matched"
  | "raw"
  | "error";

type MatchResponse = {
  available?: boolean;
  matched?: boolean;
  coordinates?: WorldMapCoordinate[];
  distanceMeters?: number;
};

const MATCH_INTERVAL_MS = 7_500;
const TARGET_SAMPLE_INTERVAL_MS = 4_500;
const MAX_MATCH_POINTS = 1_000;

function samplePoints(points: readonly MatchablePoint[]) {
  if (points.length <= 2) return [...points];

  const sampled: MatchablePoint[] = [points[0]];
  let lastTimestamp = points[0].timestamp;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (point.timestamp - lastTimestamp >= TARGET_SAMPLE_INTERVAL_MS) {
      sampled.push(point);
      lastTimestamp = point.timestamp;
    }
  }
  sampled.push(points[points.length - 1]);

  if (sampled.length <= MAX_MATCH_POINTS) return sampled;
  const stride = (sampled.length - 1) / (MAX_MATCH_POINTS - 1);
  return Array.from({ length: MAX_MATCH_POINTS }, (_, index) =>
    sampled[Math.min(sampled.length - 1, Math.round(index * stride))],
  );
}

export function useStreetMatchedRoute(
  points: readonly MatchablePoint[],
  enabled: boolean,
) {
  const [coordinates, setCoordinates] = useState<WorldMapCoordinate[]>([]);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [state, setState] = useState<StreetMatchState>("idle");
  const matchingAvailableRef = useRef(true);
  const requestInFlightRef = useRef(false);
  const lastRequestAtRef = useRef(0);
  const previousFirstTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    const firstTimestamp = points[0]?.timestamp ?? null;
    if (firstTimestamp !== previousFirstTimestampRef.current) {
      previousFirstTimestampRef.current = firstTimestamp;
      matchingAvailableRef.current = true;
      lastRequestAtRef.current = 0;
      setCoordinates([]);
      setDistanceMeters(null);
      setState(firstTimestamp === null ? "idle" : "raw");
    }
  }, [points]);

  useEffect(() => {
    if (
      !enabled ||
      points.length < 3 ||
      !matchingAvailableRef.current ||
      requestInFlightRef.current
    ) return;
    const now = Date.now();
    if (now - lastRequestAtRef.current < MATCH_INTERVAL_MS) return;
    lastRequestAtRef.current = now;

    const sessionTimestamp = points[0].timestamp;
    requestInFlightRef.current = true;
    const match = async () => {
      setState("matching");
      try {
        const response = await fetch("/api/map-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: samplePoints(points) }),
        });
        if (!response.ok) throw new Error(`map match ${response.status}`);
        const result = (await response.json()) as MatchResponse;
        if (previousFirstTimestampRef.current !== sessionTimestamp) return;
        if (result.available === false) {
          matchingAvailableRef.current = false;
          setState("raw");
          return;
        }
        if (
          result.matched &&
          Array.isArray(result.coordinates) &&
          result.coordinates.length >= 2
        ) {
          setCoordinates(result.coordinates);
          setDistanceMeters(
            typeof result.distanceMeters === "number" ? result.distanceMeters : null,
          );
          setState("matched");
          return;
        }
        setState("raw");
      } catch {
        if (previousFirstTimestampRef.current === sessionTimestamp) setState("error");
      } finally {
        requestInFlightRef.current = false;
      }
    };

    void match();
  }, [enabled, points]);

  return { coordinates, distanceMeters, state };
}
