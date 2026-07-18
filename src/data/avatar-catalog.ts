import type { AvatarId } from "@/types/moverse";

export const AVATAR_IDS = ["nova", "lumi", "dash", "mint"] as const;

export type { AvatarId };

export type AvatarProfile = {
  id: AvatarId;
  name: string;
  src: string;
  accent: string;
  alt: string;
};

export const AVATAR_CATALOG: Record<AvatarId, AvatarProfile> = {
  nova: {
    id: "nova",
    name: "NOVA",
    src: "/avatars/nova-profile.webp",
    accent: "#ceff3d",
    alt: "라임 포인트 운동복을 입은 NOVA 프로필 캐릭터",
  },
  lumi: {
    id: "lumi",
    name: "LUMI",
    src: "/avatars/lumi-profile.webp",
    accent: "#56e1d2",
    alt: "시안 포인트 운동복을 입은 LUMI 프로필 캐릭터",
  },
  dash: {
    id: "dash",
    name: "DASH",
    src: "/avatars/dash-profile.webp",
    accent: "#ff975f",
    alt: "오렌지 포인트 운동복을 입은 DASH 프로필 캐릭터",
  },
  mint: {
    id: "mint",
    name: "MINT",
    src: "/avatars/mint-profile.webp",
    accent: "#58e6b7",
    alt: "민트 포인트 운동복을 입은 MINT 프로필 캐릭터",
  },
};

export const DEFAULT_AVATAR_ID: AvatarId = "nova";

export function getAvatarProfile(id: AvatarId = DEFAULT_AVATAR_ID) {
  return AVATAR_CATALOG[id];
}
