import { DEMO_EVENTS, DEMO_SPOTS } from "@/data/demo-data";
import {
  SAMSEONG_DISCOVERY_STOPS,
  SAMSEONG_MOVE_EVENTS,
  SAMSEONG_VERIFIED_HUBS,
} from "@/data/samseong-local-data";
import { SEOUL_DISCOVERY_STOPS } from "@/data/seoul-stops";
import type { MoveSpot } from "@/types/moverse";

const CROSS_SOURCE_DEDUPE_METERS = 45;

function distanceMeters(left: MoveSpot, right: MoveSpot) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const startLatitude = toRadians(left.latitude);
  const endLatitude = toRadians(right.latitude);
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function mergePriorityGroups(groups: readonly (readonly MoveSpot[])[]) {
  const merged: MoveSpot[] = [];
  const ids = new Set<string>();

  for (const group of groups) {
    const higherPrioritySpots = [...merged];
    for (const spot of group) {
      if (ids.has(spot.id)) continue;
      const shadowed = higherPrioritySpots.some(
        (candidate) => distanceMeters(candidate, spot) <= CROSS_SOURCE_DEDUPE_METERS,
      );
      if (shadowed) continue;
      ids.add(spot.id);
      merged.push(spot);
    }
  }

  return merged;
}

export const MOVE_SPOTS: readonly MoveSpot[] = mergePriorityGroups([
  SAMSEONG_VERIFIED_HUBS,
  DEMO_SPOTS,
  SAMSEONG_DISCOVERY_STOPS,
  SEOUL_DISCOVERY_STOPS,
]);

export const MOVE_SPOT_BY_ID = new Map(
  MOVE_SPOTS.map((spot) => [spot.id, spot] as const),
);

export const EVENT_ELIGIBLE_SPOTS = MOVE_SPOTS.filter(
  (spot) => spot.verified && spot.eventEligible !== false,
);

export const MOVE_SEED_EVENTS = [...SAMSEONG_MOVE_EVENTS, ...DEMO_EVENTS];
