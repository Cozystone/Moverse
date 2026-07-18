import type { MoveEvent, MoveSpot, MoveSpotSource, SportType } from "@/types/moverse";

// Camera/search anchor only. The residential complex itself is never exposed as
// a check-in stop, event venue, or nearby-person position.
export const SAMSEONG_HILLSTATE_CENTER = {
  longitude: 127.051581,
  latitude: 37.514111,
  label: "삼성동 · 힐스테이트 2단지 주변",
  address: "서울 강남구 삼성로111길 8",
} as const;

const REFERENCE_DATE = "2026-07-19";
const OSM_MAP_URL = "https://www.openstreetmap.org";

const SEOUL_PARK_SOURCE: MoveSpotSource = {
  id: "seoul-oa-21699",
  name: "서울시 시설물·보행자 출입구 정보",
  url: "https://data.seoul.go.kr/dataList/OA-21699/S/1/datasetView.do",
  referenceDate: "2023-04-21",
};

function osmSource(latitude: number, longitude: number): MoveSpotSource {
  return {
    id: "openstreetmap",
    name: "OpenStreetMap 공개 장소 정보",
    url: `${OSM_MAP_URL}/#map=19/${latitude}/${longitude}`,
    referenceDate: REFERENCE_DATE,
  };
}

function distanceMeters(latitude: number, longitude: number) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const startLatitude = toRadians(SAMSEONG_HILLSTATE_CENTER.latitude);
  const endLatitude = toRadians(latitude);
  const latitudeDelta = toRadians(latitude - SAMSEONG_HILLSTATE_CENTER.latitude);
  const longitudeDelta = toRadians(longitude - SAMSEONG_HILLSTATE_CENTER.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function distanceLabel(latitude: number, longitude: number) {
  const meters = distanceMeters(latitude, longitude);
  return meters < 1000 ? `약 ${Math.max(10, Math.round(meters / 10) * 10)}m` : `약 ${(meters / 1000).toFixed(1)}km`;
}

type DiscoverySeed = {
  id: string;
  name: string;
  shortName?: string;
  areaName?: string;
  description: string;
  longitude: number;
  latitude: number;
  category?: MoveSpot["category"];
  level?: MoveSpot["level"];
  levelNumber?: number;
  sports?: SportType[];
  mapStructure?: boolean;
};

function discoveryStop(seed: DiscoverySeed): MoveSpot {
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName ?? seed.name,
    areaName: seed.areaName ?? "삼성동",
    description: seed.description,
    longitude: seed.longitude,
    latitude: seed.latitude,
    category: seed.category ?? "plaza",
    level: seed.level ?? "seed",
    levelNumber: seed.levelNumber ?? 1,
    energy: seed.mapStructure ? 1280 : 320,
    energyGoal: seed.mapStructure ? 3600 : 1400,
    sports: seed.sports ?? ["walking", "running", "plogging"],
    verified: false,
    closesAt: "21:00",
    distanceLabel: distanceLabel(seed.latitude, seed.longitude),
    kind: "discovery",
    eventEligible: false,
    mapStructure: seed.mapStructure,
    source: osmSource(seed.latitude, seed.longitude),
  };
}

type SubwayExitSeed = {
  osmId: string;
  station: string;
  exit: string;
  longitude: number;
  latitude: number;
};

