"use client";

import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { metricsQuery, type MetricsParams, type Period } from "@/lib/metrics/params";

// The metrics page's state lives in the URL. Tabs and controls change it
// through navigate(), which the server answers with the new view; pending is
// true until it arrives.

interface MetricsNav {
  params: MetricsParams;
  // The period in effect (params.period, or the one picked for the range)
  period: Period;
  fromDate: string;
  toDate: string;
  // Accounts are mapped to colleges and departments
  hierarchy: boolean;
  pending: boolean;
  navigate: (update: (params: MetricsParams) => MetricsParams) => void;
  // The shareable link for params
  linkFor: (params: MetricsParams) => string;
}

const MetricsNavContext = createContext<MetricsNav | null>(null);

export function MetricsNavProvider({
  params,
  period,
  fromDate,
  toDate,
  hierarchy,
  children,
}: {
  params: MetricsParams;
  period: Period;
  fromDate: string;
  toDate: string;
  hierarchy: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (update: (p: MetricsParams) => MetricsParams) => {
      const q = metricsQuery(update(params));
      startTransition(() => router.push(q ? `${pathname}?${q}` : pathname, { scroll: false }));
    },
    [params, pathname, router]
  );

  const linkFor = useCallback((p: MetricsParams) => {
    const q = metricsQuery(p);
    return `${window.location.origin}${window.location.pathname}${q ? `?${q}` : ""}`;
  }, []);

  const value = useMemo(
    () => ({ params, period, fromDate, toDate, hierarchy, pending, navigate, linkFor }),
    [params, period, fromDate, toDate, hierarchy, pending, navigate, linkFor]
  );
  return <MetricsNavContext.Provider value={value}>{children}</MetricsNavContext.Provider>;
}

export function useMetricsNav(): MetricsNav {
  const value = useContext(MetricsNavContext);
  if (!value) throw new Error("useMetricsNav must be used inside MetricsNavProvider");
  return value;
}
