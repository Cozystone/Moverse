"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  CircleCheckBig,
  Coins,
  Compass,
  ExternalLink,
  MapPinned,
  MoonStar,
  Plus,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  CalendarDots,
  ChatsCircle,
  Lightning,
  MapTrifold,
  Moon,
  PersonSimpleRun,
  Sun,
  UserCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEMO_SPOTS } from "@/data/demo-data";
import {
  SEOUL_DISCOVERY_STOPS,
  SEOUL_DISCOVERY_STOPS_META,
} from "@/data/seoul-stops";
import { useGpsTracker } from "@/hooks/use-gps-tracker";
import { useStreetMatchedRoute } from "@/hooks/use-street-matched-route";
import { useMoverseStore } from "@/store/use-moverse-store";
import { MODE_LABEL, SPORT_META, type MoveEvent, type MoveSpot } from "@/types/moverse";
import { Onboarding } from "./onboarding";
import { BumpOverlay } from "./bump-overlay";
import { MoverAvatar } from "./mover-avatar";
import { MyVerse } from "./my-verse";
import { CreateEventModal, EventFlowModal, type CreateEventInput } from "./activity-flow";
import { SocialPanel } from "./social-panel";
import { SportIcon } from "./sport-icon";
import type { WorldMapPerson, WorldMapViewport } from "./world-map";

