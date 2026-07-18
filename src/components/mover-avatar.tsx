import type { CSSProperties } from "react";
import Image from "next/image";
import clsx from "clsx";
import { AVATAR_CATALOG, type AvatarId } from "@/data/avatar-catalog";

export type MoverAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type MoverAvatarStatus = "moving" | "online" | "idle" | "offline";
export type MoverAvatarRing = "none" | "neutral" | "lime" | "accent";
export type MoverAvatarFraming = "face" | "bust" | "full";

export type MoverAvatarProps = {
  avatarId?: AvatarId;
  size?: MoverAvatarSize;
  status?: MoverAvatarStatus;
  ring?: MoverAvatarRing;
  label?: boolean | string;
  framing?: MoverAvatarFraming;
  preload?: boolean;
  className?: string;
};

const SIZE_STYLES: Record<MoverAvatarSize, { frame: string; px: number; status: string; label: string }> = {
  xs: { frame: "size-9 rounded-[11px]", px: 36, status: "size-2.5 border-2", label: "text-[8px] px-1.5 py-0.5" },
  sm: { frame: "size-12 rounded-[14px]", px: 48, status: "size-3 border-2", label: "text-[9px] px-2 py-0.5" },
  md: { frame: "size-16 rounded-[18px]", px: 64, status: "size-3.5 border-[3px]", label: "text-[10px] px-2.5 py-1" },
  lg: { frame: "size-24 rounded-[24px]", px: 96, status: "size-4 border-[3px]", label: "text-[11px] px-3 py-1" },
  xl: { frame: "size-36 rounded-[32px]", px: 144, status: "size-5 border-4", label: "text-xs px-3.5 py-1.5" },
};

const RING_STYLES: Record<MoverAvatarRing, string> = {
  none: "border-transparent",
  neutral: "border-white/15 shadow-[0_10px_28px_rgba(0,0,0,.26)]",
  lime: "border-[#ceff3d] shadow-[0_0_0_3px_rgba(5,7,6,.88),0_12px_30px_rgba(0,0,0,.3)]",
  accent: "border-[var(--avatar-accent)] shadow-[0_0_0_3px_rgba(5,7,6,.88),0_12px_30px_rgba(0,0,0,.3)]",
};

const FRAMING_STYLES: Record<MoverAvatarFraming, string> = {
  face: "origin-top scale-[2.8]",
  bust: "origin-top scale-[2.05]",
  full: "origin-center scale-100",
};

const STATUS_STYLES: Record<MoverAvatarStatus, { color: string; label: string }> = {
  moving: { color: "bg-[#ceff3d]", label: "이동 중" },
  online: { color: "bg-[#56e1d2]", label: "온라인" },
  idle: { color: "bg-[#ff975f]", label: "잠시 멈춤" },
  offline: { color: "bg-[#78827d]", label: "오프라인" },
};

export function MoverAvatar({
  avatarId = "nova",
  size = "md",
  status,
  ring = "neutral",
  label,
  framing = "bust",
  preload = false,
  className,
}: MoverAvatarProps) {
  const avatar = AVATAR_CATALOG[avatarId];
  const sizeStyle = SIZE_STYLES[size];
  const visibleLabel = typeof label === "string" ? label : label ? avatar.name : null;
  const style = { "--avatar-accent": avatar.accent } as CSSProperties;

  return (
    <span className={clsx("relative inline-flex shrink-0", className)} style={style}>
      <span
        className={clsx(
          "relative isolate block overflow-hidden border-2 bg-[#151a17]",
          sizeStyle.frame,
          RING_STYLES[ring],
        )}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,color-mix(in_srgb,var(--avatar-accent)_22%,transparent),transparent_62%)]" />
        <Image
          src={avatar.src}
          alt={avatar.alt}
          fill
          unoptimized
          preload={preload}
          sizes={`${sizeStyle.px}px`}
          className={clsx("z-[1] object-contain transition-transform duration-200", FRAMING_STYLES[framing])}
        />
      </span>

      {status ? (
        <span
          aria-label={STATUS_STYLES[status].label}
          title={STATUS_STYLES[status].label}
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 z-[2] rounded-full border-[#050706]",
            sizeStyle.status,
            STATUS_STYLES[status].color,
          )}
        />
      ) : null}

      {visibleLabel ? (
        <span
          className={clsx(
            "absolute left-1/2 top-full z-[3] mt-1 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#050706]/95 font-black leading-none tracking-[0.08em] text-white shadow-lg backdrop-blur-md",
            sizeStyle.label,
          )}
        >
          {visibleLabel}
        </span>
      ) : null}
    </span>
  );
}
