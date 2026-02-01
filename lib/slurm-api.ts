import { env } from "process";

type SlurmApiType = 'slurm' | 'slurmdb';

interface FetchSlurmOptions {
  type?: SlurmApiType;
  revalidate?: number;
  method?: string;
  body?: any;
}

export async function fetchSlurmData(endpoint: string, options: FetchSlurmOptions | SlurmApiType = {}) {
  // Handle backward compatibility or simple string usage
  const finalOptions: FetchSlurmOptions = typeof options === 'string' 
    ? { type: options } 
    : options;

  const { type = 'slurm', method = 'GET', body } = finalOptions;
  
  const protocol = env.SLURM_PROTOCOL || 'http';
  const baseUrl = `${protocol}://${env.SLURM_SERVER}:6820/${type}/${env.SLURM_API_VERSION}`;
  
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
    const res = await fetch(`${baseUrl}${endpoint}`, fetchOptions);

    if (!res.ok) {
      return { error: res.statusText, status: res.status };
    }

    const data = await res.json();
    return { data };
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    
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
