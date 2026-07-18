"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronLeft,
  Clock3,
  Compass,
  LockKeyhole,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { SPORT_META, type SportType } from "@/types/moverse";
import { SportIcon } from "./sport-icon";

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
            <div className="eyebrow"><MapPinned size={14} /> 학생을 위한 대면 활동 플랫폼</div>
            <h1>가까운 곳에서<br /><em>함께 움직여요</em></h1>
            <p>지도에서 주변 활동을 찾고, 인증된 학생들과 안전하게 만나 운동을 시작하세요.</p>
            <div className="intro-preview" aria-label="오늘 가까운 활동 예시">
              <div className="intro-preview-head">
                <span><MapPinned size={16} /> 삼성동 · 힐스테이트 2단지 주변</span>
                <small>오늘</small>
              </div>
              <div className="intro-activity-row">
                <span className="intro-sport running"><SportIcon sport="running" size={19} /></span>
                <p><strong>선셋 20분 런앤워크</strong><small>620m · 처음이어도 참여 가능</small></p>
                <b><Clock3 size={13} /> 19:40</b>
              </div>
              <div className="intro-activity-row">
                <span className="intro-sport basketball"><SportIcon sport="basketball" size={19} /></span>
                <p><strong>보라매 초보자 농구 3대3</strong><small>6.8km · 2자리 남음</small></p>
                <b>내일</b>
              </div>
            </div>
            <div className="onboarding-facts">
              <span><ShieldCheck size={16} /> 학생 인증</span>
              <span><MapPinned size={16} /> 위치 단계 공개</span>
              <span><BadgeCheck size={16} /> 대면 활동 기록</span>
            </div>
            <button className="primary-cta" onClick={() => setStep(1)}>
              시작하기 <ArrowRight size={20} />
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
            <div className="eyebrow"><LockKeyhole size={14} /> 인증된 학생끼리 만나요</div>
            <h2>먼저, 학생인 것을<br />안전하게 확인할게요</h2>
            <p className="stage-copy">인증 전에는 정확한 위치와 개인정보가 누구에게도 공개되지 않아요. 인증 이미지는 확인 후 바로 삭제됩니다.</p>

            <div className={`student-card-demo ${verified ? "verified" : ""}`}>
              <div className="student-card-top"><span>학생 인증 카드</span><BadgeCheck size={21} /></div>
              <div className="student-card-body">
                <div className="student-avatar">N</div>
                <div><strong>NOVA</strong><small>학생 사용자 · 개인정보 비공개</small></div>
              </div>
              <div className="student-card-code">인증번호 •••• 0726 <span>{verified ? "인증 완료" : "확인 전"}</span></div>
            </div>

            <div className="privacy-points">
              <div><span><ShieldCheck /></span><p><strong>최소 정보만</strong><small>실명·학교·학급은 다른 사용자에게 비공개</small></p></div>
              <div><span><MapPinned /></span><p><strong>활동이 먼저</strong><small>만나기 전에는 주변 활동만 지도에 표시</small></p></div>
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
            <div className="eyebrow"><Compass size={14} /> 관심 종목을 알려주세요</div>
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
                    <span><SportIcon sport={key} size={21} /></span><strong>{meta.label}</strong>{isSelected && <i><Check size={13} /></i>}
                  </button>
                );
              })}
            </div>
            <div className="recommendation-preview">
              <div className="recommendation-icon"><MapPinned size={18} /></div>
              <p><strong>내 주변 활동부터 보여드릴게요</strong><small>선택한 종목과 거리를 기준으로 정렬합니다.</small></p>
            </div>
            <button className="primary-cta" onClick={() => onComplete(selected)} disabled={!selected.length}>
              내 지도 열기 <ArrowRight size={20} />
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
