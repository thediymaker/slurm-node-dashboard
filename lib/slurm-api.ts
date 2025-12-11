type SlurmApiType = 'slurm' | 'slurmdb';
import { env } from "process";

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

  const { type = 'slurm', revalidate = 30, method = 'GET', body } = finalOptions;
  
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
    next: {
      revalidate,
    },
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
    return { error: "Internal Server Error", status: 500 };
  }
}
