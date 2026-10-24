type SlurmApiType = 'slurm' | 'slurmdb';

const env = process.env;

interface FetchSlurmOptions {
  type?: SlurmApiType;
  revalidate?: number;
  method?: string;
  body?: any;
}

// Max slurmrestd requests in flight at once. slurmrestd has a connection limit
// shared by all its clients, and fetch opens a socket per request.
const MAX_CONCURRENT_SLURM_REQUESTS = Number(env.SLURM_MAX_CONCURRENCY) || 8;

// Keep a hung slurmrestd from holding a slot forever. Large /jobs queries can
// take over a minute, so this is generous.
const SLURM_REQUEST_TIMEOUT_MS = Number(env.SLURM_REQUEST_TIMEOUT_MS) || 120_000;

let inFlight = 0;
const waiting: Array<() => void> = [];

// Run task once a slot is free. A finished request hands its slot straight to
// the next waiter so the count can't go over the cap.
async function withSlurmSlot<T>(task: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_CONCURRENT_SLURM_REQUESTS) {
    inFlight++;
  } else {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }

  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else inFlight--;
  }
}

// Newest first. Each Slurm release serves a few of these (26.05 serves
// v0.0.42-v0.0.45), so detection picks the newest one this slurmrestd has.
const KNOWN_API_VERSIONS = ["v0.0.45", "v0.0.44", "v0.0.43", "v0.0.42", "v0.0.41", "v0.0.40", "v0.0.39"];

let detectedVersion: Promise<string> | undefined;

class SlurmApiVersionError extends Error {}

async function detectApiVersion(): Promise<string> {
  const protocol = env.SLURM_PROTOCOL || 'http';
  const port = env.SLURM_SERVER_PORT || '6820';
  for (const version of KNOWN_API_VERSIONS) {
    const res = await fetch(`${protocol}://${env.SLURM_SERVER}:${port}/slurm/${version}/ping`, {
      headers: {
        "X-SLURM-USER-NAME": `${env.SLURM_API_ACCOUNT}`,
        "X-SLURM-USER-TOKEN": `${env.SLURM_API_TOKEN}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      console.log(`[slurm] SLURM_API_VERSION not set; using ${version}, the newest this slurmrestd serves`);
      return version;
    }
    // slurmrestd checks the token before the path, so this isn't a version problem
    if (res.status === 401 || res.status === 403) {
      throw new SlurmApiVersionError(`slurmrestd rejected the token (HTTP ${res.status}); check SLURM_API_TOKEN and SLURM_API_ACCOUNT`);
    }
  }
  throw new SlurmApiVersionError(`slurmrestd serves none of ${KNOWN_API_VERSIONS.join(", ")}; set SLURM_API_VERSION`);
}

// SLURM_API_VERSION if set, otherwise the detected version. A failed detection
// isn't cached, so the next request tries again.
export function getSlurmApiVersion(): Promise<string> {
  const configured = env.SLURM_API_VERSION?.trim();
  if (configured) return Promise.resolve(configured);
  detectedVersion ??= detectApiVersion().catch((err) => {
    detectedVersion = undefined;
    throw err;
  });
  return detectedVersion;
}

export async function fetchSlurmData(endpoint: string, options: FetchSlurmOptions | SlurmApiType = {}) {
  // Handle backward compatibility or simple string usage
  const finalOptions: FetchSlurmOptions = typeof options === 'string' 
    ? { type: options } 
    : options;

  const { type = 'slurm', method = 'GET', body } = finalOptions;
  
  const protocol = env.SLURM_PROTOCOL || 'http';
  const port = env.SLURM_SERVER_PORT || '6820';
  
  const fetchOptions: RequestInit = {
    method,
    headers: {
      "X-SLURM-USER-NAME": `${env.SLURM_API_ACCOUNT}`,
      "X-SLURM-USER-TOKEN": `${env.SLURM_API_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    cache: 'no-store', // Disable caching to always get fresh data from Slurm
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }
  
  try {
    const baseUrl = `${protocol}://${env.SLURM_SERVER}:${port}/${type}/${await getSlurmApiVersion()}`;
    const res = await withSlurmSlot(() =>
      fetch(`${baseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: AbortSignal.timeout(SLURM_REQUEST_TIMEOUT_MS),
      })
    );

    if (!res.ok) {
      return { error: res.statusText, status: res.status };
    }

    const data = await res.json();
    return { data };
  } catch (error) {
    if (error instanceof SlurmApiVersionError) {
      console.error(`Error fetching ${endpoint}: ${error.message}`);
      return { error: error.message, status: 502 };
    }
    console.error(`Error fetching ${endpoint}:`, error);
    
    // Check if slurmrestd timed out
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return {
        error: "Slurm controller did not respond in time. It may be overloaded.",
        status: 504,
      };
    }

    // Check if it's a connection error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCause = error instanceof Error ? (error as any).cause : null;
    
    if (errorCause?.code === 'ECONNREFUSED' || errorCause?.syscall === 'connect') {
      return { 
        error: "Unable to contact Slurm controller. The service may be down or unreachable.", 
        status: 503,
        details: `Connection refused to ${errorCause?.address || 'server'}:${errorCause?.port || 'unknown'}`
      };
    }
    
    if (errorMessage.includes('fetch failed')) {
      return { 
        error: "Unable to contact Slurm controller. Please check your network connection.", 
        status: 503 
      };
    }
    
    return { error: "Internal Server Error", status: 500 };
  }
}
