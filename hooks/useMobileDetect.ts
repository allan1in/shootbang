"use client";

import { useState, useEffect } from "react";

const MOBILE_USER_AGENT_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;
const SMALL_SCREEN_BREAKPOINT = 768;

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    mobile: boolean;
  };
}

function isUnsupportedMobileDevice() {
  const navigatorWithClientHints = navigator as NavigatorWithUserAgentData;
  const mobileClientHint = navigatorWithClientHints.userAgentData?.mobile;
  const hasMobileUserAgent =
    mobileClientHint === true ||
    MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent);
  const isIPadDesktopMode =
    navigator.maxTouchPoints > 1 &&
    navigator.userAgent.includes("Macintosh");
  const isSmallScreen =
    Math.min(window.screen.width, window.screen.height) <
    SMALL_SCREEN_BREAKPOINT;

  return hasMobileUserAgent || isIPadDesktopMode || isSmallScreen;
}

export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(isUnsupportedMobileDevice());
    };
    check();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return { isMobile, ready };
}
