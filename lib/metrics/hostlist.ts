// Slurm hostlists ("node[01-03,07],gpu5") to host names. Used client and
// server side, so no imports.

// Split on commas that aren't inside brackets
function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === "," && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function expandOne(host: string, limit: number): string[] {
  const open = host.indexOf("[");
  const close = open === -1 ? -1 : host.indexOf("]", open);
  if (open === -1 || close === -1) return [host];
  const prefix = host.slice(0, open);
  const rest = expandOne(host.slice(close + 1), limit);
  const out: string[] = [];
  for (const part of host.slice(open + 1, close).split(",")) {
    const [a, b] = part.split("-");
    if (b === undefined) {
      for (const r of rest) out.push(prefix + a + r);
      continue;
    }
    const start = parseInt(a, 10);
    const end = parseInt(b, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    for (let n = start; n <= end && out.length < limit; n++) {
      for (const r of rest) out.push(prefix + String(n).padStart(a.length, "0") + r);
    }
  }
  return out;
}

// Host names in a hostlist, at most limit of them
export function expandHostlist(list: string | null | undefined, limit = 10_000): string[] {
  if (!list || list === "None assigned") return [];
  const out: string[] = [];
  for (const host of splitTop(list)) {
    out.push(...expandOne(host, limit - out.length));
    if (out.length >= limit) break;
  }
  return out;
}
