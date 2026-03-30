"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

type UseNavVisibilityOptions = {
  threshold?: number;
};

export function useNavVisibility({
  threshold = 10,
}: UseNavVisibilityOptions = {}) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  const handleScroll = useEffectEvent(() => {
    const currentScrollY = window.scrollY;

    if (currentScrollY < threshold) {
      setIsVisible(true);
    } else if (currentScrollY > lastScrollYRef.current) {
      setIsVisible(false);
    } else {
      setIsVisible(true);
    }

    lastScrollYRef.current = currentScrollY;
  });

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return isVisible;
}
