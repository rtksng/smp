"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopLoadingBar } from "./top-loading-bar";

type ProgressState = "idle" | "loading" | "settling";

const SETTLE_DELAY_MS = 220;
const SAFETY_TIMEOUT_MS = 5000;

export function RouteTransitionProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(
    () => `${pathname ?? ""}?${searchParams?.toString() ?? ""}`,
    [pathname, searchParams]
  );
  const [progressState, setProgressState] = useState<ProgressState>("idle");
  const settleTimerRef = useRef<number | null>(null);
  const safetyTimerRef = useRef<number | null>(null);
  const routeKeyRef = useRef<string | null>(null);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      window.clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const completeProgress = useCallback(() => {
    clearSafetyTimer();
    clearSettleTimer();
    setProgressState((currentState) =>
      currentState === "idle" ? currentState : "settling"
    );
    settleTimerRef.current = window.setTimeout(() => {
      setProgressState("idle");
      settleTimerRef.current = null;
    }, SETTLE_DELAY_MS);
  }, [clearSafetyTimer, clearSettleTimer]);

  const startProgress = useCallback(() => {
    clearSafetyTimer();
    clearSettleTimer();
    setProgressState("loading");
    safetyTimerRef.current = window.setTimeout(() => {
      completeProgress();
    }, SAFETY_TIMEOUT_MS);
  }, [clearSafetyTimer, clearSettleTimer, completeProgress]);

  useEffect(() => {
    if (routeKeyRef.current === null) {
      routeKeyRef.current = routeKey;
      return;
    }

    if (routeKeyRef.current !== routeKey) {
      routeKeyRef.current = routeKey;
      completeProgress();
    }
  }, [completeProgress, routeKey]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (shouldIgnoreClick(event)) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");

      if (anchor && shouldStartForUrl(anchor.href, anchor)) {
        startProgress();
      }
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form || event.defaultPrevented) {
        return;
      }

      const method = form.method.toLowerCase();
      const action = form.action || window.location.href;

      if (method === "get" && shouldStartForUrl(action)) {
        startProgress();
      }
    }

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((...args: Parameters<History["pushState"]>) => {
      const previousHref = window.location.href;
      originalPushState(...args);

      if (window.location.href !== previousHref) {
        startProgress();
      }
    }) as History["pushState"];

    window.history.replaceState = ((
      ...args: Parameters<History["replaceState"]>
    ) => {
      const previousHref = window.location.href;
      originalReplaceState(...args);

      if (window.location.href !== previousHref) {
        startProgress();
      }
    }) as History["replaceState"];

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("popstate", startProgress);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("popstate", startProgress);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearSafetyTimer();
      clearSettleTimer();
    };
  }, [clearSafetyTimer, clearSettleTimer, startProgress]);

  return <TopLoadingBar state={progressState} />;
}

function shouldIgnoreClick(event: MouseEvent) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

function shouldStartForUrl(href: string, anchor?: HTMLAnchorElement) {
  if (anchor?.target && anchor.target !== "_self") {
    return false;
  }

  if (anchor?.hasAttribute("download")) {
    return false;
  }

  let nextUrl: URL;

  try {
    nextUrl = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (nextUrl.origin !== window.location.origin) {
    return false;
  }

  return (
    nextUrl.pathname !== window.location.pathname ||
    nextUrl.search !== window.location.search
  );
}
