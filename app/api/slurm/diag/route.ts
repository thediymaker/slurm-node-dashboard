import { NextResponse } from "next/server";
import { env } from "process";
import log from 'loglevel';

if (process.env.NODE_ENV === 'development') {
  log.setLevel('trace');
} else {
  log.setLevel('trace'); // Temporarily set to 'trace' for debugging purposes
}

let cachedData: any = null;
let lastFetchTime = 0;
const cacheDuration = 30000; // 30 seconds

async function fetchData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    log.debug('Attempting to fetch data from SLURM server');
    const res = await fetch(
      `http://${env.SLURM_SERVER}:6820/slurm/${env.SLURM_API_VERSION}/diag`,
      {
        headers: {
          "X-SLURM-USER-NAME": "root",
          "X-SLURM-USER-TOKEN": `${env.SLURM_API_TOKEN}`,
        },
        signal: controller.signal,
        next: {
          revalidate: 30,
        }
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) {
      log.error(`Error fetching data: ${res.statusText}`);
      throw new Error(`Error fetching data: ${res.statusText}`);
    }

    const data = await res.json();
    cachedData = data;
    lastFetchTime = Date.now();
    log.debug('Data fetched successfully:');
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    log.error('Fetch error:', error);
    throw error;
  }
}

export async function GET() {
  const currentTime = Date.now();
  log.debug('GET request received at', new Date(currentTime).toISOString());

  if (cachedData && (currentTime - lastFetchTime) < cacheDuration) {
    log.debug('Returning cached data');
    return NextResponse.json(cachedData);
  }

  try {
    const data = await fetchData();
    log.info('Returning fetched data');
    return NextResponse.json(data);
  } catch (error) {
    if (cachedData) {
      log.warn('Failed to fetch data, returning cached data');
      return NextResponse.json(cachedData);
    }
    log.error('Failed to fetch data and no cached data available');
    return NextResponse.json({ error: 'Failed to fetch data and no cached data available' }, { status: 500 });
  }
}
