import { readEnv } from "@/lib/config";
import { fetchSlurmData } from "@/lib/slurm-api";

// Fair share for one user, from slurmrestd's /shares (what sshare shows).
// slurmrestd ignores the users and accounts filters and returns the whole
// association tree with per-TRES usage on every row, which is large on a big
// cluster. So it's fetched at most once per FAIRSHARE_CACHE_SECONDS, kept
// without the TRES detail, and each request picks out one user.

type SlurmNumber = number | { set?: boolean; infinite?: boolean; number?: number } | undefined;

// Infinite LevelFS means no usage at all
type Level = number | "inf" | null;

function value(n: SlurmNumber): number | null {
  if (typeof n === "number") return n;
  if (!n || n.set === false || n.infinite) return null;
  return n.number ?? null;
}

function level(n: SlurmNumber): Level {
  if (n && typeof n === "object" && n.infinite) return "inf";
  return value(n);
}

interface RawShare {
  name?: string;
  parent?: string;
  partition?: string;
  type?: string[] | string;
  shares?: SlurmNumber;
  shares_normalized?: SlurmNumber;
  usage?: SlurmNumber;
  usage_normalized?: SlurmNumber;
  effective_usage?: SlurmNumber;
  fairshare?: { factor?: SlurmNumber; level?: SlurmNumber };
}

interface Share {
  name: string;
  parent: string;
  partition: string;
  user: boolean;
  rawShares: number | null;
  normShares: number | null;
  rawUsage: number | null;
  effectiveUsage: number | null;
  factor: number | null;
  levelFs: Level;
}

export interface FairshareAccount {
  // Ancestors' LevelFS from the top: how each level compares with its siblings
  path: { account: string; normShares: number | null; effectiveUsage: number | null; levelFs: Level }[];
  account: string;
  partition: string;
  // The FairShare factor Slurm uses for priority, 0 to 1
  factor: number | null;
  rawShares: number | null;
  // Share of the account, and share of the account's usage
  normShares: number | null;
  effectiveUsage: number | null;
  rawUsage: number | null;
  levelFs: Level;
}

export type FairshareResult =
  | { available: true; user: string; accounts: FairshareAccount[]; fetchedAt: string }
  | { available: false; reason: string };

let cache: { at: number; shares: Promise<Share[]> } | undefined;

function cacheMs(): number {
  const seconds = Number(readEnv("FAIRSHARE_CACHE_SECONDS"));
  return (Number.isFinite(seconds) && seconds >= 0 ? seconds : 300) * 1000;
}

async function fetchShares(): Promise<Share[]> {
  const result = await fetchSlurmData("/shares");
  if (result.error) throw new Error(result.error);
  // v0.0.40+ nests the list as shares.shares
  const raw: RawShare[] = Array.isArray(result.data?.shares) ? result.data.shares : result.data?.shares?.shares ?? [];
  return raw.map((s) => ({
    name: s.name ?? "",
    parent: s.parent ?? "",
    partition: s.partition ?? "",
    user: [s.type ?? []].flat().includes("USER"),
    rawShares: value(s.shares),
    normShares: value(s.shares_normalized),
    rawUsage: value(s.usage),
    effectiveUsage: value(s.effective_usage),
    factor: value(s.fairshare?.factor),
    levelFs: level(s.fairshare?.level),
  }));
}

function shares(): Promise<Share[]> {
  if (!cache || Date.now() - cache.at > cacheMs()) {
    const entry = { at: Date.now(), shares: fetchShares() };
    cache = entry;
    // Don't keep a failure for the whole cache period
    entry.shares.catch(() => {
      if (cache === entry) cache = undefined;
    });
  }
  return cache.shares;
}

export async function getUserFairshare(user: string): Promise<FairshareResult> {
  let all: Share[];
  try {
    all = await shares();
  } catch (err) {
    return { available: false, reason: (err as Error).message };
  }
  if (all.length === 0) return { available: false, reason: "Slurm returned no shares (is PriorityType priority/multifactor?)" };

  const accounts = new Map(all.filter((s) => !s.user).map((s) => [s.name, s]));
  const pathTo = (account: string) => {
    const path: FairshareAccount["path"] = [];
    // Stop at root, and guard against a cycle
    for (let a = accounts.get(account); a && a.parent && path.length < 20; a = accounts.get(a.parent)) {
      path.unshift({ account: a.name, normShares: a.normShares, effectiveUsage: a.effectiveUsage, levelFs: a.levelFs });
    }
    return path;
  };

  return {
    available: true,
    user,
    fetchedAt: new Date(cache?.at ?? Date.now()).toISOString(),
    accounts: all
      .filter((s) => s.user && s.name === user)
      .map((s) => ({
        path: pathTo(s.parent),
        account: s.parent,
        partition: s.partition,
        factor: s.factor,
        rawShares: s.rawShares,
        normShares: s.normShares,
        effectiveUsage: s.effectiveUsage,
        rawUsage: s.rawUsage,
        levelFs: s.levelFs,
      })),
  };
}
