// The Jobs tab's search box: "user:alice partition:gpu state:failed 4821",
// with these terms:
//   user: account: partition: qos: state: node: name: cluster:  match a field
//   id: (or a bare number)  job ID or array job ID
//   date:YYYY-MM-DD         ended that day
//   gpu:yes / gpu:no        used GPUs or didn't
//   eff<25 (or eff:<25)     CPU efficiency below 25%
//   anything else           part of the job name
// Shared by the search box and the server query, so no imports.

export interface JobQuery {
  ids: number[];
  users: string[];
  accounts: string[];
  partitions: string[];
  qos: string[];
  states: string[];
  nodes: string[];
  names: string[];
  clusters: string[];
  date?: string;
  gpu?: boolean;
  effBelow?: number;
}

const FIELDS: Record<string, keyof Omit<JobQuery, "ids" | "date" | "gpu" | "effBelow">> = {
  user: "users",
  account: "accounts",
  partition: "partitions",
  qos: "qos",
  state: "states",
  node: "nodes",
  name: "names",
  cluster: "clusters",
};

export function tokenize(q: string): string[] {
  return q.match(/\S+/g) ?? [];
}

export function parseJobQuery(q: string): JobQuery {
  const out: JobQuery = {
    ids: [],
    users: [],
    accounts: [],
    partitions: [],
    qos: [],
    states: [],
    nodes: [],
    names: [],
    clusters: [],
  };
  for (const token of tokenize(q)) {
    const eff = token.match(/^eff:?<?(\d+(?:\.\d+)?)%?$/i);
    if (eff && /^eff:?</i.test(token)) {
      out.effBelow = Number(eff[1]);
      continue;
    }
    const colon = token.indexOf(":");
    const key = colon > 0 ? token.slice(0, colon).toLowerCase() : "";
    const value = colon > 0 ? token.slice(colon + 1) : token;
    if (key && value) {
      if (key in FIELDS) {
        out[FIELDS[key]].push(value);
        continue;
      }
      if (key === "id" || key === "job") {
        if (/^\d+$/.test(value)) out.ids.push(Number(value));
        continue;
      }
      if (key === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        out.date = value;
        continue;
      }
      if (key === "gpu" || key === "gpus") {
        out.gpu = !/^(no|false|0|none)$/i.test(value);
        continue;
      }
    }
    if (/^\d+$/.test(token)) out.ids.push(Number(token));
    else out.names.push(token);
  }
  return out;
}

// q with the key:value term for key replaced (or removed when value is null)
export function setTerm(q: string, key: string, value: string | null): string {
  const matches = (t: string) => (key === "eff" ? /^eff:?</i.test(t) : t.toLowerCase().startsWith(`${key}:`));
  const kept = tokenize(q).filter((t) => !matches(t));
  if (value !== null) kept.push(key === "eff" ? `eff<${value}` : `${key}:${value}`);
  return kept.join(" ");
}

export function getTerm(q: string, key: string): string | null {
  for (const t of tokenize(q)) {
    if (key === "eff") {
      const m = t.match(/^eff:?<(\d+(?:\.\d+)?)%?$/i);
      if (m) return m[1];
    } else if (t.toLowerCase().startsWith(`${key}:`)) {
      return t.slice(key.length + 1);
    }
  }
  return null;
}
