"use client";

// Widget Cloudflare Turnstile — captcha invisible/managed selon la config
// du site key. S'auto-désactive si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est
// absent (pas de bruit visuel en dev).
//
// Pattern :
//   1. Charge le script Cloudflare une fois (idempotent).
//   2. Render le widget dans le div référencé.
//   3. Le token résolu est injecté dans un <input hidden name="cf-turnstile-response">.
//   4. La server action lit `formData.get("cf-turnstile-response")` puis
//      appelle `verifyTurnstile(token)`.

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface TurnstileWidgetProps {
  /** ID du form (pour cibler le bon widget si plusieurs forms sur la page). */
  formId?: string;
}

export function TurnstileWidget({ formId }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    const tryRender = () => {
      if (!window.turnstile || !containerRef.current) return false;
      if (widgetIdRef.current) return true;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: "auto",
        callback: (token) => {
          if (tokenInputRef.current) tokenInputRef.current.value = token;
        },
        "expired-callback": () => {
          if (tokenInputRef.current) tokenInputRef.current.value = "";
        },
        "error-callback": () => {
          if (tokenInputRef.current) tokenInputRef.current.value = "";
        },
      });
      return true;
    };

    if (!tryRender()) {
      const interval = setInterval(() => {
        if (tryRender()) clearInterval(interval);
      }, 200);
      const timeout = setTimeout(() => clearInterval(interval), 10_000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [formId]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
      <div ref={containerRef} className="mt-1" />
      <input
        ref={tokenInputRef}
        type="hidden"
        name="cf-turnstile-response"
        defaultValue=""
      />
    </>
  );
}