const SUBWAY_EXITS: readonly SubwayExitSeed[] = [
  { osmId: "5021945747", station: "삼성중앙역", exit: "1", longitude: 127.0524496, latitude: 37.5129343 },
  { osmId: "5021945748", station: "삼성중앙역", exit: "2", longitude: 127.0529196, latitude: 37.5133829 },
  { osmId: "5021945749", station: "삼성중앙역", exit: "3", longitude: 127.0531484, latitude: 37.5137154 },
  { osmId: "5021945750", station: "삼성중앙역", exit: "4", longitude: 127.0539654, latitude: 37.5132752 },
  { osmId: "5021945751", station: "삼성중앙역", exit: "5", longitude: 127.0537651, latitude: 37.5126086 },
  { osmId: "5021945752", station: "삼성중앙역", exit: "6", longitude: 127.0533272, latitude: 37.5126239 },
  { osmId: "8233402936", station: "삼성중앙역", exit: "7", longitude: 127.0527672, latitude: 37.5127735 },
  { osmId: "5021760171", station: "봉은사역", exit: "1", longitude: 127.0593156, latitude: 37.5141404 },
  { osmId: "5021760172", station: "봉은사역", exit: "2", longitude: 127.0598372, latitude: 37.5145233 },
  { osmId: "5021760173", station: "봉은사역", exit: "3", longitude: 127.060232, latitude: 37.5147292 },
  { osmId: "5021760174", station: "봉은사역", exit: "4", longitude: 127.061088, latitude: 37.5144844 },
  { osmId: "5021760175", station: "봉은사역", exit: "5", longitude: 127.0611106, latitude: 37.5142634 },
  { osmId: "5021760176", station: "봉은사역", exit: "6", longitude: 127.0607708, latitude: 37.5140306 },
  { osmId: "3824607465", station: "봉은사역", exit: "7", longitude: 127.060018, latitude: 37.5138423 },
  { osmId: "3401315385", station: "청담역", exit: "7", longitude: 127.0503118, latitude: 37.5184118 },
  { osmId: "3401315386", station: "청담역", exit: "8", longitude: 127.0499316, latitude: 37.5191135 },
  { osmId: "3401315387", station: "청담역", exit: "9", longitude: 127.0502042, latitude: 37.519195 },
  { osmId: "3401324793", station: "청담역", exit: "10", longitude: 127.0515581, latitude: 37.5191954 },
  { osmId: "3401319739", station: "강남구청역", exit: "1", longitude: 127.0418264, latitude: 37.5172202 },
  { osmId: "3401319740", station: "강남구청역", exit: "2", longitude: 127.0407196, latitude: 37.5168638 },
  { osmId: "5926091497", station: "강남구청역", exit: "3-1", longitude: 127.0410959, latitude: 37.5173453 },
  { osmId: "3401319738", station: "강남구청역", exit: "4", longitude: 127.0418221, latitude: 37.517429 },
  { osmId: "3408222532", station: "선정릉역", exit: "1", longitude: 127.0432705, latitude: 37.5102159 },
  { osmId: "3408222531", station: "선정릉역", exit: "2", longitude: 127.0445508, latitude: 37.5105604 },
  { osmId: "3408222533", station: "선정릉역", exit: "3", longitude: 127.0446222, latitude: 37.510388 },
  { osmId: "3408222534", station: "선정릉역", exit: "4", longitude: 127.0434159, latitude: 37.510043 },
  { osmId: "3404870719", station: "선릉역", exit: "5", longitude: 127.0477395, latitude: 37.5043817 },
  { osmId: "3404870721", station: "선릉역", exit: "6", longitude: 127.048482, latitude: 37.5045706 },
  { osmId: "3404870722", station: "선릉역", exit: "7", longitude: 127.0485637, latitude: 37.5049763 },
  { osmId: "3404870723", station: "선릉역", exit: "8", longitude: 127.0488953, latitude: 37.5050134 },
  { osmId: "3404873904", station: "삼성역", exit: "5", longitude: 127.0623309, latitude: 37.5089162 },
  { osmId: "3404873903", station: "삼성역", exit: "6", longitude: 127.0624955, latitude: 37.5092783 },
];

const SUBWAY_DISCOVERY_STOPS = SUBWAY_EXITS.map((exit) =>
  discoveryStop({
    id: `samseong-osm-subway-${exit.osmId}`,
    name: `${exit.station} ${exit.exit}번 출구`,
    shortName: `${exit.station} ${exit.exit}`,
    areaName: exit.station.replace("역", ""),
    description: "대중교통과 보행 이동을 연결하는 공개 Move Stop",
    longitude: exit.longitude,
    latitude: exit.latitude,
    category: "plaza",
    sports: ["walking", "running"],
  }),
);

