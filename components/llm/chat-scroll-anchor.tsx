"use client";

import { useAtBottom } from "@/lib/use-at-bottom";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";

export default function ChatScrollAnchor() {
  const trackVisibility = true;
  const isAtBottom = useAtBottom();
  const { ref, inView, entry } = useInView({
    trackVisibility,
    delay: 100,
    rootMargin: "0px 0px -50px 0px",
  });

  useEffect(() => {
    if (isAtBottom && trackVisibility && !inView) {
      entry?.target.scrollIntoView({ block: "start" });
    }
  }, [isAtBottom, inView, entry, trackVisibility]);

  return <div ref={ref} className="h-0 w-full" />;
}
