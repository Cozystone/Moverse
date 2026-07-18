"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Coins,
  Goal,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Minus,
  Moon,
  Navigation,
  Pause,
  Play,
  Plus,
  QrCode,
  Radio,
  RefreshCw,
  Route,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trophy,
  UserRoundCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { DEMO_SPOTS } from "@/data/demo-data";
import type {
  MoveEvent as StoreMoveEvent,
  MoveSpot as StoreMoveSpot,
  SportType as StoreSportType,
} from "@/types/moverse";

export type SportType = StoreSportType;

export type EventMode = "casual" | "practice" | "match" | "raid";

export type SkillLevel = "first" | "beginner" | "casual" | "experienced";

export interface ActivityEvent {
  id: string;
  title: string;
  sport: SportType;
  mode: EventMode;
  spotName: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  participantCount: number;
  hostName: string;
  hostLevel?: number;
  skillLevel?: SkillLevel;
  beginnerFriendly?: boolean;
  deposit?: number;
  description?: string;
  equipment?: string[];
  distanceText?: string;
}

export interface ActivityCompletion {
  eventId: string;
  durationSeconds: number;
  progress: number;
  goal: number;
  energyEarned: number;
  coinEarned: number;
  experienceEarned: number;
  spotEnergyEarned: number;
  completedAt: string;
}

export interface MateCandidate {
  id: string;
  nickname: string;
  avatar: string;
  sharedSport: SportType;
  sharedActivityCount: number;
}

export interface ActivityFlowProps {
  event: ActivityEvent;
  open: boolean;
  onClose: () => void;
  onComplete: (result: ActivityCompletion) => void;
  onMateRequest: (candidate: MateCandidate) => void;
  onReserve?: () => boolean;
}

export interface CreateEventInput {
  title: string;
  sport: SportType;
  mode: EventMode;
  spotName: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  beginnerFriendly: boolean;
  hostCost: number;
  spotId?: string;
}

export interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (event: CreateEventInput) => void;
  initialSpotName?: string;
  availableCoin?: number;
  coinBalance?: number;
  spots?: readonly StoreMoveSpot[];
}

type FlowStep =
  | "detail"
  | "reserved"
  | "checkin"
  | "qr"
  | "matched"
  | "active"
  | "result";

type LocationState = "idle" | "locating" | "verified" | "demo" | "failed";

type SportMeta = {
  label: string;
  emoji: string;
  accent: string;
  soft: string;
  gradient: string;
  goalLabel: string;
  goal: number;
  unit: string;
  increment: number;
  defaultTitle: string;
};

const SPORT_META: Record<SportType, SportMeta> = {
  running: {
    label: "러닝",
    emoji: "🏃",
    accent: "#b9ff57",
    soft: "#253a1f",
    gradient: "from-[#9fea47] via-[#42dba9] to-[#1ba7a6]",
    goalLabel: "팀 누적 거리",
    goal: 1.5,
    unit: "km",
    increment: 0.08,
    defaultTitle: "함께 달리는 이지런",
  },
  basketball: {
    label: "농구",
    emoji: "🏀",
    accent: "#ffb15b",
    soft: "#3b2b1c",
    gradient: "from-[#ffb24f] via-[#ff775c] to-[#dd4d8a]",
    goalLabel: "팀 슛 성공",
    goal: 20,
    unit: "회",
    increment: 1,
    defaultTitle: "가볍게 즐기는 3대3",
  },
  football: {
    label: "축구",
    emoji: "⚽",
    accent: "#62e6a6",
    soft: "#17382c",
    gradient: "from-[#52e195] via-[#21b78a] to-[#147a82]",
    goalLabel: "팀 패스 연결",
    goal: 50,
    unit: "회",
    increment: 3,
    defaultTitle: "초보 환영 미니 풋살",
  },
  badminton: {
    label: "배드민턴",
    emoji: "🏸",
    accent: "#79d9ff",
    soft: "#183447",
    gradient: "from-[#75ddff] via-[#6e9bff] to-[#8172ee]",
    goalLabel: "팀 랠리 연결",
    goal: 40,
    unit: "회",
    increment: 2,
    defaultTitle: "부담 없는 랠리 타임",
  },
  walking: {
    label: "걷기",
    emoji: "🚶",
    accent: "#72f1c5",
    soft: "#17372f",
    gradient: "from-[#62e6b5] via-[#34c5aa] to-[#288ca3]",
    goalLabel: "팀 누적 거리",
    goal: 1.2,
    unit: "km",
    increment: 0.07,
    defaultTitle: "대화하며 걷는 Move Walk",
  },
  plogging: {
    label: "플로깅",
    emoji: "🌱",
    accent: "#5ee59d",
    soft: "#18372a",
    gradient: "from-[#62df8d] via-[#2eb47b] to-[#218487]",
    goalLabel: "함께 모은 클린 포인트",
    goal: 30,
    unit: "점",
    increment: 2,
    defaultTitle: "함께 만드는 클린 트레일",
  },
};

const CREATE_SPORTS: SportType[] = [
  "running",
  "basketball",
  "football",
  "badminton",
];

const MODE_META: Record<EventMode, { label: string; description: string }> = {
  casual: { label: "Casual", description: "승패 없이 가볍게" },
  practice: { label: "Practice", description: "함께 배우고 연습" },
  match: { label: "Match", description: "균형 잡힌 팀 경기" },
  raid: { label: "Raid", description: "모두의 공동 목표" },
};

const FLOW_STEPS: FlowStep[] = [
  "detail",
  "reserved",
  "checkin",
  "qr",
  "matched",
  "active",
  "result",
];

const MATE_CANDIDATE: MateCandidate = {
  id: "mover-lumi",
  nickname: "LUMI",
  avatar: "🌙",
  sharedSport: "basketball",
  sharedActivityCount: 1,
};

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function roundProgress(value: number, sport: SportType) {
  return sport === "running" ? Number(value.toFixed(2)) : Math.round(value);
}

