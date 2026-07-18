"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ChevronRight,
  CircleCheckBig,
  CircleUserRound,
  Coins,
  Compass,
  Footprints,
  Map,
  MapPinned,
  MessageCircle,
  MoonStar,
  Plus,
  ShieldCheck,
  SunMedium,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_SPOTS } from "@/data/demo-data";
import { useMoverseStore } from "@/store/use-moverse-store";
import { MODE_LABEL, SPORT_META, type MoveEvent, type MoveSpot } from "@/types/moverse";
import { Onboarding } from "./onboarding";
import { MyVerse } from "./my-verse";
import { CreateEventModal, EventFlowModal, type CreateEventInput } from "./activity-flow";
import { SocialPanel } from "./social-panel";
import { SportIcon } from "./sport-icon";

const WorldMap = dynamic(() => import("./world-map").then((mod) => mod.WorldMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

type MainTab = "map" | "activity" | "move" | "social" | "verse";

export function MoverseApp() {
  const store = useMoverseStore();
  const [activeTab, setActiveTab] = useState<MainTab>("map");
  const [selectedEvent, setSelectedEvent] = useState<MoveEvent | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<MoveSpot | null>(null);
  const [eventFlowOpen, setEventFlowOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [verseOpen, setVerseOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [moveActive, setMoveActive] = useState(false);
  const [movePaused, setMovePaused] = useState(false);
  const [moveSeconds, setMoveSeconds] = useState(0);
  const [moveProgress, setMoveProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [isNightPreview, setIsNightPreview] = useState(false);
  const energyMilestoneRef = useRef(0);

  useEffect(() => {
    // Persist middleware can finish before the first component subscription on a
    // brand-new browser profile. This explicit client boundary guarantees that
    // the app never remains on the hydration splash screen.
    useMoverseStore.setState({ hydrated: true });
  }, []);

  useEffect(() => {
    if (!moveActive || movePaused) return;
    const timer = window.setInterval(() => {
      setMoveSeconds((value) => value + 6);
      setMoveProgress((value) => Math.min(100, value + 1.8));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [moveActive, movePaused]);

  useEffect(() => {
    if (!moveActive) return;
    const milestone = Math.floor(moveProgress / 18);
    if (milestone <= energyMilestoneRef.current) return;
    store.addEnergy((milestone - energyMilestoneRef.current) * 2);
    energyMilestoneRef.current = milestone;
  }, [moveActive, moveProgress, store]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const joinedEvents = useMemo(
    () => store.events.filter((event) => store.joinedEventIds.includes(event.id)),
    [store.events, store.joinedEventIds],
  );

  if (!store.hasOnboarded) return <Onboarding onComplete={store.finishOnboarding} />;

  const selectEvent = (event: MoveEvent) => {
    setSelectedEvent(event);
    setSelectedSpot(null);
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
        energyMilestoneRef.current = 0;
        setMoveSeconds(0);
        setMoveProgress(0);
      }
      setSelectedEvent(null);
      setSelectedSpot(null);
      setMoveActive(true);
      setMovePaused(false);
      setActiveTab("map");
      return;
    }

    setActiveTab(tab);
    if (tab === "activity") setActivityOpen(true);
    if (tab === "social") setSocialOpen(true);
    if (tab === "verse") setVerseOpen(true);
  };

  const handleComplete = (event: MoveEvent) => {
    store.completeEvent(event);
    setToast(`${event.title} 완료 · 무브 코인 ${event.rewardCoin}개를 받았어요!`);
  };

  const handleEventCreate = (draft: CreateEventInput) => {
    const sport = draft.sport;
    const selectedEventSpot = DEMO_SPOTS.find((spot) => spot.name === draft.spotName) ?? DEMO_SPOTS[0];
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
      startLabel: "내일 " + (draft.startsAt.split("T")[1]?.slice(0, 5) || "18:00"),
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
      <div className="app-frame">
        <WorldMap
          spots={DEMO_SPOTS}
          events={store.events}
          selectedEventId={selectedEvent?.id ?? null}
          onSelectEvent={(mapEvent) => {
            const event = store.events.find((item) => item.id === mapEvent.id);
            if (event) selectEvent(event);
          }}
          onSelectSpot={(mapSpot) => {
            const spot = DEMO_SPOTS.find((item) => item.id === mapSpot.id);
            if (spot) { setSelectedSpot(spot); setSelectedEvent(null); }
          }}
          isNight={isNightPreview}
          movingProgress={moveProgress}
          showHud={false}
        />

        <div className="map-top-gradient" />
        <header className="map-header">
          <div className="brand-chip"><span className="brand-orbit small">M</span><strong>MOVERSE</strong></div>
          <div className="resource-row">
            <button
              className="resource-chip energy"
              aria-label={`오늘의 Move Energy ${store.energy}/100`}
              title="Move Energy · 오늘 움직임"
              onClick={() => setToast(`Move Energy ${store.energy}/100 · 걷기와 활동으로 채우며 매일 갱신돼요.`)}
            >
              <Zap size={14} fill="currentColor" />
              <span className="resource-copy"><small>오늘</small><strong>{store.energy}/100</strong></span>
            </button>
            <button
              className="resource-chip coin"
              aria-label={`Move Coin ${store.coin} C`}
              title="Move Coin · 활동 보상"
              onClick={() => setToast(`Move Coin ${store.coin} C · 활동 개설과 참가 보증금에 사용해요.`)}
            >
              <Coins size={14} />
              <span className="resource-copy"><small>코인</small><strong>{store.coin} C</strong></span>
            </button>
          </div>
        </header>

        <div className="map-context-bar">
          <div className="map-context-place" aria-label="현재 지역: 여의도 한강공원">
            <MapPinned size={17} />
            <span><strong>여의도 한강공원</strong><small>주변 활동 {store.events.length}</small></span>
          </div>
          <button className="close-time-button" onClick={() => setIsNightPreview((value) => !value)}>
            {isNightPreview ? <MoonStar size={15} /> : <SunMedium size={15} />}
            <span>{isNightPreview ? "오늘 종료" : "21:00 종료"}</span>
          </button>
        </div>

        <AnimatePresence>
          {moveActive && (
            <MoveSession
              seconds={moveSeconds}
              progress={moveProgress}
              paused={movePaused}
              onPause={() => setMovePaused((value) => !value)}
              onFinish={() => {
                setMoveActive(false);
                setMovePaused(false);
                setToast(`${(moveProgress * 0.014).toFixed(1)}km 이동 · Energy ${Math.max(4, Math.floor(moveProgress / 9))} 획득!`);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedEvent && !eventFlowOpen && !moveActive && (
            <EventPreviewCard event={selectedEvent} joined={store.joinedEventIds.includes(selectedEvent.id)} onClose={() => setSelectedEvent(null)} onOpen={() => openEvent(selectedEvent)} />
          )}
          {selectedSpot && !moveActive && (
            <SpotPreviewCard spot={selectedSpot} events={selectedSpotEvents} onClose={() => setSelectedSpot(null)} onEvent={openEvent} />
          )}
        </AnimatePresence>

        {isNightPreview && !selectedEvent && !selectedSpot && !moveActive && (
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
          onClose={() => { setCreateOpen(false); setActiveTab("map"); }}
          onCreate={handleEventCreate}
          availableCoin={store.coin}
          initialSpotName="리버사이드 러닝 게이트"
        />

        <SocialPanel
          open={socialOpen}
          onClose={() => { setSocialOpen(false); setActiveTab("map"); }}
          currentUserName="NOVA"
          onScheduleCreated={() => setToast("다음 Move 일정이 두 사람의 캘린더에 저장됐어요!")}
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
    { key: "map", label: "지도", icon: <Map /> },
    { key: "activity", label: "활동", icon: <CalendarDays /> },
    { key: "move", label: "MOVE", icon: <Footprints /> },
    { key: "social", label: "메이트", icon: <MessageCircle /> },
    { key: "verse", label: "성장", icon: <CircleUserRound /> },
  ];
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => (
        <button
          key={item.key}
          className={`${active === item.key ? "active" : ""} ${item.key === "move" ? "move-nav" : ""}`}
          aria-label={item.key === "move" ? `MOVE 시작, 오늘 에너지 ${energy}/100` : item.label}
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
        <div><div className="event-badges"><b>{MODE_LABEL[event.mode]}</b>{event.beginnerFriendly && <i>초보자 환영</i>}</div><h3>{event.title}</h3><p>{event.startLabel} · {event.durationMinutes}분</p></div>
      </div>
      <div className="event-preview-meta">
        <span><Users size={15} /> {event.participants}/{event.capacity}명</span>
        <span><Compass size={15} /> {event.distanceLabel}</span>
        <span><Coins size={15} /> +{event.rewardCoin}</span>
      </div>
      <button className="card-primary" onClick={onOpen}>{joined ? "체크인 준비하기" : "자세히 보고 참가하기"}<ChevronRight size={18} /></button>
    </motion.article>
  );
}

function SpotPreviewCard({ spot, events, onClose, onEvent }: { spot: MoveSpot; events: MoveEvent[]; onClose: () => void; onEvent: (event: MoveEvent) => void }) {
  return (
    <motion.article className="map-preview-card spot-card" initial={{ y: 45, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 35, opacity: 0 }}>
      <button className="preview-close" onClick={onClose} aria-label="닫기"><X size={17} /></button>
      <div className="spot-heading"><span className={`spot-level-icon ${spot.level}`}><MapPinned size={23} /></span><div><small>인증 스팟 · 레벨 {spot.levelNumber}</small><h3>{spot.name}</h3><p>{spot.description}</p></div></div>
      <div className="spot-energy"><div><span>스팟 활성도</span><b>{Math.round((spot.energy / spot.energyGoal) * 100)}%</b></div><i><em style={{ width: `${(spot.energy / spot.energyGoal) * 100}%` }} /></i></div>
      {events.length ? <button className="card-primary" onClick={() => onEvent(events[0])}>{events[0].title}<ChevronRight size={18} /></button> : <button className="card-secondary"><Plus size={17} /> 이곳에서 활동 열기</button>}
    </motion.article>
  );
}

function MoveSession({ seconds, progress, paused, onPause, onFinish }: { seconds: number; progress: number; paused: boolean; onPause: () => void; onFinish: () => void }) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return (
    <motion.div className="move-session" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}>
      <div className="move-live"><i /> 이동 기록 중</div>
      <div className="move-metrics">
        <div><small>시간</small><strong>{mins}:{secs}</strong></div>
        <div><small>거리</small><strong>{(progress * 0.014).toFixed(2)}<em>km</em></strong></div>
        <div><small>에너지</small><strong className="lime-number">+{Math.max(2, Math.floor(progress / 9))}</strong></div>
      </div>
      <div className="move-destination"><span><SportIcon sport="running" size={21} /></span><p><small>추천 경로</small><strong>러닝 게이트까지 {Math.max(0.1, 0.62 - progress * 0.006).toFixed(1)}km</strong></p><b>{Math.round(progress)}%</b></div>
      <div className="move-actions"><button onClick={onPause}>{paused ? "다시 움직이기" : "잠시 멈춤"}</button><button onClick={onFinish}>활동 종료</button></div>
    </motion.div>
  );
}

function ActivityPanel({ joined, allEvents, onClose, onEvent, onCreate }: { joined: MoveEvent[]; allEvents: MoveEvent[]; onClose: () => void; onEvent: (event: MoveEvent) => void; onCreate: () => void }) {
  const events = joined.length ? joined : allEvents.slice(0, 3);
  return (
    <motion.section className="full-panel activity-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}>
      <header className="panel-header">
        <div><small>참가 예정과 활동 기록</small><h2>활동</h2></div>
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
          <button onClick={() => onEvent(allEvents[0])}>체크인 준비 <ChevronRight /></button>
        </section>
        <div className="weekly-rhythm-mini"><div><span><Zap fill="currentColor" /> 주간 활동 목표</span><strong>이번 주 2/3</strong></div><div className="mini-progress"><i style={{ width: "67%" }} /></div><p>한 번 더 움직이면 이번 주 목표를 달성해요.</p></div>
        <section className="activity-section">
          <div className="section-row"><h3>참가 예정</h3><span>{events.length}개</span></div>
          <div className="event-list">
            {events.map((event) => {
              const meta = SPORT_META[event.sport];
              return <button key={event.id} className="event-list-card" onClick={() => onEvent(event)}><span style={{ background: meta.soft }}><SportIcon sport={event.sport} size={21} /></span><div><small>{event.startLabel} · {event.distanceLabel}</small><strong>{event.title}</strong><p>{MODE_LABEL[event.mode]} · {event.participants}/{event.capacity}명</p></div><ChevronRight /></button>;
            })}
          </div>
        </section>
        <section className="safety-banner"><ShieldCheck /><div><strong>정확한 위치는 현장 인증 전까지 비공개</strong><p>모든 만남은 인증된 활동 스팟에서 시작돼요.</p></div></section>
      </div>
    </motion.section>
  );
}

function MapLoading() {
  return <div className="map-loading"><div className="loading-grid" /><div className="loading-pulse" /><p>주변 활동 지도를 불러오는 중</p></div>;
}
