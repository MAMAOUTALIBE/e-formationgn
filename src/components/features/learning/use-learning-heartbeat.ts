"use client";

import { useEffect, useRef } from "react";

import {
  HEARTBEAT_INTERVAL_SECONDS,
  type HeartbeatActivityMode,
  shouldSendLearningHeartbeat,
} from "@/lib/learning-tracking";
import { recordLearningHeartbeat } from "@/server/actions/learning";

const RECENT_ACTIVITY_MS = 60_000;

export function useLearningHeartbeat(
  lessonId: string,
  options: { mode: HeartbeatActivityMode; isPlaying?: boolean },
) {
  const sessionKeyRef = useRef<string>("");
  const lastActivityRef = useRef(0);

  useEffect(() => {
    sessionKeyRef.current = crypto.randomUUID();
    lastActivityRef.current = Date.now();
    const markActive = () => { lastActivityRef.current = Date.now(); };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    return () => events.forEach((event) => window.removeEventListener(event, markActive));
  }, [lessonId]);

  useEffect(() => {
    const send = () => {
      const now = Date.now();
      if (!shouldSendLearningHeartbeat({
        mode: options.mode,
        isVisible: document.visibilityState === "visible",
        isPlaying: options.isPlaying,
        lastActivityAt: lastActivityRef.current,
        now,
        recentActivityMs: RECENT_ACTIVITY_MS,
      })) return;
      if (!sessionKeyRef.current) return;
      void recordLearningHeartbeat({ lessonId, sessionKey: sessionKeyRef.current });
    };
    send();
    const timer = window.setInterval(send, HEARTBEAT_INTERVAL_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, [lessonId, options.isPlaying, options.mode]);
}

export function LearningActivityHeartbeat({ lessonId }: { lessonId: string }) {
  useLearningHeartbeat(lessonId, { mode: "INTERACTIVE_CONTENT" });
  return null;
}