function getDefaultStartsAt() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(17, 30, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function ModalFrame({
  children,
  onClose,
  titleId,
  closeButtonRef,
  labelledBy,
  zIndex = "z-[100]",
}: {
  children: ReactNode;
  onClose: () => void;
  titleId: string;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  labelledBy?: string;
  zIndex?: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  return (
    <motion.div
      className={clsx(
        "fixed inset-0 flex items-end justify-center bg-[#020807]/75 backdrop-blur-md sm:items-center",
        zIndex,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="presentation"
    >
      <motion.section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-[#081410] text-white shadow-[0_24px_90px_rgba(0,0,0,.65)] sm:h-[min(850px,94dvh)] sm:rounded-[32px] sm:border sm:border-white/10"
        initial={{ y: 36, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 340, damping: 31 }}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key !== "Tab") return;
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          );
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (keyboardEvent.shiftKey && document.activeElement === first) {
            keyboardEvent.preventDefault();
            last.focus();
          } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
            keyboardEvent.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id={titleId} className="sr-only">
          Moverse 활동
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-[max(env(safe-area-inset-top),16px)] z-30 grid size-10 place-items-center rounded-full border border-white/10 bg-black/25 text-white/85 backdrop-blur-md transition hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        {children}
      </motion.section>
    </motion.div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "orange" | "blue";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em]",
        tone === "neutral" && "border-white/10 bg-white/[.06] text-white/70",
        tone === "green" &&
          "border-[#b9ff57]/25 bg-[#b9ff57]/10 text-[#d8ff9f]",
        tone === "orange" &&
          "border-[#ffb15b]/25 bg-[#ffb15b]/10 text-[#ffd09c]",
        tone === "blue" && "border-sky-300/20 bg-sky-300/10 text-sky-200",
      )}
    >
      {children}
    </span>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#b9ff57] px-5 py-3.5 text-[15px] font-extrabold tracking-[-0.02em] text-[#0a1a12] shadow-[0_12px_30px_rgba(185,255,87,.16)] transition hover:bg-[#c7ff72] active:scale-[.985] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081410]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.055] px-4 py-3 text-sm font-bold text-white/85 transition hover:bg-white/10 active:scale-[.985] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function FlowProgress({ step }: { step: FlowStep }) {
  const current = FLOW_STEPS.indexOf(step);

  return (
    <div className="flex items-center gap-1.5" aria-label={`전체 7단계 중 ${current + 1}단계`}>
      {FLOW_STEPS.map((item, index) => (
        <span
          key={item}
          className={clsx(
            "h-1.5 rounded-full transition-all duration-300",
            index <= current ? "w-5 bg-[#b9ff57]" : "w-1.5 bg-white/15",
          )}
        />
      ))}
    </div>
  );
}

function SafetyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-sky-300/15 bg-sky-300/[.07] text-sky-100/80",
        compact ? "p-3" : "p-4",
      )}
    >
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-300" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold text-sky-100">만남은 인증하고, 위치는 숨겨요</p>
          {!compact && (
            <p className="mt-1 text-[11px] leading-4 text-sky-100/60">
              학생 인증 사용자만 참여하며, 정확한 실시간 위치와 이동 경로는 서로에게
              공개되지 않습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NightPolicy({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-2xl border border-indigo-300/15 bg-indigo-300/[.07] text-indigo-100/75",
        compact ? "px-3 py-2.5" : "px-4 py-3",
      )}
    >
      <Moon className="size-4 shrink-0 text-indigo-200" aria-hidden="true" />
      <p className="text-[11px] leading-4">
        <strong className="text-indigo-100">Run Spot은 21:00 자동 종료</strong>
        {!compact && " · 이후에는 다음 일정 예약과 DM만 이용할 수 있어요."}
      </p>
    </div>
  );
}

function AvatarStack({ count = 3 }: { count?: number }) {
  const avatars = ["🌙", "⚡", "🌿", "🛹"];
  return (
    <div className="flex -space-x-2" aria-label={`인증된 참가자 ${count}명`}>
      {avatars.slice(0, Math.min(count, avatars.length)).map((avatar, index) => (
        <span
          key={`${avatar}-${index}`}
          className="grid size-8 place-items-center rounded-full border-2 border-[#10211b] bg-[#1a3027] text-sm shadow-sm"
          aria-hidden="true"
        >
          {avatar}
        </span>
      ))}
      {count > avatars.length && (
        <span className="grid size-8 place-items-center rounded-full border-2 border-[#10211b] bg-white/10 text-[10px] font-bold text-white/70">
          +{count - avatars.length}
        </span>
      )}
    </div>
  );
}

function SessionHeader({ step, onBack }: { step: FlowStep; onBack?: () => void }) {
  return (
    <header className="relative z-20 flex min-h-[72px] shrink-0 items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <div className="flex min-w-10 items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="이전 단계"
            className="grid size-10 place-items-center rounded-full text-white/75 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <FlowProgress step={step} />
      <div className="w-10" aria-hidden="true" />
    </header>
  );
}

export function ActivityFlow(props: ActivityFlowProps) {
  return (
    <AnimatePresence>
      {props.open && <ActivityFlowSession key={props.event.id} {...props} />}
    </AnimatePresence>
  );
}

