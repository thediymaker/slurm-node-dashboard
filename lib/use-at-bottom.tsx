import { useEffect, useState } from "react";

export function useAtBottom(offset = 0) {
  const [isAtbottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsAtBottom(
        window.innerHeight + window.scrollY + offset >=
          document.body.offsetHeight - offset
      );
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [offset]);

  return isAtbottom;
}
