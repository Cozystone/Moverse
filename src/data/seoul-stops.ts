import rawDataset from "@/data/seoul-stops.json";
import type { MoveSpot } from "@/types/moverse";

type RawStop = [
  entranceId: string,
  name: string,
  district: string,
  longitude: number,
  latitude: number,
  category: "park" | "trail",
  closesAt: string,
];

const SOURCE = {
  id: "seoul-oa-21699" as const,
  name: "서울시 시설물·보행자 출입구 정보",
  url: "https://data.seoul.go.kr/dataList/OA-21699/S/1/datasetView.do",
  referenceDate: rawDataset.sourceUpdatedAt,
};

function compactName(name: string) {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

const rows = rawDataset.stops as unknown as RawStop[];

export const SEOUL_DISCOVERY_STOPS_META = {
  schemaVersion: rawDataset.schemaVersion,
  generatedAt: rawDataset.generatedAt,
  sourceUpdatedAt: rawDataset.sourceUpdatedAt,
  count: rawDataset.counts.stops,
  license: rawDataset.license,
  sources: rawDataset.sources,
} as const;

export const SEOUL_DISCOVERY_STOPS: MoveSpot[] = rows.map(
  ([entranceId, name, district, longitude, latitude, category, closesAt]) => ({
    id: `seoul-${entranceId}`,
    name,
    shortName: compactName(name),
    areaName: district,
    description:
      category === "trail"
        ? "서울시 하천 보행자 출입구 기반 Move Stop"
        : "서울시 공원 보행자 출입구 기반 Move Stop",
    longitude,
    latitude,
    category,
    level: "seed",
    levelNumber: 1,
    energy: 0,
    energyGoal: 1_200,
    sports: ["walking", "running", "plogging"],
    verified: false,
    closesAt,
    distanceLabel: "지도에서 확인",
    kind: "discovery",
    eventEligible: false,
    source: SOURCE,
  }),
);
