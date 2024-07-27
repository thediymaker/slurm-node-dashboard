import { NextResponse } from 'next/server';
import { PrometheusDriver } from 'prometheus-query';

const prom = new PrometheusDriver({
    endpoint: `${process.env.PROMETHEUS_URL}` || "",
    baseURL: "/api/v1",
});

const loadQuery = 'node_load15'; // query to get the 15-minute load average
const unameQuery = 'node_uname_info'; // query to get node uname info
const end = new Date();
const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days 
const step = 15 * 60; // 15 minutes

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

        // Extract and format the data points
        const dataPoints = series.flatMap((serie) =>
            serie.values.map(({ time, value }) => ({
                time,
                value
            }))
        );

        return NextResponse.json({ status: 200, data: dataPoints });
    } catch (error) {
        console.error("Error:", error);
        return NextResponse.json({ status: 500, message: 'Internal Server Error' });
    }
}