function ActivityFlowSession({
  event,
  onClose,
  onComplete,
  onMateRequest,
  onReserve,
}: ActivityFlowProps) {
  const [step, setStep] = useState<FlowStep>("detail");
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [qrVersion, setQrVersion] = useState(1);
  const [qrSeconds, setQrSeconds] = useState(10);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [completion, setCompletion] = useState<ActivityCompletion | null>(null);
  const [mateRequested, setMateRequested] = useState(false);
  const [exitPrompt, setExitPrompt] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const sport = SPORT_META[event.sport];
  const participantTotal = Math.min(event.capacity, event.participantCount + 1);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        if (step === "active") setExitPrompt(true);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, step]);

  useEffect(() => {
    if (step !== "qr") return;
    const interval = window.setInterval(() => {
      setQrSeconds((seconds) => {
        if (seconds <= 1) {
          setQrVersion((version) => version + 1);
          return 10;
        }
        return seconds - 1;
      });
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step !== "active" || paused) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
      setProgress((value) => Math.min(sport.goal, value + sport.increment));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [paused, sport.goal, sport.increment, step]);

  const tryClose = () => {
    if (step === "active") {
      setExitPrompt(true);
      return;
    }
    onClose();
  };

  const verifyLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationState("failed");
      return;
    }

    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      () => setLocationState("verified"),
      () => setLocationState("failed"),
      { enableHighAccuracy: true, timeout: 7_000, maximumAge: 15_000 },
    );
  };

  const useDemoLocation = () => setLocationState("demo");

  const refreshQr = () => {
    setQrVersion((version) => version + 1);
    setQrSeconds(10);
  };

  const boostDemoGoal = () => {
    setProgress((value) => Math.min(sport.goal, value + sport.goal * 0.25));
    setElapsedSeconds((seconds) => seconds + 15);
  };

  const finishActivity = () => {
    const result: ActivityCompletion = {
      eventId: event.id,
      durationSeconds: Math.max(elapsedSeconds, 60),
      progress: sport.goal,
      goal: sport.goal,
      energyEarned: event.sport === "running" ? 22 : 14,
      coinEarned: event.mode === "raid" ? 34 : 24,
      experienceEarned: event.mode === "raid" ? 180 : 120,
      spotEnergyEarned: event.mode === "raid" ? 18 : 10,
      completedAt: new Date().toISOString(),
    };
    setProgress(sport.goal);
    setCompletion(result);
    setStep("result");
    onComplete(result);
  };

  const requestMate = () => {
    if (mateRequested) return;
    setMateRequested(true);
    onMateRequest({ ...MATE_CANDIDATE, sharedSport: event.sport });
  };

  const goBack: Partial<Record<FlowStep, () => void>> = {
    reserved: () => setStep("detail"),
    checkin: () => setStep("reserved"),
    qr: () => setStep("checkin"),
    matched: () => setStep("qr"),
  };

  return (
    <ModalFrame
      onClose={tryClose}
      titleId={titleId}
      closeButtonRef={closeButtonRef}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="flex min-h-0 flex-1 flex-col"
          initial={reducedMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          aria-live="polite"
        >
          {step === "detail" && (
            <EventDetailStep
              event={event}
              sport={sport}
              onReserve={() => {
                if (onReserve?.() === false) return;
                setStep("reserved");
              }}
            />
          )}
          {step === "reserved" && (
            <ReservedStep
              event={event}
              onBack={goBack.reserved}
              onCheckIn={() => setStep("checkin")}
            />
          )}
          {step === "checkin" && (
            <CheckInStep
              event={event}
              state={locationState}
              onBack={goBack.checkin}
              onVerify={verifyLocation}
              onDemo={useDemoLocation}
              onContinue={() => setStep("qr")}
            />
          )}
          {step === "qr" && (
            <QrStep
              event={event}
              seconds={qrSeconds}
              version={qrVersion}
              onBack={goBack.qr}
              onRefresh={refreshQr}
              onTagged={() => setStep("matched")}
            />
          )}
          {step === "matched" && (
            <MatchedStep
              event={event}
              onBack={goBack.matched}
              onStart={() => setStep("active")}
            />
          )}
          {step === "active" && (
            <ActiveStep
              event={event}
              sport={sport}
              elapsedSeconds={elapsedSeconds}
              progress={progress}
              paused={paused}
              participantTotal={participantTotal}
              onTogglePause={() => setPaused((value) => !value)}
              onBoost={boostDemoGoal}
              onFinish={finishActivity}
              onExit={() => setExitPrompt(true)}
            />
          )}
          {step === "result" && completion && (
            <ResultStep
              event={event}
              sport={sport}
              result={completion}
              mateRequested={mateRequested}
              onMateRequest={requestMate}
              onClose={onClose}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {exitPrompt && (
          <motion.div
            className="absolute inset-0 z-50 flex items-end bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${titleId}-exit`}
              className="w-full rounded-[28px] border border-white/10 bg-[#12221c] p-5 shadow-2xl"
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              exit={{ y: 24 }}
            >
              <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                <CircleAlert className="size-5" aria-hidden="true" />
              </div>
              <h3 id={`${titleId}-exit`} className="mt-4 text-lg font-extrabold">
                활동에서 안전 이탈할까요?
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/55">
                현재 기록은 저장되지 않습니다. 불편하거나 위험한 상황이라면 즉시 이탈한 뒤
                신고할 수 있어요.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <SecondaryButton onClick={() => setExitPrompt(false)}>계속 활동</SecondaryButton>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-12 rounded-2xl bg-red-400/12 px-4 text-sm font-bold text-red-200 transition hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  안전 이탈
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalFrame>
  );
}

function EventDetailStep({
  event,
  sport,
  onReserve,
}: {
  event: ActivityEvent;
  sport: SportMeta;
  onReserve: () => void;
}) {
  return (
    <>
      <div className={clsx("relative overflow-hidden bg-gradient-to-br px-5 pb-7 pt-[max(env(safe-area-inset-top),24px)]", sport.gradient)}>
        <div className="absolute -right-10 -top-8 size-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-10 left-12 size-36 rounded-full bg-black/20 blur-3xl" />
        <div className="relative pr-12">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/20 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-white/90 backdrop-blur">
              {MODE_META[event.mode].label}
            </span>
            {event.beginnerFriendly && (
              <span className="rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
                초보자 환영
              </span>
            )}
          </div>
          <div className="mt-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white/70">{sport.label} · {MODE_META[event.mode].description}</p>
              <h3 className="mt-2 max-w-[290px] text-[28px] font-black leading-[1.08] tracking-[-0.045em] text-white">
                {event.title}
              </h3>
            </div>
            <span className="text-5xl drop-shadow-xl" role="img" aria-label={sport.label}>
              {sport.emoji}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="-mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-white/10 bg-[#12231d] p-3.5 shadow-xl">
            <Clock3 className="size-4 text-[#b9ff57]" aria-hidden="true" />
            <p className="mt-2 text-[11px] text-white/45">일정 · {event.durationMinutes}분</p>
            <p className="mt-0.5 text-xs font-bold text-white/85">{formatEventDate(event.startsAt)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#12231d] p-3.5 shadow-xl">
            <Users className="size-4 text-[#b9ff57]" aria-hidden="true" />
            <p className="mt-2 text-[11px] text-white/45">함께할 무버</p>
            <p className="mt-0.5 text-xs font-bold text-white/85">
              {event.participantCount}/{event.capacity}명 · {event.capacity - event.participantCount}자리
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[.035] p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-lg">📍</div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-white/40">공개된 안전 집결지</p>
              <p className="mt-0.5 truncate text-sm font-extrabold text-white/90">{event.spotName}</p>
              <p className="mt-1 text-[11px] text-white/45">{event.distanceText ?? "현재 위치에서 도보 8분"}</p>
            </div>
            <Navigation className="mt-1 size-4 text-white/35" aria-hidden="true" />
          </div>
          <div className="mt-4 h-px bg-white/8" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-full bg-[#223a31] text-sm">🧢</div>
              <div>
                <p className="flex items-center gap-1 text-xs font-bold">
                  {event.hostName}
                  <BadgeCheck className="size-3.5 fill-[#b9ff57] text-[#17311e]" aria-label="학생 인증 완료" />
                </p>
                <p className="text-[10px] text-white/40">Host Lv.{event.hostLevel ?? 4} · 정상 완료 12회</p>
              </div>
            </div>
            <AvatarStack count={Math.max(1, event.participantCount)} />
          </div>
        </div>

        <div className="mt-3 rounded-[24px] border border-white/8 bg-white/[.035] p-4">
          <div className="flex items-center gap-2">
            <Goal className="size-4 text-[#b9ff57]" aria-hidden="true" />
            <h4 className="text-xs font-extrabold">오늘의 공동 목표</h4>
          </div>
          <p className="mt-2 text-sm font-bold text-white/90">
            {sport.goalLabel} {sport.goal}{sport.unit} 달성
          </p>
          <p className="mt-1 text-[11px] leading-4 text-white/45">
            승패보다 실제 만남과 함께한 시간을 보상해요. 목표를 함께 채우면 Spot도 성장합니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone="green"><UserRoundCheck className="size-3" />학생 인증</Pill>
            <Pill><LockKeyhole className="size-3" />위치 비공개</Pill>
            <Pill tone="orange">보증금 {event.deposit ?? 0} Coin</Pill>
          </div>
        </div>

        {event.description && (
          <p className="mt-4 px-1 text-xs leading-5 text-white/50">{event.description}</p>
        )}
        <div className="mt-3 space-y-2.5">
          <SafetyNotice compact />
          <NightPolicy compact />
        </div>
      </div>

      <div className="shrink-0 border-t border-white/8 bg-[#081410]/95 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between text-[11px]">
          <span className="text-white/45">정상 체크인 시 보증금 전액 반환</span>
          <span className="flex items-center gap-1 font-bold text-[#d7ff9f]"><Coins className="size-3.5" /> +24 예상</span>
        </div>
        <PrimaryButton onClick={onReserve}>
          <CalendarPlus className="size-4.5" aria-hidden="true" />
          이 활동 예약하기
        </PrimaryButton>
      </div>
    </>
  );
}

function ReservedStep({
  event,
  onBack,
  onCheckIn,
}: {
  event: ActivityEvent;
  onBack?: () => void;
  onCheckIn: () => void;
}) {
  return (
    <>
      <SessionHeader step="reserved" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
        <motion.div
          className="mx-auto grid size-20 place-items-center rounded-[28px] bg-[#b9ff57] text-[#0a1a12] shadow-[0_18px_55px_rgba(185,255,87,.2)]"
          initial={{ scale: 0.7, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        >
          <Check className="size-9 stroke-[3]" aria-hidden="true" />
        </motion.div>
        <div className="mt-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b9ff57]">Seat secured</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">자리를 확보했어요</h3>
          <p className="mt-2 text-sm leading-5 text-white/45">현장에 도착하기 전까지 다른 참가자의<br />정확한 정보와 위치는 공개되지 않아요.</p>
        </div>

        <div className="mt-7 overflow-hidden rounded-[26px] border border-white/10 bg-[#10211b]">
          <div className="border-b border-dashed border-white/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Move Ticket</p>
                <p className="mt-2 text-base font-extrabold">{event.title}</p>
                <p className="mt-1 text-xs text-white/45">{formatEventDate(event.startsAt)}</p>
              </div>
              <span className="text-3xl" aria-hidden="true">{SPORT_META[event.sport].emoji}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/8">
            <div className="bg-[#10211b] p-4">
              <p className="text-[10px] text-white/35">집결 장소</p>
              <p className="mt-1 truncate text-xs font-bold">{event.spotName}</p>
            </div>
            <div className="bg-[#10211b] p-4">
              <p className="text-[10px] text-white/35">예약 번호</p>
              <p className="mt-1 font-mono text-xs font-bold">MV-{event.id.slice(-4).toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-[24px] border border-white/8 bg-white/[.035] p-4">
          {[
            ["1", "Spot 반경에서 위치만 확인", "정확한 좌표는 참가자에게 보이지 않아요."],
            ["2", "10초마다 바뀌는 QR로 태그", "화면 캡처와 원격 공유를 막아요."],
            ["3", "함께 활동한 뒤 보상", "참여·협력·안전한 종료를 확인해요."],
          ].map(([number, title, description]) => (
            <div key={number} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#b9ff57]/10 text-[11px] font-black text-[#b9ff57]">{number}</span>
              <div>
                <p className="text-xs font-bold text-white/85">{title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-white/40">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-white/8 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4">
        <NightPolicy compact />
        <PrimaryButton onClick={onCheckIn} className="mt-3">
          <MapPin className="size-4.5" /> 현장 체크인 열기
        </PrimaryButton>
      </div>
    </>
  );
}

function CheckInStep({
  event,
  state,
  onBack,
  onVerify,
  onDemo,
  onContinue,
}: {
  event: ActivityEvent;
  state: LocationState;
  onBack?: () => void;
  onVerify: () => void;
  onDemo: () => void;
  onContinue: () => void;
}) {
  const ready = state === "verified" || state === "demo";

  return (
    <>
      <SessionHeader step="checkin" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#b9ff57]">On-site check</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">Spot에 도착했나요?</h3>
          <p className="mt-2 text-sm text-white/45">반경 안에 있다는 사실만 확인합니다.</p>
        </div>

        <div className="relative mx-auto mt-7 grid aspect-square w-[min(74vw,290px)] place-items-center overflow-hidden rounded-full border border-[#b9ff57]/15 bg-[#b9ff57]/[.035]">
          {["88%", "63%", "38%"].map((size, index) => (
            <motion.div
              key={size}
              className="absolute rounded-full border border-[#b9ff57]/15"
              style={{ width: size, height: size }}
              animate={{ opacity: [0.25, 0.8, 0.25] }}
              transition={{ duration: 2.5, delay: index * 0.35, repeat: Infinity }}
            />
          ))}
          <motion.div
            className="absolute left-1/2 top-1/2 h-[44%] w-px origin-top bg-gradient-to-b from-[#b9ff57] to-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <div className="relative z-10 grid size-20 place-items-center rounded-[28px] border border-[#b9ff57]/30 bg-[#13271f] shadow-[0_0_50px_rgba(185,255,87,.16)]">
            {state === "locating" ? (
              <RefreshCw className="size-7 animate-spin text-[#b9ff57]" aria-label="위치 확인 중" />
            ) : ready ? (
              <CheckCircle2 className="size-8 text-[#b9ff57]" aria-label="위치 확인 완료" />
            ) : (
              <MapPin className="size-8 text-[#b9ff57]" aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/8 bg-white/[.035] p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/8"><Radio className="size-4 text-[#b9ff57]" /></div>
            <div>
              <p className="text-xs font-extrabold">{event.spotName}</p>
              <p className="mt-1 text-[11px] leading-4 text-white/45">허용 반경 80m · 개인 좌표와 이동 경로는 저장하지 않음</p>
            </div>
          </div>
          {state === "verified" && <p className="mt-3 rounded-xl bg-[#b9ff57]/10 p-3 text-[11px] font-bold text-[#d9ffa4]">GPS 반경 확인 완료 · 정확한 좌표는 즉시 폐기됩니다.</p>}
          {state === "demo" && <p className="mt-3 rounded-xl bg-sky-300/10 p-3 text-[11px] font-bold text-sky-200">데모 현장 인증 완료 · 발표용 안전 경로로 진행합니다.</p>}
          {state === "failed" && <p className="mt-3 rounded-xl bg-amber-300/10 p-3 text-[11px] leading-4 text-amber-100">위치를 확인하지 못했어요. 권한을 다시 허용하거나 아래 데모 인증으로 흐름을 확인하세요.</p>}
        </div>
        <SafetyNotice compact />
      </div>
      <div className="shrink-0 space-y-2.5 border-t border-white/8 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4">
        {!ready ? (
          <>
            <PrimaryButton onClick={onVerify} disabled={state === "locating"}>
              <Navigation className="size-4.5" />
              {state === "locating" ? "Spot 반경 확인 중…" : "현장 위치 확인"}
            </PrimaryButton>
            <SecondaryButton onClick={onDemo}>
              <ScanLine className="size-4" /> 위치 없이 데모 인증
            </SecondaryButton>
          </>
        ) : (
          <PrimaryButton onClick={onContinue}>
            동적 QR 열기 <ChevronRight className="size-4" />
          </PrimaryButton>
        )}
      </div>
    </>
  );
}

function QrStep({
  event,
  seconds,
  version,
  onBack,
  onRefresh,
  onTagged,
}: {
  event: ActivityEvent;
  seconds: number;
  version: number;
  onBack?: () => void;
  onRefresh: () => void;
  onTagged: () => void;
}) {
  const token = JSON.stringify({
    session: `mv-${event.id}`,
    event: event.id,
    nonce: `dynamic-${version}`,
    expiresIn: 10,
  });

  return (
    <>
      <SessionHeader step="qr" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#b9ff57]">Mutual tag</p>
        <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">서로의 QR을 태그하세요</h3>
        <p className="mt-2 text-sm leading-5 text-white/45">양쪽 인증이 모두 끝나야 활동이 시작돼요.</p>

        <div className="relative mx-auto mt-6 w-fit">
          <motion.div
            className="absolute -inset-4 rounded-[38px] bg-[#b9ff57]/15 blur-2xl"
            animate={{ opacity: [0.3, 0.75, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
          <div className="relative rounded-[30px] border border-white/15 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,.35)]">
            <QRCodeSVG
              value={token}
              size={196}
              bgColor="#ffffff"
              fgColor="#0b1b13"
              level="M"
              marginSize={1}
              title="Moverse 상호 태그용 동적 QR"
            />
            <div className="mt-3 flex items-center justify-center gap-2 text-[#15241d]">
              <TimerReset className="size-4" />
              <span className="font-mono text-xs font-black">00:{String(seconds).padStart(2, "0")}</span>
              <span className="text-[10px] font-semibold text-black/40">후 자동 변경</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="mx-auto mt-4 flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold text-white/50 transition hover:bg-white/5 hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]"
        >
          <RefreshCw className="size-3.5" /> 지금 새 QR 만들기
        </button>

        <div className="mt-4 grid grid-cols-2 gap-2.5 text-left">
          <div className="rounded-2xl border border-[#b9ff57]/20 bg-[#b9ff57]/8 p-3">
            <CheckCircle2 className="size-4 text-[#b9ff57]" />
            <p className="mt-2 text-[11px] font-bold">나 · 인증 준비</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3">
            <ScanLine className="size-4 text-white/40" />
            <p className="mt-2 text-[11px] font-bold text-white/55">상대 · 스캔 대기</p>
          </div>
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-white/35"><LockKeyhole className="size-3" /> QR에는 실명·학교·정확한 위치가 들어가지 않아요.</p>
      </div>
      <div className="shrink-0 border-t border-white/8 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4">
        <PrimaryButton onClick={onTagged}>
          <QrCode className="size-4.5" /> 데모 상호 태그 완료
        </PrimaryButton>
        <p className="mt-2 text-center text-[10px] text-white/30">카메라가 없거나 권한이 차단된 발표 환경용 fallback</p>
      </div>
    </>
  );
}

function MatchedStep({
  event,
  onBack,
  onStart,
}: {
  event: ActivityEvent;
  onBack?: () => void;
  onStart: () => void;
}) {
  const members = [
    { avatar: "🧢", name: "NOVA", role: "나" },
    { avatar: "🌙", name: "LUMI", role: "Move Mate 후보" },
    { avatar: "⚡", name: "DASH", role: "참가자" },
  ];

  return (
    <>
      <SessionHeader step="matched" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
        <div className="relative mx-auto flex h-32 items-center justify-center">
          <motion.div
            className="absolute size-28 rounded-full border border-[#b9ff57]/35"
            animate={{ scale: [0.8, 1.25], opacity: [0.75, 0] }}
            transition={{ duration: 1.7, repeat: Infinity }}
          />
          <div className="relative grid size-20 place-items-center rounded-[30px] bg-[#b9ff57] text-[#0b1b13] shadow-[0_18px_65px_rgba(185,255,87,.22)]">
            <UserRoundCheck className="size-9" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#b9ff57]">Tag complete</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">모두 현장에서 만났어요</h3>
          <p className="mt-2 text-sm text-white/45">상호 동의와 학생 인증을 확인했습니다.</p>
        </div>

        <div className="mt-7 space-y-2.5">
          {members.map((member, index) => (
            <motion.div
              key={member.name}
              className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/[.035] p-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.12 }}
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-[#1b3229] text-lg">{member.avatar}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">{member.name}</p>
                <p className="text-[10px] text-white/40">{member.role}</p>
              </div>
              <span className="grid size-7 place-items-center rounded-full bg-[#b9ff57]/12 text-[#b9ff57]"><Check className="size-3.5" /></span>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 rounded-[22px] border border-amber-300/15 bg-amber-300/[.06] p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-200" />
            <p className="text-[11px] leading-4 text-amber-50/70">함께 출발하고 함께 종료해요. 불편한 상황에는 언제든 <strong className="text-amber-100">안전 이탈</strong>을 눌러 활동을 종료할 수 있습니다.</p>
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-white/8 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4">
        <div className="mb-3 flex items-center justify-between text-[11px] text-white/45"><span>{event.durationMinutes}분 활동</span><span>21:00 이전 자동 종료</span></div>
        <PrimaryButton onClick={onStart}>
          <Play className="size-4.5 fill-current" /> 함께 활동 시작
        </PrimaryButton>
      </div>
    </>
  );
}

function ActiveStep({
  event,
  sport,
  elapsedSeconds,
  progress,
  paused,
  participantTotal,
  onTogglePause,
  onBoost,
  onFinish,
  onExit,
}: {
  event: ActivityEvent;
  sport: SportMeta;
  elapsedSeconds: number;
  progress: number;
  paused: boolean;
  participantTotal: number;
  onTogglePause: () => void;
  onBoost: () => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const percent = Math.min(100, Math.round((progress / sport.goal) * 100));
  const done = percent >= 100;

  return (
    <>
      <div className={clsx("relative shrink-0 overflow-hidden bg-gradient-to-br px-5 pb-7 pt-[max(env(safe-area-inset-top),24px)]", sport.gradient)}>
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative flex items-center justify-between pr-12">
          <div className="flex items-center gap-2 rounded-full bg-black/20 px-3 py-1.5 backdrop-blur">
            <span className={clsx("size-2 rounded-full", paused ? "bg-amber-300" : "animate-pulse bg-white")} />
            <span className="text-[10px] font-extrabold uppercase tracking-[.16em]">{paused ? "Paused" : "Run Spot live"}</span>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full bg-black/20 px-3 py-2 text-[10px] font-bold text-white/80 backdrop-blur transition hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            안전 이탈
          </button>
        </div>
        <div className="relative mt-7 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[.22em] text-white/65">Move time</p>
          <p className="mt-1 font-mono text-[52px] font-black leading-none tracking-[-0.06em] tabular-nums">{formatTimer(elapsedSeconds)}</p>
          <p className="mt-3 text-xs font-bold text-white/70">{event.title}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
        <div className="rounded-[28px] border border-white/10 bg-[#10221b] p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/45"><Goal className="size-3.5 text-[#b9ff57]" /> 공동 목표</p>
              <p className="mt-1.5 text-base font-extrabold">{sport.goalLabel}</p>
            </div>
            <p className="text-right font-mono text-xl font-black" style={{ color: sport.accent }}>
              {roundProgress(progress, event.sport)}<span className="ml-0.5 text-xs text-white/40">/{sport.goal}{sport.unit}</span>
            </p>
          </div>
          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-white/8"
            role="progressbar"
            aria-label={sport.goalLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: sport.accent }}
              animate={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-white/35"><span>{participantTotal}명이 함께 기여 중</span><span>{percent}% 달성</span></div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[{ avatar: "🧢", value: "NOVA" }, { avatar: "🌙", value: "LUMI" }, { avatar: "⚡", value: "DASH" }].map((member, index) => (
            <div key={member.value} className="rounded-2xl border border-white/8 bg-white/[.035] p-3 text-center">
              <div className="relative mx-auto w-fit"><span className="grid size-10 place-items-center rounded-2xl bg-[#1b3229]">{member.avatar}</span><span className="absolute -bottom-1 -right-1 size-2.5 rounded-full border-2 border-[#10201b] bg-[#b9ff57]" /></div>
              <p className="mt-2 truncate text-[10px] font-bold text-white/60">{member.value}</p>
              <p className="mt-0.5 text-[9px] text-white/30">+{Math.max(1, Math.round(percent * (0.25 + index * 0.04)))}%</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[.035] p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#b9ff57]/10"><Zap className="size-4 text-[#b9ff57]" /></div>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-bold">움직임이 Spot Energy로 전환 중</p><p className="mt-0.5 truncate text-[10px] text-white/35">{event.spotName} · 다음 레벨까지 18%</p></div>
          <ChevronRight className="size-4 text-white/25" />
        </div>
        <NightPolicy compact />
      </div>

      <div className="shrink-0 border-t border-white/8 bg-[#081410]/95 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 backdrop-blur-xl">
        <div className="grid grid-cols-[52px_1fr] gap-2.5">
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={paused ? "활동 재개" : "활동 일시정지"}
            className="grid min-h-13 place-items-center rounded-2xl border border-white/10 bg-white/[.055] transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]"
          >
            {paused ? <Play className="size-5 fill-current" /> : <Pause className="size-5 fill-current" />}
          </button>
          {done ? (
            <PrimaryButton onClick={onFinish}><Trophy className="size-4.5" /> 활동 완료하고 보상 받기</PrimaryButton>
          ) : (
            <SecondaryButton onClick={onBoost}><Sparkles className="size-4" /> 데모 진행 +25%</SecondaryButton>
          )}
        </div>
      </div>
    </>
  );
}

function ResultStep({
  event,
  sport,
  result,
  mateRequested,
  onMateRequest,
  onClose,
}: {
  event: ActivityEvent;
  sport: SportMeta;
  result: ActivityCompletion;
  mateRequested: boolean;
  onMateRequest: () => void;
  onClose: () => void;
}) {
  const confetti = ["#b9ff57", "#72f1c5", "#ffb15b", "#79d9ff", "#c49bff"];

  return (
    <>
      <SessionHeader step="result" />
      <div className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, index) => (
            <motion.span
              key={index}
              className="absolute size-1.5 rounded-sm"
              style={{ left: `${8 + ((index * 17) % 84)}%`, backgroundColor: confetti[index % confetti.length] }}
              initial={{ y: -14, rotate: 0, opacity: 1 }}
              animate={{ y: 150, rotate: 270 + index * 21, opacity: 0 }}
              transition={{ duration: 1.7 + (index % 3) * 0.25, delay: (index % 5) * 0.08 }}
            />
          ))}
        </div>

        <div className="relative text-center">
          <motion.div
            className="mx-auto grid size-20 place-items-center rounded-[28px] bg-[#b9ff57] text-4xl shadow-[0_20px_70px_rgba(185,255,87,.2)]"
            initial={{ scale: 0.45, rotate: -14 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
          >
            {sport.emoji}
          </motion.div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#b9ff57]">Move completed</p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]">함께 목표를 완성했어요!</h3>
          <p className="mt-2 text-sm text-white/45">실제로 만나 움직인 시간이 새로운 관계와 장소를 키웠어요.</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="rounded-[20px] border border-[#b9ff57]/15 bg-[#b9ff57]/[.07] p-3 text-center"><Zap className="mx-auto size-4 text-[#b9ff57]" /><p className="mt-2 font-mono text-lg font-black">+{result.energyEarned}</p><p className="text-[9px] text-white/35">Energy</p></div>
          <div className="rounded-[20px] border border-amber-300/15 bg-amber-300/[.07] p-3 text-center"><Coins className="mx-auto size-4 text-amber-300" /><p className="mt-2 font-mono text-lg font-black">+{result.coinEarned}</p><p className="text-[9px] text-white/35">Move Coin</p></div>
          <div className="rounded-[20px] border border-violet-300/15 bg-violet-300/[.07] p-3 text-center"><Sparkles className="mx-auto size-4 text-violet-300" /><p className="mt-2 font-mono text-lg font-black">+{result.experienceEarned}</p><p className="text-[9px] text-white/35">XP</p></div>
        </div>

        <div className="mt-3 rounded-[24px] border border-white/8 bg-white/[.035] p-4">
          <div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#b9ff57]/10"><Route className="size-5 text-[#b9ff57]" /></div><div className="min-w-0 flex-1"><p className="text-xs font-extrabold">{event.spotName}이 성장했어요</p><p className="mt-1 text-[10px] text-white/40">Spot Energy +{result.spotEnergyEarned} · Active 단계까지 12%</p></div><span className="text-lg">🌱</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"><motion.div className="h-full rounded-full bg-[#b9ff57]" initial={{ width: "58%" }} animate={{ width: "68%" }} transition={{ delay: 0.5, duration: 0.8 }} /></div>
        </div>

        <div className="mt-3 rounded-[24px] border border-sky-300/15 bg-sky-300/[.055] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-[18px] bg-[#1a3432] text-xl">{MATE_CANDIDATE.avatar}</div>
            <div className="min-w-0 flex-1"><p className="text-xs font-extrabold">LUMI와 다시 움직일까요?</p><p className="mt-1 text-[10px] text-white/40">함께 활동한 사용자끼리만 상호 연결할 수 있어요.</p></div>
          </div>
          <button
            type="button"
            onClick={onMateRequest}
            disabled={mateRequested}
            className={clsx(
              "mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200",
              mateRequested ? "bg-[#b9ff57]/12 text-[#d9ffa5]" : "bg-sky-200 text-[#0a1b1b] hover:bg-sky-100",
            )}
          >
            {mateRequested ? <><Check className="size-4" /> Move Mate 요청을 보냈어요</> : <><MessageCircle className="size-4" /> Move Mate 요청하기</>}
          </button>
        </div>
      </div>
      <div className="shrink-0 border-t border-white/8 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4">
        <PrimaryButton onClick={onClose}>지도에서 성장 확인 <ChevronRight className="size-4" /></PrimaryButton>
      </div>
    </>
  );
}

export interface EventFlowModalProps {
  open: boolean;
  event: StoreMoveEvent | null;
  onClose: () => void;
  onJoin: (event: StoreMoveEvent) => boolean;
  onComplete: (event: StoreMoveEvent) => void;
  onMateRequest: (candidate: MateCandidate) => void;
}

/**
 * Store의 MoveEvent를 발표용 활동 흐름 데이터로 연결하는 앱 통합 어댑터입니다.
 * ActivityFlow는 독립적인 결과 데이터를 제공하고, 이 컴포넌트는 기존 store API를 유지합니다.
 */
export function EventFlowModal({
  open,
  event,
  onClose,
  onJoin,
  onComplete,
  onMateRequest,
}: EventFlowModalProps) {
  if (!event) return null;

  const spot = DEMO_SPOTS.find((candidate) => candidate.id === event.spotId);
  const activityEvent: ActivityEvent = {
    id: event.id,
    title: event.title,
    sport: event.sport,
    mode: event.mode,
    spotName: spot?.name ?? "공개 Move Spot",
    startsAt: event.startsAt,
    durationMinutes: event.durationMinutes,
    capacity: event.capacity,
    participantCount: event.participants,
    hostName: event.hostName,
    hostLevel: 4,
    skillLevel: event.skillLevel,
    beginnerFriendly: event.beginnerFriendly,
    deposit: event.deposit,
    description: event.description,
    equipment: event.equipment,
    distanceText: event.distanceLabel,
  };

  return (
    <ActivityFlow
      open={open}
      event={activityEvent}
      onClose={onClose}
      onReserve={() => onJoin(event)}
      onComplete={() => onComplete(event)}
      onMateRequest={onMateRequest}
    />
  );
}

export function CreateEventModal(props: CreateEventModalProps) {
  return (
    <AnimatePresence>
      {props.open && <CreateEventForm key={props.initialSpotName ?? "new-event"} {...props} />}
    </AnimatePresence>
  );
}

function CreateEventForm({
  onClose,
  onCreate,
  initialSpotName = "",
  availableCoin,
  coinBalance,
  spots = [],
}: CreateEventModalProps) {
  const usableCoin = availableCoin ?? coinBalance ?? 280;
  const [sport, setSport] = useState<SportType>("running");
  const [mode, setMode] = useState<EventMode>("casual");
  const [spotName, setSpotName] = useState(initialSpotName);
  const [startsAt, setStartsAt] = useState(getDefaultStartsAt);
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [capacity, setCapacity] = useState(6);
  const [beginnerFriendly, setBeginnerFriendly] = useState(true);
  const [hostCost, setHostCost] = useState(28);
  const [error, setError] = useState("");
  const titleId = useId();
  const spotListId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const validateTime = () => {
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return "시작 시간을 선택해 주세요.";
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    if (startHour < 6 || end.getDate() !== start.getDate() || endHour > 21) {
      return "대면 활동은 06:00~21:00 안에 끝나야 해요.";
    }
    return "";
  };

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!spotName.trim()) {
      setError("공개된 Move Spot을 입력해 주세요.");
      return;
    }
    const timeError = validateTime();
    if (timeError) {
      setError(timeError);
      return;
    }
    if (hostCost > usableCoin) {
      setError("보유한 Move Coin보다 개최 비용이 커요.");
      return;
    }

    onCreate({
      title: SPORT_META[sport].defaultTitle,
      sport,
      mode,
      spotName: spotName.trim(),
      startsAt: new Date(startsAt).toISOString(),
      durationMinutes,
      capacity,
      beginnerFriendly,
      hostCost,
      spotId: spots.find(
        (spot) => spot.name === spotName.trim() || spot.shortName === spotName.trim(),
      )?.id,
    });
    onClose();
  };

  return (
    <ModalFrame
      onClose={onClose}
      titleId={titleId}
      closeButtonRef={closeButtonRef}
      labelledBy={`${titleId}-visible`}
      zIndex="z-[110]"
    >
      <header className="shrink-0 border-b border-white/8 px-5 pb-4 pt-[max(env(safe-area-inset-top),24px)] pr-16">
        <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#b9ff57]">Create movement</p>
        <h3 id={`${titleId}-visible`} className="mt-1 text-2xl font-black tracking-[-0.04em]">새 Move Event</h3>
        <p className="mt-1 text-xs text-white/40">모은 Coin으로 새로운 움직임을 시작하세요.</p>
      </header>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
          <fieldset>
            <legend className="text-xs font-extrabold text-white/80">어떤 스포츠인가요?</legend>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {CREATE_SPORTS.map((value) => {
                const meta = SPORT_META[value];
                return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSport(value)}
                  aria-pressed={sport === value}
                  className={clsx(
                    "flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]",
                    sport === value ? "border-[#b9ff57]/40 bg-[#b9ff57]/10" : "border-white/8 bg-white/[.035] hover:bg-white/[.065]",
                  )}
                >
                  <span className="text-2xl">{meta.emoji}</span>
                  <span><span className="block text-xs font-extrabold">{meta.label}</span><span className="mt-0.5 block text-[9px] text-white/35">{meta.goalLabel}</span></span>
                  {sport === value && <CheckCircle2 className="ml-auto size-4 text-[#b9ff57]" />}
                </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-xs font-extrabold text-white/80">활동 방식</legend>
            <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-2xl bg-white/[.035] p-1.5">
              {(Object.entries(MODE_META) as [EventMode, { label: string; description: string }][]).map(([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={clsx(
                    "min-h-11 rounded-xl px-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]",
                    mode === value ? "bg-[#b9ff57] text-[#0b1b13] shadow-lg" : "text-white/45 hover:text-white/75",
                  )}
                  title={meta.description}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[10px] text-white/35">{MODE_META[mode].description}</p>
          </fieldset>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-extrabold text-white/80">Move Spot</span>
              <span className="relative mt-2 block">
                <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                <input
                  value={spotName}
                  list={spotListId}
                  onChange={(inputEvent) => { setSpotName(inputEvent.target.value); setError(""); }}
                  placeholder="예: 중앙공원 러닝 게이트"
                  required
                  className="min-h-13 w-full rounded-2xl border border-white/10 bg-white/[.045] py-3 pl-10 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#b9ff57]/50 focus:ring-2 focus:ring-[#b9ff57]/15"
                />
                <datalist id={spotListId}>
                  {spots.map((spot) => (
                    <option key={spot.id} value={spot.name}>
                      {spot.shortName}
                    </option>
                  ))}
                </datalist>
              </span>
              <span className="mt-1.5 block text-[10px] text-white/30">공개되고 검증된 Spot에서만 개최할 수 있어요.</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block">
                <span className="text-xs font-extrabold text-white/80">시작 시간</span>
                <span className="relative mt-2 block">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35" />
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(inputEvent) => { setStartsAt(inputEvent.target.value); setError(""); }}
                    required
                    className="min-h-13 w-full rounded-2xl border border-white/10 bg-white/[.045] py-3 pl-9 pr-2 text-[11px] font-semibold text-white [color-scheme:dark] outline-none focus:border-[#b9ff57]/50 focus:ring-2 focus:ring-[#b9ff57]/15"
                  />
                </span>
              </label>
              <label className="block">
                <span className="text-xs font-extrabold text-white/80">활동 시간</span>
                <select
                  value={durationMinutes}
                  onChange={(selectEvent) => { setDurationMinutes(Number(selectEvent.target.value)); setError(""); }}
                  className="mt-2 min-h-13 w-full rounded-2xl border border-white/10 bg-[#10211b] px-3 text-xs font-semibold text-white outline-none focus:border-[#b9ff57]/50 focus:ring-2 focus:ring-[#b9ff57]/15"
                >
                  {[20, 30, 40, 60, 90].map((minutes) => <option key={minutes} value={minutes}>{minutes}분</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            <div className="rounded-[20px] border border-white/8 bg-white/[.035] p-3.5">
              <p className="text-[10px] font-bold text-white/45">참가 인원</p>
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => setCapacity((value) => Math.max(2, value - 1))} aria-label="참가 인원 줄이기" className="grid size-8 place-items-center rounded-xl bg-white/8 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]"><Minus className="size-3.5" /></button>
                <span className="font-mono text-lg font-black">{capacity}<small className="ml-0.5 text-[10px] text-white/35">명</small></span>
                <button type="button" onClick={() => setCapacity((value) => Math.min(16, value + 1))} aria-label="참가 인원 늘리기" className="grid size-8 place-items-center rounded-xl bg-white/8 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9ff57]"><Plus className="size-3.5" /></button>
              </div>
            </div>
            <label className="rounded-[20px] border border-white/8 bg-white/[.035] p-3.5">
              <span className="text-[10px] font-bold text-white/45">개최 비용</span>
              <span className="relative mt-2.5 flex items-center">
                <Coins className="absolute left-2.5 size-3.5 text-amber-300" />
                <input
                  type="number"
                  min={10}
                  max={100}
                  step={1}
                  value={hostCost}
                  onChange={(inputEvent) => { setHostCost(Number(inputEvent.target.value)); setError(""); }}
                  aria-label="Move Coin 개최 비용"
                  className="min-h-9 w-full rounded-xl border border-white/8 bg-white/[.045] pl-8 pr-2 font-mono text-sm font-black outline-none focus:border-[#b9ff57]/50"
                />
              </span>
              <span className="mt-1.5 block text-[9px] text-white/30">보유 {usableCoin} Coin</span>
            </label>
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[20px] border border-white/8 bg-white/[.035] p-4">
            <input
              type="checkbox"
              checked={beginnerFriendly}
              onChange={(inputEvent) => setBeginnerFriendly(inputEvent.target.checked)}
              className="peer sr-only"
            />
            <span className="grid size-6 place-items-center rounded-lg border border-white/15 bg-white/5 text-transparent transition peer-checked:border-[#b9ff57] peer-checked:bg-[#b9ff57] peer-checked:text-[#0b1b13] peer-focus-visible:ring-2 peer-focus-visible:ring-[#b9ff57]"><Check className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-extrabold">초보자 환영</span><span className="mt-0.5 block text-[10px] text-white/35">실력보다 참여와 협력을 우선해요.</span></span>
            <span className="text-lg">🌱</span>
          </label>

          <NightPolicy />

          {error && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-red-300/15 bg-red-300/[.07] p-3 text-[11px] leading-4 text-red-100">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/8 bg-[#081410]/95 px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between text-[11px]"><span className="text-white/40">{SPORT_META[sport].label} · {MODE_META[mode].label} · {capacity}명</span><span className={clsx("font-bold", hostCost > usableCoin ? "text-red-300" : "text-amber-200")}>-{hostCost} Coin</span></div>
          <PrimaryButton type="submit" disabled={hostCost > usableCoin || !startsAt || !spotName.trim()}>
            <Radio className="size-4.5" /> Event 개최하기
          </PrimaryButton>
        </div>
      </form>
    </ModalFrame>
  );
}

export default ActivityFlow;
