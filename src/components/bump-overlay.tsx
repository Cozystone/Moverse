"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  QrCode,
  ShieldCheck,
  UserCircleCheck,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MoverAvatar } from "./mover-avatar";

type BumpStage = "ready" | "holding" | "candidate" | "success";

type BumpOverlayProps = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  onQrFallback: () => void;
};

const HOLD_MS = 1_200;

export function BumpOverlay({
  open,
  onClose,
  onComplete,
  onQrFallback,
}: BumpOverlayProps) {
  const [stage, setStage] = useState<BumpStage>("ready");
  const holdTimerRef = useRef<number | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearHold();
    setStage("ready");
  }, [clearHold]);

  useEffect(() => clearHold, [clearHold]);

  const closeBump = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const beginHold = useCallback(() => {
    if (stage !== "ready") return;
    clearHold();
    setStage("holding");
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setStage("candidate");
    }, HOLD_MS);
  }, [clearHold, stage]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="bump-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bump-title"
        >
          <button className="bump-close" onClick={closeBump} aria-label="BUMP 닫기">
            <X size={20} weight="bold" />
          </button>

          <div className="bump-status" aria-live="polite">
            <ShieldCheck size={17} weight="fill" />
            현장에서만 10초
          </div>

          <motion.div
            className={`bump-orb-stage is-${stage}`}
            animate={stage === "holding" ? { scale: 1.05 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <Image
              src="/moverse-bump-orb.png"
              width={220}
              height={220}
              alt=""
              priority
            />
          </motion.div>

          {stage === "candidate" ? (
            <section className="bump-copy bump-candidate">
              <MoverAvatar avatarId="lumi" size="md" status="online" ring="accent" framing="bust" />
              <p>지금 만난 사람</p>
              <h2 id="bump-title">LUMI 맞나요?</h2>
              <div className="bump-confirm-actions">
                <button onClick={reset}>아니에요</button>
                <button onClick={() => setStage("success")}>
                  <Check size={18} weight="bold" /> 맞아요
                </button>
              </div>
            </section>
          ) : stage === "success" ? (
            <section className="bump-copy bump-success">
              <span><UserCircleCheck size={25} weight="fill" /></span>
              <p>현장 확인 완료</p>
              <h2 id="bump-title">BUMP!</h2>
              <button
                className="bump-start-button"
                onClick={() => {
                  reset();
                  onComplete();
                  onClose();
                }}
              >
                활동 시작 <ArrowRight size={18} weight="bold" />
              </button>
            </section>
          ) : (
            <section className="bump-copy">
              <p>BUMP</p>
              <h2 id="bump-title">서로 가까이</h2>
              <span>둘 다 눌러요</span>
              <button
                className={`bump-hold-button ${stage === "holding" ? "is-holding" : ""}`}
                onClick={beginHold}
                disabled={stage === "holding"}
              >
                <b>{stage === "holding" ? "서로 찾는 중" : "BUMP 시작"}</b>
                <motion.i
                  initial={false}
                  animate={{ width: stage === "holding" ? "100%" : "0%" }}
                  transition={{ duration: stage === "holding" ? HOLD_MS / 1_000 : 0.15, ease: "linear" }}
                />
              </button>
              <button
                className="bump-qr-button"
                onClick={() => {
                  reset();
                  onQrFallback();
                }}
              >
                <QrCode size={17} weight="bold" /> QR로 확인
              </button>
            </section>
          )}

          <p className="bump-privacy">성공해도 위치·DM은 자동 공개되지 않아요</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
