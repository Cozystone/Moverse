export type SportType =
  | "running"
  | "walking"
  | "basketball"
  | "football"
  | "badminton"
  | "plogging";

export type EventMode = "casual" | "practice" | "match" | "raid";
export type SkillLevel = "first" | "beginner" | "casual" | "experienced";

export type MoveSpot = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  longitude: number;
  latitude: number;
  category: "park" | "court" | "trail" | "plaza";
  level: "seed" | "trail" | "active" | "pulse" | "landmark";
  levelNumber: number;
  energy: number;
  energyGoal: number;
  sports: SportType[];
  verified: boolean;
  closesAt: string;
  distanceLabel: string;
};

export type MoveEvent = {
  id: string;
  spotId: string;
  hostId: string;
  hostName: string;
  title: string;
  description: string;
  sport: SportType;
  mode: EventMode;
  skillLevel: SkillLevel;
  startLabel: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  participants: number;
  deposit: number;
  hostCost: number;
  beginnerFriendly: boolean;
  equipment: string[];
  distanceLabel: string;
  status: "scheduled" | "check-in" | "active" | "completed";
  rewardCoin: number;
  rewardXp: number;
};

export type MoveMate = {
  id: string;
  nickname: string;
  avatar: string;
  sports: SportType[];
  sharedActivities: number;
  status: string;
  lastActive: string;
  verified: boolean;
};

export type ActivityRecord = {
  id: string;
  eventId: string;
  title: string;
  sport: SportType;
  date: string;
  durationMinutes: number;
  distanceKm?: number;
  coin: number;
  xp: number;
};

export const SPORT_META: Record<
  SportType,
  { label: string; color: string; soft: string }
> = {
  running: { label: "러닝", color: "#a3e635", soft: "#ecfccb" },
  walking: { label: "걷기", color: "#2dd4bf", soft: "#ccfbf1" },
  basketball: { label: "농구", color: "#fb923c", soft: "#ffedd5" },
  football: { label: "축구", color: "#22c55e", soft: "#dcfce7" },
  badminton: { label: "배드민턴", color: "#38bdf8", soft: "#e0f2fe" },
  plogging: { label: "플로깅", color: "#10b981", soft: "#d1fae5" },
};

export const MODE_LABEL: Record<EventMode, string> = {
  casual: "가볍게",
  practice: "연습",
  match: "경기",
  raid: "레이드",
};
