"use client";

import { motion } from "framer-motion";
import { Award, ChevronRight, Flame, Footprints, Sparkles, Users, X } from "lucide-react";
import type { ActivityRecord } from "@/types/moverse";

type MyVerseProps = {
  open: boolean;
  onClose: () => void;
  level: number;
  xp: number;
  coin: number;
  rhythm: number;
  activities: ActivityRecord[];
  onReset: () => void;
};

export function MyVerse({ open, onClose, level, xp, coin, rhythm, activities, onReset }: MyVerseProps) {
  if (!open) return null;
  const levelProgress = Math.min(100, ((xp % 300) / 300) * 100);

  return (
    <motion.section className="full-panel verse-panel" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}>
      <header className="panel-header overlay-header">
        <div><small>나의 움직임이 만든 세계</small><h2>My Verse</h2></div>
        <button className="round-icon-btn glass" onClick={onClose} aria-label="My Verse 닫기"><X size={21} /></button>
      </header>

      <div className="verse-hero">
        <div className="verse-stars"><i /><i /><i /><i /><i /></div>
        <div className="verse-planet" aria-label="활동으로 성장한 나의 행성">
          <div className="planet-atmosphere" />
          <div className="planet-land land-one" />
          <div className="planet-land land-two" />
          <div className="planet-path" />
          <div className="planet-tree tree-a">♣</div>
          <div className="planet-tree tree-b">♣</div>
          <div className="planet-building">▥</div>
          <div className="planet-runner">🏃</div>
        </div>
        <div className="level-orbit"><span>LV.{level}</span></div>
        <div className="verse-title"><strong>새싹길이 열린 NOVA</strong><span>다음 성장까지 {300 - (xp % 300)} XP</span></div>
        <div className="verse-progress"><motion.i initial={{ width: 0 }} animate={{ width: `${levelProgress}%` }} /></div>
      </div>

      <div className="panel-scroll verse-content">
        <div className="verse-stats">
          <div><span className="stat-icon lime"><Footprints /></span><strong>12.8km</strong><small>함께 이동</small></div>
          <div><span className="stat-icon violet"><Users /></span><strong>6명</strong><small>만난 무버</small></div>
          <div><span className="stat-icon orange"><Flame /></span><strong>{rhythm}/3</strong><small>이번 주 리듬</small></div>
        </div>

        <section className="verse-card rhythm-card">
          <div className="section-row"><div><small>MOVE RHYTHM</small><h3>이번 주, 한 번만 더</h3></div><span>{rhythm}/3</span></div>
          <div className="rhythm-days">
            {["월", "화", "수", "목", "금", "토", "일"].map((day, index) => (
              <div key={day} className={index === 1 || index === 3 || (rhythm >= 3 && index === 5) ? "done" : index === 5 ? "next" : ""}>
                <i>{index === 1 || index === 3 || (rhythm >= 3 && index === 5) ? <CheckMark /> : day}</i><small>{day}</small>
              </div>
            ))}
          </div>
          <p><Sparkles size={15} /> 한 번 더 움직이면 행성에 <strong>빛의 러닝 트랙</strong>이 생겨요.</p>
        </section>

        <section className="verse-section">
          <div className="section-row"><h3>최근 움직임</h3><button>전체 보기 <ChevronRight size={16} /></button></div>
          <div className="activity-list">
            {(activities.length ? activities : [
              { id: "a1", eventId: "demo", title: "리버사이드 런앤워크", sport: "running", date: "어제", durationMinutes: 20, coin: 24, xp: 120 },
              { id: "a2", eventId: "demo2", title: "커뮤니티 배드민턴", sport: "badminton", date: "3일 전", durationMinutes: 35, coin: 26, xp: 140 },
            ] as ActivityRecord[]).slice(0, 3).map((activity) => (
              <div className="activity-row" key={activity.id}>
                <span>{activity.sport === "running" ? "🏃" : activity.sport === "basketball" ? "🏀" : "🏸"}</span>
                <p><strong>{activity.title}</strong><small>{activity.date} · {activity.durationMinutes}분</small></p>
                <em>+{activity.xp} XP</em>
              </div>
            ))}
          </div>
        </section>

        <section className="verse-card host-card">
          <span><Award /></span><div><small>HOST LEVEL 3</small><strong>새로운 움직임을 여는 사람</strong><p>다음 레벨에서 정기 Event를 만들 수 있어요.</p></div><b>{coin} C</b>
        </section>
        <button className="demo-reset" onClick={onReset}>데모 데이터 초기화</button>
      </div>
    </motion.section>
  );
}

function CheckMark() {
  return <span aria-label="완료">✓</span>;
}
