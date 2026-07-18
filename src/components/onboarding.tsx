"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronLeft,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { SPORT_META, type SportType } from "@/types/moverse";

type OnboardingProps = {
  onComplete: (sports: SportType[]) => void;
};

const sports = Object.entries(SPORT_META) as [SportType, (typeof SPORT_META)[SportType]][];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<SportType[]>(["running", "basketball"]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const verify = () => {
    setIsVerifying(true);
    window.setTimeout(() => {
      setIsVerifying(false);
      setVerified(true);
    }, 1150);
  };

  const toggleSport = (sport: SportType) => {
    setSelected((current) =>
      current.includes(sport) ? current.filter((item) => item !== sport) : [...current, sport],
    );
  };

  return (
    <main className="onboarding-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="onboarding-header">
        {step > 0 ? (
          <button className="round-icon-btn" onClick={() => setStep((value) => value - 1)} aria-label="이전 단계">
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div className="brand-mini"><span className="brand-orbit">M</span><strong>MOVERSE</strong></div>
        )}
        <div className="step-dots" aria-label={`${step + 1}/3 단계`}>
          {[0, 1, 2].map((item) => <span key={item} className={item === step ? "active" : item < step ? "done" : ""} />)}
        </div>
      </header>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.section
            key="world"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="onboarding-stage intro-stage"
          >
            <div className="mini-world" aria-hidden="true">
              <div className="world-ring ring-a" />
              <div className="world-ring ring-b" />
              <div className="world-land land-a" />
              <div className="world-land land-b" />
              <div className="world-spot world-spot-a"><span>🏀</span></div>
              <div className="world-spot world-spot-b"><span>🏃</span></div>
              <div className="world-spot world-spot-c"><span>🏸</span></div>
              <div className="world-player">✨</div>
            </div>
            <div className="eyebrow"><Sparkles size={14} /> 현실에서 시작되는 새로운 연결</div>
            <h1>세상을 움직이는<br /><em>우리만의 Universe</em></h1>
            <p>주변 활동을 발견하고, 인증된 학생들과 만나 함께 움직여요. 우리가 움직일수록 현실의 Moverse가 성장합니다.</p>
            <div className="onboarding-pills">
              <span><MapPinned size={15} /> 3D 활동 지도</span>
              <span><ShieldCheck size={15} /> 학생 인증</span>
              <span><BadgeCheck size={15} /> 함께 성장</span>
            </div>
            <button className="primary-cta" onClick={() => setStep(1)}>
              Moverse 입장하기 <ArrowRight size={20} />
            </button>
          </motion.section>
        )}

        {step === 1 && (
          <motion.section
            key="verify"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="onboarding-stage"
          >
            <div className="eyebrow"><LockKeyhole size={14} /> 학생만 들어올 수 있는 활동 세계</div>
            <h2>먼저, 학생인 것을<br />안전하게 확인할게요</h2>
            <p className="stage-copy">인증 전에는 정확한 위치와 개인정보가 누구에게도 공개되지 않아요. 인증 이미지는 확인 후 바로 삭제됩니다.</p>

            <div className={`student-card-demo ${verified ? "verified" : ""}`}>
              <div className="card-shine" />
              <div className="student-card-top"><span>MOVER ID</span><BadgeCheck size={21} /></div>
              <div className="student-card-body">
                <div className="student-avatar">N</div>
                <div><strong>NOVA</strong><small>Student explorer · Teen verified</small></div>
              </div>
              <div className="student-card-code">•••• 0726 <span>{verified ? "VERIFIED" : "READY"}</span></div>
            </div>

            <div className="privacy-points">
              <div><span><ShieldCheck /></span><p><strong>최소 정보만</strong><small>실명·학교·학급은 다른 사용자에게 비공개</small></p></div>
              <div><span><MapPinned /></span><p><strong>활동이 먼저</strong><small>사람 위치가 아닌 주변 Event만 탐색</small></p></div>
            </div>

            {!verified ? (
              <button className="primary-cta" onClick={verify} disabled={isVerifying}>
                {isVerifying ? <><span className="button-spinner" /> 안전하게 확인 중</> : <><Camera size={20} /> 학생증으로 데모 인증</>}
              </button>
            ) : (
              <motion.button initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="primary-cta success" onClick={() => setStep(2)}>
                <Check size={20} /> 인증 완료 · 다음으로
              </motion.button>
            )}
            <button className="text-button" onClick={() => { setVerified(true); setStep(2); }}>데모 인증 건너뛰기</button>
          </motion.section>
        )}

        {step === 2 && (
          <motion.section
            key="sports"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="onboarding-stage"
          >
            <div className="eyebrow"><Sparkles size={14} /> 첫 번째 추천을 준비할게요</div>
            <h2>어떤 움직임이<br />끌리나요?</h2>
            <p className="stage-copy">잘하지 않아도 괜찮아요. 지금 관심 있는 활동을 골라주세요.</p>
            <div className="sport-select-grid">
              {sports.map(([key, meta]) => {
                const isSelected = selected.includes(key);
                return (
                  <button
                    key={key}
                    className={isSelected ? "sport-select selected" : "sport-select"}
                    style={{ "--sport-color": meta.color, "--sport-soft": meta.soft } as React.CSSProperties}
                    onClick={() => toggleSport(key)}
                    aria-pressed={isSelected}
                  >
                    <span>{meta.emoji}</span><strong>{meta.label}</strong>{isSelected && <i><Check size={13} /></i>}
                  </button>
                );
              })}
            </div>
            <div className="recommendation-preview">
              <div className="ai-spark">✦</div>
              <p><strong>NOVA를 위한 첫 움직임</strong><small>선택한 종목과 가까운 Spot을 지도에서 추천할게요.</small></p>
            </div>
            <button className="primary-cta" onClick={() => onComplete(selected)} disabled={!selected.length}>
              내 Moverse 열기 <ArrowRight size={20} />
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
