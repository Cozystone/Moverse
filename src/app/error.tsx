"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <div className="error-screen"><div className="brand-orbit">M</div><h1>잠시 길을 잃었어요</h1><p>Moverse 지도를 다시 펼쳐볼게요.</p><button onClick={() => unstable_retry()}><RotateCcw /> 다시 시도</button></div>;
}
