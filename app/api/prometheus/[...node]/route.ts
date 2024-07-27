import { NextResponse } from 'next/server';
import { PrometheusDriver } from 'prometheus-query';

const prom = new PrometheusDriver({
    endpoint: `${process.env.PROMETHEUS_URL}` || "",
    baseURL: "/api/v1",
});

const loadQuery = 'node_load15'; // query to get the 5-minute load average
const unameQuery = 'node_uname_info'; // query to get node uname info
const end = new Date();
const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days 
const step = 15 * 60; // 1 hour

interface SampleValue {
    time: Date;
    value: number;
}

interface PrometheusQueryResponse {
    resultType: string;
    result: Array<{
        metric: {
            name: string;
            labels: Record<string, string>;
        };
        values: SampleValue[];
    }>;
}

interface HourlyAverage {
    date: string; // 'YYYY-MM-DD'
    hour: number; // 0-23
    averageLoad: number;
}

export async function GET(
    req: Request,
    { params }: { params: { node: string } }) {
    const { node } = params;

    try {
        // Query to get the instance IP address for the given nodename
        const unameRes: PrometheusQueryResponse = await prom.rangeQuery(
            `${unameQuery}{nodename="${node}"}`,
            start,
            end,
            step
        );
        console.log("Node Info Response:", unameRes);

        // Extract the instance IP from the uname query result
        const instance = unameRes.result[0]?.metric?.labels['instance'];

        if (!instance) {
            return NextResponse.json({ status: 404, message: 'No instance found for the specified node.' });
        }

        // Construct the Prometheus query with the instance IP address
        const query = `${loadQuery}{instance="${instance}"}`;
        console.log("Constructed Query:", query);

        const loadRes: PrometheusQueryResponse = await prom.rangeQuery(query, start, end, step);
        console.log("Load Query Response:", loadRes);

        const series = loadRes.result;

        if (series.length === 0) {
            console.log("No data returned for the query.");
            return NextResponse.json({ status: 404, message: 'No data found for the specified instance.' });
        }

        // Initialize a map to store hourly loads
        const hourlyLoads: Map<string, Map<number, number[]>> = new Map();

        series.forEach((serie) => {
            serie.values.forEach(({ time, value }) => {
                const date = time.toISOString().split('T')[0]; // 'YYYY-MM-DD'
                const hour = time.getUTCHours(); // 0-23

                if (!hourlyLoads.has(date)) {
                    hourlyLoads.set(date, new Map());
                }
                const dateMap = hourlyLoads.get(date)!;

                if (!dateMap.has(hour)) {
                    dateMap.set(hour, []);
                }
                dateMap.get(hour)!.push(value);
            });
        });

        // Calculate average load for each hour
        const averages: HourlyAverage[] = [];
        hourlyLoads.forEach((dateMap, date) => {
            dateMap.forEach((values, hour) => {
                const averageLoad = values.reduce((a, b) => a + b, 0) / values.length;
                averages.push({ date, hour, averageLoad });
            });
        });

        return NextResponse.json({ status: 200, data: averages });
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json({ status: 500, message: 'Internal Server Error' });
    }
}