const PLACE_DISCOVERY_STOPS: MoveSpot[] = [
  discoveryStop({
    id: "samseong-osm-bongeun-tennis-park",
    name: "봉은테니스장 보행광장",
    shortName: "봉은 보행광장",
    description: "봉은공원 가장자리의 공개 보행 거점. 테니스 행사는 별도 시설 예약이 필요해요.",
    longitude: 127.0554944,
    latitude: 37.5139106,
    category: "park",
    level: "pulse",
    levelNumber: 5,
    mapStructure: true,
  }),
  discoveryStop({
    id: "samseong-osm-gangnam-library",
    name: "서울시립 강남도서관 앞",
    shortName: "강남도서관",
    description: "조용한 만남 뒤 주변을 함께 걷기 좋은 공공문화 거점",
    longitude: 127.0470557,
    latitude: 37.5137532,
    category: "plaza",
    level: "active",
    levelNumber: 4,
    mapStructure: true,
  }),
  discoveryStop({
    id: "samseong-osm-samseong2-community",
    name: "삼성2동 복합문화센터 앞",
    shortName: "삼성2동 문화센터",
    description: "주거지 내부가 아닌 공공시설 전면의 안전한 만남 기준점",
    longitude: 127.0459885,
    latitude: 37.5111921,
    category: "plaza",
    level: "active",
    levelNumber: 4,
    mapStructure: true,
  }),
  discoveryStop({
    id: "samseong-osm-seonjeongneung",
    name: "선릉과 정릉 산책 입구",
    shortName: "선정릉 산책 입구",
    description: "문화유산 공원 주변의 보행 탐색 스톱. 입장 시간은 현장에서 확인해요.",
    longitude: 127.048942,
    latitude: 37.5089837,
    category: "park",
    level: "landmark",
    levelNumber: 7,
    mapStructure: true,
  }),
  discoveryStop({
    id: "samseong-osm-coex-millennium-plaza",
    name: "코엑스 밀레니엄 플라자",
    shortName: "코엑스 플라자",
    description: "봉은사역과 삼성역 사이의 넓은 공개 보행광장",
    longitude: 127.0617814,
    latitude: 37.5093343,
    category: "plaza",
    level: "landmark",
    levelNumber: 8,
    mapStructure: true,
  }),
  discoveryStop({
    id: "samseong-osm-samseong-magnolia-park",
    name: "삼성목련공원",
    shortName: "목련공원",
    description: "청담역 방향으로 이어지는 동네 걷기 스톱",
    longitude: 127.0539518,
    latitude: 37.5185144,
    category: "park",
    level: "trail",
    levelNumber: 3,
  }),
  discoveryStop({
    id: "samseong-osm-samseong-sunrise-park",
    name: "삼성해맞이공원",
    shortName: "해맞이공원",
    description: "한강 방향의 긴 산책을 연결하는 공원 스톱",
    longitude: 127.0614552,
    latitude: 37.5203902,
    category: "park",
    level: "trail",
    levelNumber: 3,
  }),
  discoveryStop({
    id: "samseong-osm-eonbuk-sports-center",
    name: "언북문화체육센터 앞",
    shortName: "언북체육센터",
    description: "공공 체육시설 앞 보행 거점. 시설 종목은 현장 운영정보를 확인해요.",
    longitude: 127.0456483,
    latitude: 37.5201138,
    category: "plaza",
    level: "trail",
    levelNumber: 3,
  }),
];

type HubSeed = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  longitude: number;
  latitude: number;
  level: MoveSpot["level"];
  levelNumber: number;
  sports: SportType[];
};

function verifiedWalkingHub(seed: HubSeed): MoveSpot {
  return {
    ...seed,
    areaName: "삼성동",
    category: "park",
    energy: 2480 + seed.levelNumber * 210,
    energyGoal: 5200 + seed.levelNumber * 300,
    verified: true,
    closesAt: "21:00",
    distanceLabel: distanceLabel(seed.latitude, seed.longitude),
    kind: "verified-hub",
    // The public location is source-verified, but arbitrary user-hosted events
    // remain locked until a separate on-site access check is completed.
    eventEligible: false,
    source: SEOUL_PARK_SOURCE,
  };
}

export const SAMSEONG_VERIFIED_HUBS: readonly MoveSpot[] = [
  verifiedWalkingHub({
    id: "samseong-official-hakbong-park",
    name: "학봉근린공원 Move Hub",
    shortName: "학봉 Move Hub",
    description: "힐스테이트 2단지 밖 공개 공원에서 시작하는 걷기·러닝 허브",
    longitude: 127.051933,
    latitude: 37.5128746,
    level: "landmark",
    levelNumber: 7,
    sports: ["walking", "running", "plogging"],
  }),
  verifiedWalkingHub({
    id: "samseong-official-baekkot-park",
    name: "배꽃근린공원 Move Hub",
    shortName: "배꽃 Move Hub",
    description: "강남도서관과 공원 길을 연결하는 초보자용 활동 허브",
    longitude: 127.044296,
    latitude: 37.5162506,
    level: "pulse",
    levelNumber: 6,
    sports: ["walking", "running", "plogging"],
  }),
  verifiedWalkingHub({
    id: "samseong-official-saemteo-park",
    name: "샘터근린공원 Move Hub",
    shortName: "샘터 Move Hub",
    description: "짧은 걷기와 플로깅 활동을 열 수 있는 공개 공원 허브",
    longitude: 127.047249,
    latitude: 37.5155563,
    level: "active",
    levelNumber: 5,
    sports: ["walking", "running", "plogging"],
  }),
  verifiedWalkingHub({
    id: "samseong-official-cheongdam-park",
    name: "청담근린공원 Move Hub",
    shortName: "청담 Move Hub",
    description: "청담역에서 이어지는 중거리 걷기·러닝 활동 허브",
    longitude: 127.053101,
    latitude: 37.5201645,
    level: "pulse",
    levelNumber: 6,
    sports: ["walking", "running", "plogging"],
  }),
];

