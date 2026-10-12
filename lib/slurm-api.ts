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

export async function fetchSlurmData(endpoint: string, options: FetchSlurmOptions | SlurmApiType = {}) {
  // Handle backward compatibility or simple string usage
  const finalOptions: FetchSlurmOptions = typeof options === 'string' 
    ? { type: options } 
    : options;

  const { type = 'slurm', method = 'GET', body } = finalOptions;
  
  const protocol = env.SLURM_PROTOCOL || 'http';
  const port = env.SLURM_SERVER_PORT || '6820';
  const baseUrl = `${protocol}://${env.SLURM_SERVER}:${port}/${type}/${env.SLURM_API_VERSION}`;
  
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