const WorldMap = dynamic(() => import("./world-map").then((mod) => mod.WorldMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

const MAP_SPOTS: readonly MoveSpot[] = [...DEMO_SPOTS, ...SEOUL_DISCOVERY_STOPS];
const MAP_SPOT_BY_ID = new Map(MAP_SPOTS.map((spot) => [spot.id, spot] as const));

type MainTab = "map" | "activity" | "move" | "social" | "verse";

const SEOUL_WIDE_DISTANCE_KM = 12;

const DEMO_MAP_PEOPLE: readonly WorldMapPerson[] = [
  {
    id: "lumi",
    nickname: "LUMI",
    modelId: "lumi",
    longitude: 126.93375,
    latitude: 37.52718,
    visibility: "precise",
    status: "러닝 메이트 찾는 중",
    updatedAt: "방금",
    expiresAt: "21:00",
    accuracyMeters: 12,
    bearing: 24,
    moving: true,
  },
  {
    id: "dash",
    nickname: "DASH",
    modelId: "dash",
    longitude: 126.9391,
    latitude: 37.5237,
    visibility: "approximate",
    status: "주말 농구 가능",
    updatedAt: "3분 전",
    expiresAt: "20:30",
    accuracyMeters: 180,
    bearing: -38,
  },
  {
    id: "mint",
    nickname: "MINT",
    modelId: "mint",
    longitude: 126.9354,
    latitude: 37.5226,
    visibility: "precise",
    status: "한강 플로깅 중",
    updatedAt: "1분 전",
    expiresAt: "20:45",
    accuracyMeters: 18,
    bearing: 12,
    moving: true,
  },
] as const;

function distanceFromViewportCenterKm(
  center: WorldMapViewport["center"],
  spot: Pick<MoveSpot, "latitude" | "longitude">,
) {
  const [centerLongitude, centerLatitude] = center;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(spot.latitude - centerLatitude);
  const longitudeDelta = toRadians(spot.longitude - centerLongitude);
  const startLatitude = toRadians(centerLatitude);
  const endLatitude = toRadians(spot.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatKoreanStartLabel(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "시간 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function MoverseApp() {
  const store = useMoverseStore();
  const [activeTab, setActiveTab] = useState<MainTab>("map");
  const [selectedEvent, setSelectedEvent] = useState<MoveEvent | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<MoveSpot | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<WorldMapPerson | null>(null);
  const [eventFlowOpen, setEventFlowOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSpot, setCreateSpot] = useState<MoveSpot | null>(null);
  const [socialOpen, setSocialOpen] = useState(false);
  const [verseOpen, setVerseOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [moveActive, setMoveActive] = useState(false);
  const [bumpOpen, setBumpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isNightPreview, setIsNightPreview] = useState(false);
  const [mapViewport, setMapViewport] = useState<WorldMapViewport | null>(null);
  const gps = useGpsTracker();
  const streetRoute = useStreetMatchedRoute(
    gps.acceptedPoints,
    moveActive && !gps.isPaused,
  );
  const rawRecordedRoute = useMemo(
    () =>
      gps.acceptedPoints.map(
        (point) => [point.longitude, point.latitude] as [number, number],
      ),
    [gps.acceptedPoints],
  );
  const recordedRoute =
    streetRoute.coordinates.length >= 2 ? streetRoute.coordinates : rawRecordedRoute;
  const currentGpsPosition = rawRecordedRoute.at(-1);
  // Rewards and live stats always use filtered sensor distance. Map matching is
  // visualization-only so an upstream route correction can never mint energy.
  const measuredDistanceMeters = gps.acceptedDistanceMeters;

  useEffect(() => {
    // Persist middleware can finish before the first component subscription on a
    // brand-new browser profile. This explicit client boundary guarantees that
    // the app never remains on the hydration splash screen.
    useMoverseStore.setState({ hydrated: true });
  }, []);

  useEffect(() => {
    if (!moveActive) return;
    const message =
      gps.status === "permission-denied"
        ? "위치 권한이 필요해요. 브라우저 설정에서 Moverse 위치 접근을 허용해주세요."
        : gps.status === "unsupported"
          ? "이 브라우저에서는 GPS 기록을 지원하지 않아요."
          : gps.status === "error"
            ? (gps.error?.message ?? "GPS를 시작하지 못했어요. 잠시 후 다시 시도해주세요.")
            : null;
    if (!message) return;
    const timer = window.setTimeout(() => {
      setMoveActive(false);
      setToast(message);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [gps.error, gps.status, moveActive]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const joinedEvents = useMemo(
    () => store.events.filter((event) => store.joinedEventIds.includes(event.id)),
    [store.events, store.joinedEventIds],
  );

  const mapContext = useMemo(() => {
    if (!mapViewport) {
      return {
        areaName: MAP_SPOTS[0]?.areaName ?? "서울 전역",
        visibleSpotCount: MAP_SPOTS.length,
        visibleEventCount: store.events.length,
      };
    }

    const nearestSpot = MAP_SPOTS.reduce<{ distanceKm: number; spot: MoveSpot } | null>(
      (nearest, spot) => {
        const distanceKm = distanceFromViewportCenterKm(mapViewport.center, spot);
        return !nearest || distanceKm < nearest.distanceKm ? { distanceKm, spot } : nearest;
      },
      null,
    );

    return {
      areaName:
        mapViewport.zoom > 11.6 && nearestSpot && nearestSpot.distanceKm < SEOUL_WIDE_DISTANCE_KM
          ? nearestSpot.spot.areaName
          : "서울 전역",
      visibleSpotCount: mapViewport.visibleSpotIds.length,
      visibleEventCount: mapViewport.visibleEventIds.length,
    };
  }, [mapViewport, store.events.length]);

  const handleViewportChange = useCallback((viewport: WorldMapViewport) => {
    setMapViewport(viewport);
    setSelectedEvent((event) =>
      event && !viewport.visibleEventIds.includes(event.id) ? null : event,
    );
    setSelectedSpot((spot) =>
      spot && !viewport.visibleSpotIds.includes(spot.id) ? null : spot,
    );
    setSelectedPerson((person) =>
      person && !viewport.visiblePersonIds.includes(person.id) ? null : person,
    );
  }, []);

  if (!store.hydrated) {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <MapLoading />
        </div>
      </div>
    );
  }

  if (!store.hasOnboarded) return <Onboarding onComplete={store.finishOnboarding} />;

  const selectEvent = (event: MoveEvent) => {
    setSelectedEvent(event);
    setSelectedSpot(null);
    setSelectedPerson(null);
  };

  const openEvent = (event: MoveEvent) => {
    setSelectedEvent(event);
    setEventFlowOpen(true);
    setActivityOpen(false);
  };

  const handleTab = (tab: MainTab) => {
    if (tab === "move") {
      if (isNightPreview) {
        setToast("21:00 이후에는 대면 MOVE를 시작할 수 없고 다음 일정만 예약할 수 있어요.");
        setActiveTab("map");
        return;
      }
      if (!moveActive) {
        gps.reset();
        gps.start();
      }
      setSelectedEvent(null);
      setSelectedSpot(null);
      setMoveActive(true);
      setActiveTab("map");
      return;
    }

    setActiveTab(tab);
    if (tab === "activity") setActivityOpen(true);
    if (tab === "social") setSocialOpen(true);
    if (tab === "verse") setVerseOpen(true);
  };

  const openBump = () => {
    if (isNightPreview) {
      setToast("오늘 BUMP는 끝났어요. 내일 현장에서 다시 만나요.");
      return;
    }
    setSelectedEvent(null);
    setSelectedSpot(null);
    setSelectedPerson(null);
    setBumpOpen(true);
  };

  const handleComplete = (event: MoveEvent) => {
    store.completeEvent(event);
    setToast(`${event.title} 완료 · 무브 코인 ${event.rewardCoin}개를 받았어요!`);
  };

  const handleEventCreate = (draft: CreateEventInput) => {
    const sport = draft.sport;
    const selectedEventSpot = DEMO_SPOTS.find((spot) => spot.id === draft.spotId);
    if (!selectedEventSpot || !selectedEventSpot.verified || !selectedEventSpot.sports.includes(sport)) {
      setToast("종목과 위치가 확인된 스팟을 다시 선택해 주세요.");
      return;
    }
    if ((sport === "basketball" || sport === "football") && !selectedEventSpot.facility) {
      setToast("농구와 축구는 확인된 코트·구장에서만 열 수 있어요.");
      return;
    }
    if (selectedEventSpot.facility?.bookingRequired && !draft.reservationConfirmed) {
      setToast("구장 예약 완료를 확인한 뒤 활동을 열어 주세요.");
      return;
    }
    const event: MoveEvent = {
      id: `event-user-${Date.now()}`,
      spotId: selectedEventSpot.id,
      hostId: "nova",
      hostName: "NOVA",
      title: draft.title,
      description: "NOVA가 새롭게 연 활동이에요. 누구나 부담 없이 참가할 수 있어요.",
      sport,
      mode: draft.mode,
      skillLevel: "beginner",
      startLabel: formatKoreanStartLabel(draft.startsAt),
      startsAt: draft.startsAt,
      durationMinutes: draft.durationMinutes,
      capacity: draft.capacity,
      participants: 1,
      deposit: 10,
      hostCost: draft.hostCost,
      beginnerFriendly: draft.beginnerFriendly,
      equipment: ["편한 운동복"],
      distanceLabel: selectedEventSpot.distanceLabel,
      status: "scheduled",
      rewardCoin: 28,
      rewardXp: 150,
      reservationConfirmed: draft.reservationConfirmed,
    };
    store.addEvent(event);
    setSelectedEvent(event);
    setCreateOpen(false);
    setActiveTab("map");
    setToast("새로운 활동이 지도에 열렸어요!");
  };

  const selectedSpotEvents = selectedSpot ? store.events.filter((event) => event.spotId === selectedSpot.id) : [];

  return (
    <div className={`app-viewport ${isNightPreview ? "night-preview" : ""}`}>
      <div className={`app-frame ${moveActive ? "move-mode" : ""}`}>
        <WorldMap
          spots={MAP_SPOTS}
          events={store.events}
          people={DEMO_MAP_PEOPLE}
          user={{
            id: "nova",
            nickname: store.nickname,
            initials: store.nickname.slice(0, 1),
            modelId: "nova",
            level: store.level,
          }}
          selectedEventId={selectedEvent?.id ?? null}
          onSelectEvent={(mapEvent) => {
            const event = store.events.find((item) => item.id === mapEvent.id);
            if (event) selectEvent(event);
          }}
          onSelectSpot={(mapSpot) => {
            const spot = MAP_SPOT_BY_ID.get(mapSpot.id);
            if (spot) {
              setSelectedSpot(spot);
              setSelectedEvent(null);
              setSelectedPerson(null);
            }
          }}
          onSelectPerson={(person) => {
            setSelectedPerson(person);
            setSelectedEvent(null);
            setSelectedSpot(null);
          }}
          isNight={isNightPreview}
          recordedRoute={recordedRoute}
          userPosition={currentGpsPosition}
          isTracking={moveActive && !gps.isPaused}
          followUser
          gpsAccuracyMeters={gps.accuracyMeters}
          routeMatched={streetRoute.state === "matched"}
          showHud={false}
          onViewportChange={handleViewportChange}
        />

        <div className="map-top-gradient" />
        <header className="map-header">
          <div
            className="map-place-summary"
            aria-label={`현재 지역: ${mapContext.areaName}, 보이는 스팟 ${mapContext.visibleSpotCount}개, 이벤트 ${mapContext.visibleEventCount}개`}
          >
            <button
              type="button"
              className="map-profile-trigger"
              aria-label="NOVA 프로필 열기"
              onClick={() => {
                setVerseOpen(true);
                setActiveTab("verse");
              }}
            >
              <MoverAvatar
                avatarId="nova"
                size="xs"
                status={moveActive ? "moving" : "online"}
                ring="lime"
                framing="bust"
                preload
              />
            </button>
            <span>
              <strong>{mapContext.areaName}</strong>
              <small>
                화면 {mapContext.visibleSpotCount} · 서울 {SEOUL_DISCOVERY_STOPS_META.count.toLocaleString()} STOP · 이벤트 {mapContext.visibleEventCount}
              </small>
            </span>
          </div>
          <div className="resource-row">
            <button
              className="resource-chip energy"
              aria-label={`오늘의 Move Energy ${store.energy}/100`}
              title="Move Energy · 오늘 움직임"
              onClick={() => setToast(`Move Energy ${store.energy}/100 · 걷기와 활동으로 채우며 매일 갱신돼요.`)}
            >
              <Lightning size={17} weight="fill" />
              <strong>{store.energy}</strong>
            </button>
            <button
              className="resource-chip day-status"
              aria-label={isNightPreview ? "야간 모드 해제" : "21시 활동 종료 안내"}
              title="대면 활동 운영 시간"
              onClick={() => setIsNightPreview((value) => !value)}
            >
              {isNightPreview ? <Moon size={17} weight="fill" /> : <Sun size={17} weight="fill" />}
            </button>
          </div>
        </header>

        {!selectedEvent && !selectedSpot && !selectedPerson && !moveActive && !isNightPreview ? (
          <button className="bump-fab" onClick={openBump} aria-label="BUMP 현장 인증 열기">
            <Image src="/moverse-bump-orb.png" width={58} height={58} alt="" priority />
            <span><strong>BUMP</strong><small>현장 인증</small></span>
          </button>
        ) : null}

        <AnimatePresence>
          {moveActive && (
            <MoveSession
              activeDurationMs={gps.activeDurationMs}
              distanceMeters={measuredDistanceMeters}
              paceMinutesPerKm={gps.paceMinutesPerKm}
              accuracyMeters={gps.accuracyMeters}
              status={gps.status}
              mapMatchState={streetRoute.state}
              paused={gps.isPaused}
              onPause={() => {
                if (gps.isPaused) gps.resume();
                else gps.pause();
              }}
              onFinish={() => {
                gps.stop();
                setMoveActive(false);
                const reward = Math.min(30, Math.floor(measuredDistanceMeters / 100));
                if (reward > 0) store.addEnergy(reward);
                setToast(
                  `${(measuredDistanceMeters / 1000).toFixed(2)}km 기록 · 거리 보상 Energy +${reward}`,
                );
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedEvent && !eventFlowOpen && !moveActive && (
            <EventPreviewCard event={selectedEvent} joined={store.joinedEventIds.includes(selectedEvent.id)} onClose={() => setSelectedEvent(null)} onOpen={() => openEvent(selectedEvent)} />
          )}
          {selectedSpot && !moveActive && (
            <SpotPreviewCard
              spot={selectedSpot}
              events={selectedSpotEvents}
              onClose={() => setSelectedSpot(null)}
              onEvent={openEvent}
              onCreate={(spot) => {
                setCreateSpot(spot);
                setCreateOpen(true);
                setSelectedSpot(null);
              }}
              onDiscovery={(spot) => {
                setToast(`${spot.name}은 현장 40m 안에서 체크인할 수 있어요.`);
              }}
            />
          )}
          {selectedPerson && !moveActive && (
            <PersonPreviewCard
              person={selectedPerson}
              onClose={() => setSelectedPerson(null)}
              onMessage={() => {
                setSelectedPerson(null);
                setSocialOpen(true);
                setActiveTab("social");
              }}
            />
          )}
        </AnimatePresence>

        {isNightPreview && !selectedEvent && !selectedSpot && !selectedPerson && !moveActive && (
          <motion.div className="night-message" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <span><MoonStar /></span><div><strong>오늘의 활동 스팟은 쉬는 중</strong><p>지금은 내일 참여할 활동을 예약할 수 있어요.</p></div>
            <button onClick={() => setActivityOpen(true)}>일정 보기</button>
          </motion.div>
        )}

        <BottomNav active={activeTab} energy={store.energy} onSelect={handleTab} />

        <AnimatePresence>
          {activityOpen && (
            <ActivityPanel
              joined={joinedEvents}
              allEvents={store.events}
              onClose={() => { setActivityOpen(false); setActiveTab("map"); }}
              onEvent={openEvent}
              onCreate={() => {
                setActivityOpen(false);
                setCreateSpot(null);
                setCreateOpen(true);
                setActiveTab("map");
              }}
            />
          )}
          {verseOpen && (
            <MyVerse
              open={verseOpen}
              onClose={() => { setVerseOpen(false); setActiveTab("map"); }}
              level={store.level}
              xp={store.xp}
              coin={store.coin}
              rhythm={store.rhythm}
              activities={store.activities}
              onReset={() => { store.resetDemo(); setVerseOpen(false); setActiveTab("map"); setToast("데모가 처음 상태로 돌아갔어요."); }}
            />
          )}
        </AnimatePresence>

        <EventFlowModal
          open={eventFlowOpen}
          event={selectedEvent}
          onClose={() => setEventFlowOpen(false)}
          onJoin={(event) => {
            const ok = store.joinEvent(event.id, event.deposit);
            if (!ok) setToast("예약 보증금에 필요한 Coin이 부족해요.");
            return ok;
          }}
          onComplete={handleComplete}
          onMateRequest={() => setToast("LUMI에게 Move Mate 요청을 보냈어요!")}
        />

        <CreateEventModal
          open={createOpen}
          onClose={() => { setCreateOpen(false); setCreateSpot(null); setActiveTab("map"); }}
          onCreate={handleEventCreate}
          availableCoin={store.coin}
          spots={DEMO_SPOTS}
          initialSpotName={createSpot?.name ?? DEMO_SPOTS[0].name}
          initialSport={createSpot?.sports[0]}
        />

        <SocialPanel
          open={socialOpen}
          onClose={() => { setSocialOpen(false); setActiveTab("map"); }}
          currentUserName="NOVA"
          onBump={() => {
            setSocialOpen(false);
            setActiveTab("map");
            openBump();
          }}
          onScheduleCreated={() => setToast("다음 Move 일정이 두 사람의 캘린더에 저장됐어요!")}
        />

        <BumpOverlay
          open={bumpOpen}
          onClose={() => setBumpOpen(false)}
          onComplete={() => setToast("LUMI와 현장 확인 완료 · 활동을 시작할 수 있어요.")}
          onQrFallback={() => {
            setBumpOpen(false);
            setToast("동적 QR 확인으로 전환했어요.");
          }}
        />

        <AnimatePresence>
          {toast && <motion.div className="toast" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}><CircleCheckBig size={17} />{toast}</motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BottomNav({ active, energy, onSelect }: { active: MainTab; energy: number; onSelect: (tab: MainTab) => void }) {
  const items: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "map", label: "지도", icon: <MapTrifold weight="bold" /> },
    { key: "activity", label: "활동", icon: <CalendarDots weight="bold" /> },
    { key: "move", label: "MOVE", icon: <PersonSimpleRun weight="fill" /> },
    { key: "social", label: "메이트", icon: <ChatsCircle weight="bold" /> },
    { key: "verse", label: "성장", icon: <UserCircle weight="bold" /> },
  ];
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => (
        <button
          key={item.key}
          className={`${active === item.key ? "active" : ""} ${item.key === "move" ? "move-nav" : ""}`}
          aria-label={item.key === "move" ? `MOVE 시작, 오늘 에너지 ${energy}/100` : item.label}
          aria-current={active === item.key ? "page" : undefined}
          onClick={() => onSelect(item.key)}
        >
          <span>{item.icon}{item.key === "move" && <b>{energy}</b>}</span><small>{item.label}</small>
        </button>
      ))}
    </nav>
  );
}

function EventPreviewCard({ event, joined, onClose, onOpen }: { event: MoveEvent; joined: boolean; onClose: () => void; onOpen: () => void }) {
  const sport = SPORT_META[event.sport];
  return (
    <motion.article className="map-preview-card" initial={{ y: 45, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 35, opacity: 0 }}>
      <button className="preview-close" onClick={onClose} aria-label="닫기"><X size={17} /></button>
      <div className="event-preview-top">
        <span className="sport-orb" style={{ "--sport-color": sport.color, "--sport-soft": sport.soft } as React.CSSProperties}><SportIcon sport={event.sport} size={26} /></span>
        <div><div className="event-badges"><b>{MODE_LABEL[event.mode]}</b>{event.reservationConfirmed ? <i>구장 예약 완료</i> : event.beginnerFriendly && <i>초보자 환영</i>}</div><h3>{event.title}</h3><p>{event.startLabel} · {event.durationMinutes}분</p></div>
      </div>
      <div className="event-preview-meta">
        <span><Users size={15} /> {event.participants}/{event.capacity}명</span>
        <span><Compass size={15} /> {event.distanceLabel}</span>
        <span><Coins size={15} /> +{event.rewardCoin}</span>
      </div>
      <button className="card-primary" onClick={onOpen}>{joined ? "체크인" : "참가하기"}<ChevronRight size={18} /></button>
    </motion.article>
  );
}

const FACILITY_LABEL = {
  "basketball-court": "공공 농구장",
  "football-field": "축구장",
  "futsal-court": "풋살장",
  "badminton-court": "배드민턴장",
  "running-track": "러닝 트랙",
  "multi-use-court": "다목적 구장",
} as const;

function PersonPreviewCard({
  person,
  onClose,
  onMessage,
}: {
  person: WorldMapPerson;
  onClose: () => void;
  onMessage: () => void;
}) {
  const isApproximate = person.visibility === "approximate";

  return (
    <motion.article
      className="map-preview-card person-preview-card"
      initial={{ y: 45, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 35, opacity: 0 }}
    >
      <button className="preview-close" onClick={onClose} aria-label="닫기">
        <X size={17} />
      </button>
      <div className="person-preview-main">
        <MoverAvatar
          avatarId={person.modelId}
          size="lg"
          status={person.moving ? "moving" : "online"}
          ring="accent"
          framing="bust"
        />
        <div>
          <small>서로 연결된 MOVE MATE</small>
          <h3>{person.nickname}</h3>
          <p>{person.status ?? "다음 활동을 찾는 중"}</p>
          <span className={isApproximate ? "is-approximate" : undefined}>
            <ShieldCheck size={13} />
            {isApproximate ? `대략 위치 · 반경 ${person.accuracyMeters ?? 150}m` : "정밀 위치 공유 중"}
          </span>
        </div>
      </div>
      <div className="person-preview-meta">
        <span><strong>{person.updatedAt ?? "방금"}</strong><small>마지막 갱신</small></span>
        <span><strong>{person.expiresAt ?? "21:00"}</strong><small>공유 자동 종료</small></span>
      </div>
      <button className="card-primary" onClick={onMessage}>
        다음 일정 잡기 <ChevronRight size={18} />
      </button>
    </motion.article>
  );
}

function SpotPreviewCard({
  spot,
  events,
  onClose,
  onEvent,
  onCreate,
  onDiscovery,
}: {
  spot: MoveSpot;
  events: MoveEvent[];
  onClose: () => void;
  onEvent: (event: MoveEvent) => void;
  onCreate: (spot: MoveSpot) => void;
  onDiscovery: (spot: MoveSpot) => void;
}) {
  const isDiscovery = spot.kind === "discovery" || spot.eventEligible === false;

  return (
    <motion.article className="map-preview-card spot-card" initial={{ y: 45, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 35, opacity: 0 }}>
      <button className="preview-close" onClick={onClose} aria-label="닫기"><X size={17} /></button>
      <div className="spot-heading"><span className={`spot-level-icon ${spot.level}`}><MapPinned size={23} /></span><div><small>{isDiscovery ? "서울 공개 지도 STOP" : `인증 스팟 · Lv.${spot.levelNumber}`}</small><h3>{spot.name}</h3><p>{spot.description}</p></div></div>
      {spot.facility ? (
        <div className="spot-facility">
          <CircleCheckBig size={17} />
          <span>
            <strong>{FACILITY_LABEL[spot.facility.type]}</strong>
            <small>{spot.facility.accessLabel}</small>
          </span>
          <a href={spot.facility.officialUrl} target="_blank" rel="noreferrer" aria-label={`${spot.name} 서울시 공식 정보 열기`}>
            공식 정보 <ExternalLink size={13} />
          </a>
        </div>
      ) : null}
      {isDiscovery && spot.source ? (
        <a className="spot-source-link" href={spot.source.url} target="_blank" rel="noreferrer">
          서울시 출입구 데이터 · {spot.source.referenceDate} <ExternalLink size={13} />
        </a>
      ) : null}
      <div className="spot-energy"><div><span>스팟 활성도</span><b>{Math.round((spot.energy / spot.energyGoal) * 100)}%</b></div><i><em style={{ width: `${(spot.energy / spot.energyGoal) * 100}%` }} /></i></div>
      {events.length ? <button className="card-primary" onClick={() => onEvent(events[0])}>{events[0].title}<ChevronRight size={18} /></button> : null}
      {isDiscovery ? (
        <button className="card-secondary spot-create-button" onClick={() => onDiscovery(spot)}>
          <MapPinned size={17} /> 현장 40m 안에서 체크인
        </button>
      ) : (
        <button className="card-secondary spot-create-button" onClick={() => onCreate(spot)}><Plus size={17} /> 이곳에서 활동 열기</button>
      )}
    </motion.article>
  );
}

function formatMoveTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

function formatPace(paceMinutesPerKm: number | null) {
  if (!paceMinutesPerKm || !Number.isFinite(paceMinutesPerKm)) return "--'--\"";
  const totalSeconds = Math.round(paceMinutesPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}'${seconds}\"`;
}

function MoveSession({
  activeDurationMs,
  distanceMeters,
  paceMinutesPerKm,
  accuracyMeters,
  status,
  mapMatchState,
  paused,
  onPause,
  onFinish,
}: {
  activeDurationMs: number;
  distanceMeters: number;
  paceMinutesPerKm: number | null;
  accuracyMeters: number | null;
  status: string;
  mapMatchState: string;
  paused: boolean;
  onPause: () => void;
  onFinish: () => void;
}) {
  const distanceKm = distanceMeters / 1000;
  const reward = Math.min(30, Math.floor(distanceMeters / 100));
  const gpsLabel =
    status === "requesting-permission"
      ? "GPS 권한 확인 중"
      : status === "weak-signal"
        ? "GPS 신호 보정 중"
        : paused
          ? "기록 일시정지"
          : "고정밀 거리 기록 중";
  const routeLabel =
    mapMatchState === "matched"
      ? "경로 보정됨"
      : mapMatchState === "matching"
        ? "경로 보정 중"
        : "실시간 GPS";
  const canPause = !["requesting-permission", "idle"].includes(status);

  return (
    <motion.div className="move-session" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
      <div className={`move-live ${status === "weak-signal" ? "is-weak" : ""}`}><i /> {gpsLabel}</div>
      <div className="move-metrics">
        <div className="move-distance"><small>GPS 거리</small><strong>{distanceKm.toFixed(2)}<em>km</em></strong></div>
        <div><small>평균 페이스</small><strong>{formatPace(paceMinutesPerKm)}<em>/km</em></strong></div>
        <div><small>활동 시간</small><strong>{formatMoveTime(activeDurationMs)}</strong></div>
      </div>
      <div className="move-destination">
        <span><SportIcon sport="running" size={21} /></span>
        <p><small>{routeLabel}</small><strong>{accuracyMeters ? `정확도 ±${Math.round(accuracyMeters)}m` : "GPS 정확도 측정 중"}</strong></p>
        <b>+{reward} E</b>
      </div>
      <div className="move-actions"><button onClick={onPause} disabled={!canPause}>{paused ? "기록 계속" : "일시정지"}</button><button onClick={onFinish}>MOVE 종료</button></div>
    </motion.div>
  );
}

function ActivityPanel({ joined, allEvents, onClose, onEvent, onCreate }: { joined: MoveEvent[]; allEvents: MoveEvent[]; onClose: () => void; onEvent: (event: MoveEvent) => void; onCreate: () => void }) {
  const events = joined.length ? joined : allEvents.slice(0, 3);
  return (
    <motion.section className="full-panel activity-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}>
      <header className="panel-header">
        <div><small>MOVE PLAN</small><h2>활동</h2></div>
        <div className="panel-header-actions">
          <button className="panel-create-button" onClick={onCreate}><Plus size={16} /> 활동 열기</button>
          <button className="round-icon-btn" onClick={onClose} aria-label="활동 화면 닫기"><X /></button>
        </div>
      </header>
      <div className="panel-scroll activity-content">
        <section className="next-activity-hero">
          <div className="next-label"><i /> 다음 활동</div>
          <span className="hero-sport"><SportIcon sport="running" size={48} /></span>
          <div><small>오늘 19:40 · 러닝 게이트</small><h3>선셋 20분<br />런앤워크</h3><p>시작까지 <strong>42분</strong></p></div>
          <button onClick={() => onEvent(allEvents[0])}>체크인 <ChevronRight /></button>
        </section>
        <div className="weekly-rhythm-mini"><div><span><Zap fill="currentColor" /> 주간 목표</span><strong>2/3</strong></div><div className="mini-progress"><i style={{ width: "67%" }} /></div></div>
        <section className="activity-section">
          <div className="section-row"><h3>참가 예정</h3><span>{events.length}개</span></div>
          <div className="event-list">
            {events.map((event) => {
              const meta = SPORT_META[event.sport];
              return <button key={event.id} className="event-list-card" onClick={() => onEvent(event)}><span style={{ background: meta.soft }}><SportIcon sport={event.sport} size={21} /></span><div><small>{event.startLabel} · {event.distanceLabel}</small><strong>{event.title}</strong><p>{MODE_LABEL[event.mode]} · {event.participants}/{event.capacity}명</p></div><ChevronRight /></button>;
            })}
          </div>
        </section>
        <section className="safety-banner"><ShieldCheck /><div><strong>위치는 체크인 전 비공개</strong></div></section>
      </div>
    </motion.section>
  );
}

function MapLoading() {
  return <div className="map-loading"><div className="loading-grid" /><div className="loading-pulse" /><p>주변 활동 지도를 불러오는 중</p></div>;
}