export const SAMSEONG_DISCOVERY_STOPS: readonly MoveSpot[] = [
  ...SUBWAY_DISCOVERY_STOPS,
  ...PLACE_DISCOVERY_STOPS,
];

export const SAMSEONG_MOVE_EVENTS: readonly MoveEvent[] = [
  {
    id: "event-samseong-hakbong-power-walk",
    spotId: "samseong-official-hakbong-park",
    hostId: "lumi",
    hostName: "LUMI",
    title: "학봉 20분 파워 워크",
    description: "처음 만난 메이트와 공원 바깥길을 한 바퀴 걷는 짧은 활동이에요.",
    sport: "walking",
    mode: "casual",
    skillLevel: "first",
    startLabel: "오늘 19:40",
    startsAt: "2026-07-19T19:40:00+09:00",
    durationMinutes: 20,
    capacity: 8,
    participants: 5,
    deposit: 8,
    hostCost: 20,
    beginnerFriendly: true,
    equipment: ["편한 운동화", "물"],
    distanceLabel: "약 100m",
    status: "check-in",
    rewardCoin: 20,
    rewardXp: 110,
  },
  {
    id: "event-samseong-baekkot-rhythm-run",
    spotId: "samseong-official-baekkot-park",
    hostId: "dash",
    hostName: "DASH",
    title: "배꽃 1.5km 리듬런",
    description: "기록 경쟁 없이 서로의 속도를 맞추는 초보 러닝 세션이에요.",
    sport: "running",
    mode: "practice",
    skillLevel: "beginner",
    startLabel: "오늘 20:10",
    startsAt: "2026-07-19T20:10:00+09:00",
    durationMinutes: 35,
    capacity: 10,
    participants: 6,
    deposit: 10,
    hostCost: 24,
    beginnerFriendly: true,
    equipment: ["러닝화", "물"],
    distanceLabel: "약 730m",
    status: "scheduled",
    rewardCoin: 26,
    rewardXp: 145,
  },
  {
    id: "event-samseong-saemteo-plogging",
    spotId: "samseong-official-saemteo-park",
    hostId: "mint",
    hostName: "MINT",
    title: "샘터 30분 플로깅",
    description: "샘터공원에서 삼성중앙역 방향까지 걸으며 동네를 가볍게 정리해요.",
    sport: "plogging",
    mode: "casual",
    skillLevel: "first",
    startLabel: "오늘 20:20",
    startsAt: "2026-07-19T20:20:00+09:00",
    durationMinutes: 30,
    capacity: 8,
    participants: 4,
    deposit: 8,
    hostCost: 20,
    beginnerFriendly: true,
    equipment: ["장갑", "작은 봉투"],
    distanceLabel: "약 400m",
    status: "scheduled",
    rewardCoin: 24,
    rewardXp: 130,
  },
  {
    id: "event-samseong-cheongdam-morning-walk",
    spotId: "samseong-official-cheongdam-park",
    hostId: "nova",
    hostName: "NOVA",
    title: "청담 모닝 워크",
    description: "청담근린공원에서 만나 아침 공기를 마시며 천천히 걷는 예약 활동이에요.",
    sport: "walking",
    mode: "casual",
    skillLevel: "first",
    startLabel: "내일 08:00",
    startsAt: "2026-07-20T08:00:00+09:00",
    durationMinutes: 40,
    capacity: 10,
    participants: 3,
    deposit: 8,
    hostCost: 22,
    beginnerFriendly: true,
    equipment: ["편한 운동화", "물"],
    distanceLabel: "약 720m",
    status: "scheduled",
    rewardCoin: 25,
    rewardXp: 140,
  },
];

export const SAMSEONG_LOCAL_SPOT_COUNT =
  SAMSEONG_VERIFIED_HUBS.length + SAMSEONG_DISCOVERY_STOPS.length;
