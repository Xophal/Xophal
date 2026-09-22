"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, TriangleAlert } from "lucide-react";
import {
  DEFAULT_TIMER_WARNING_SECONDS,
  formatTestTime,
  getRemainingSeconds,
} from "@/lib/test-timer";

interface TestTimerProps {
  expiresAt: number | null;
  onExpire: () => void;
  warningSeconds?: number;
}

export default function TestTimer({
  expiresAt,
  onExpire,
  warningSeconds = DEFAULT_TIMER_WARNING_SECONDS,
}: TestTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(expiresAt));
  const onExpireRef = useRef(onExpire);
  const didExpire = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    didExpire.current = false;

    const updateRemainingTime = () => {
      if (!expiresAt) {
        setRemainingSeconds(0);
        return;
      }

      const nextRemainingSeconds = getRemainingSeconds(expiresAt);
      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds === 0 && !didExpire.current) {
        didExpire.current = true;
        onExpireRef.current();
      }
    };

    updateRemainingTime();
    if (!expiresAt) return;

    const intervalId = window.setInterval(updateRemainingTime, 1000);
    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  const isWarning = remainingSeconds > 0 && remainingSeconds <= warningSeconds;
  const isExpired = remainingSeconds === 0;
  const accessibleTime = formatTestTime(remainingSeconds);

  return (
    <div
      role="timer"
      aria-live={isWarning || isExpired ? "assertive" : "off"}
      aria-label={`Time remaining: ${accessibleTime}${isWarning ? ", less than one minute remaining" : ""}${isExpired ? ", time expired" : ""}`}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 font-mono text-sm font-bold ${
        isWarning || isExpired ? "bg-destructive/10 text-destructive" : "bg-muted"
      }`}
    >
      {isWarning || isExpired ? <TriangleAlert className="h-4 w-4" aria-hidden="true" /> : <Clock3 className="h-4 w-4" aria-hidden="true" />}
      <span>Time left: {accessibleTime}</span>
      {isWarning && <span className="font-sans text-xs">Less than one minute</span>}
      {isExpired && <span className="font-sans text-xs">Time expired</span>}
    </div>
  );
}
