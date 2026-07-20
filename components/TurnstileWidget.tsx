"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import Script from "next/script";

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileWidgetId = string;

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  appearance: "interaction-only";
  execution: "execute";
  size: "flexible";
  callback: (token: string) => void;
  "error-callback": (code?: string) => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
}

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions,
  ) => TurnstileWidgetId;
  execute: (widgetId: TurnstileWidgetId) => void;
  reset: (widgetId: TurnstileWidgetId) => void;
  remove: (widgetId: TurnstileWidgetId) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileStatus = "loading" | "ready" | "error";

export interface TurnstileWidgetHandle {
  execute: () => Promise<string>;
  reset: () => void;
}

interface TurnstileWidgetProps {
  siteKey?: string;
  onStatusChange: (status: TurnstileStatus) => void;
}

interface PendingChallenge {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

function challengeError(message: string, name = "TurnstileError") {
  const error = new Error(message);
  error.name = name;
  return error;
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget({ siteKey, onStatusChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const pendingRef = useRef<PendingChallenge | null>(null);
  const mountedRef = useRef(true);

  const rejectPending = useCallback((error: Error) => {
    pendingRef.current?.reject(error);
    pendingRef.current = null;
  }, []);

  const reset = useCallback(() => {
    const turnstile = window.turnstile;
    const widgetId = widgetIdRef.current;
    if (turnstile && widgetId) turnstile.reset(widgetId);
  }, []);

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile) {
      onStatusChange("error");
      return;
    }
    if (widgetIdRef.current) {
      onStatusChange("ready");
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "feedback_submit",
      appearance: "interaction-only",
      execution: "execute",
      size: "flexible",
      callback: (token) => {
        if (!mountedRef.current) return;
        pendingRef.current?.resolve(token);
        pendingRef.current = null;
      },
      "error-callback": (code) => {
        if (!mountedRef.current) return;
        rejectPending(
          challengeError(
            code ? `Turnstile verification failed: ${code}` : "Turnstile verification failed",
          ),
        );
      },
      "expired-callback": () => {
        if (!mountedRef.current) return;
        rejectPending(challengeError("Turnstile token expired"));
      },
      "timeout-callback": () => {
        if (!mountedRef.current) return;
        rejectPending(challengeError("Turnstile verification timed out"));
      },
    });
    onStatusChange("ready");
  }, [onStatusChange, rejectPending, siteKey]);

  useImperativeHandle(
    ref,
    () => ({
      execute: () => {
        const turnstile = window.turnstile;
        const widgetId = widgetIdRef.current;
        if (!turnstile || !widgetId || pendingRef.current) {
          return Promise.reject(
            challengeError("Turnstile is not ready"),
          );
        }

        return new Promise<string>((resolve, reject) => {
          pendingRef.current = { resolve, reject };
          turnstile.execute(widgetId);
        });
      },
      reset,
    }),
    [reset],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      rejectPending(challengeError("Turnstile was closed", "AbortError"));
      const turnstile = window.turnstile;
      const widgetId = widgetIdRef.current;
      if (turnstile && widgetId) turnstile.remove(widgetId);
      widgetIdRef.current = null;
    };
  }, [rejectPending]);

  useEffect(() => {
    if (!siteKey) onStatusChange("error");
  }, [onStatusChange, siteKey]);

  return (
    <div className="flex min-h-0 w-full justify-center">
      <div ref={containerRef} className="w-full" />
      {siteKey && (
        <Script
          id="cloudflare-turnstile"
          src={TURNSTILE_SCRIPT}
          strategy="afterInteractive"
          onReady={renderWidget}
          onError={() => onStatusChange("error")}
        />
      )}
    </div>
  );
});
