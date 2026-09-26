"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TIMER_WARNING_SECONDS,
  formatTestTime,
  getRemainingSeconds,
} from "@/lib/test-timer";

interface TestTimerProps {
  expiresAt: number | null;
  onExpire: () => void;
  warningSeconds?: number;
  /** "header" fits the exam top bar; "block" is the roomier standalone presentation. */
  variant?: "header" | "block";
  className?: string;
}

export default function TestTimer({
  expiresAt,
  onExpire,
  warningSeconds = DEFAULT_TIMER_WARNING_SECONDS,
  variant = "block",
  className,
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
  const tone = isExpired ? "expired" : isWarning ? "warning" : "normal";
  const statusText = isExpired ? "Time expired" : isWarning ? "Less than a minute left" : "On track";

  return (
    <div
      role="timer"
      aria-live={isWarning || isExpired ? "assertive" : "off"}
      aria-label={`Time remaining: ${accessibleTime}${
        isWarning ? ", less than one minute remaining" : ""
      }${isExpired ? ", time expired" : ""}`}
      data-tone={tone}
      className={cn("exam-timer", variant === "header" && "px-2.5 py-1.5 text-sm", className)}
    >
      {isWarning || isExpired ? (
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Clock3 className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="sr-only">Time left: </span>
      <span aria-hidden="true">{accessibleTime}</span>
      {variant === "block" && (
        <span className="font-sans text-xs font-medium opacity-80">{statusText}</span>
      )}
    </div>
  );
}
