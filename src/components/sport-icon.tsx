import {
  Activity,
  CircleDot,
  Footprints,
  Goal,
  Leaf,
  PersonStanding,
  type LucideIcon,
} from "lucide-react";
import type { SportType } from "@/types/moverse";

const SPORT_ICONS: Record<SportType, LucideIcon> = {
  running: Footprints,
  walking: PersonStanding,
  basketball: CircleDot,
  football: Goal,
  badminton: Activity,
  plogging: Leaf,
};

type SportIconProps = {
  sport: SportType;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function SportIcon({ sport, size = 22, strokeWidth = 2, className }: SportIconProps) {
  const Icon = SPORT_ICONS[sport];
  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={strokeWidth} />;
}
