import { NextResponse } from "next/server";
import { InfluxDB } from "@influxdata/influxdb-client";

const url = process.env.INFLUX_URL || "";
const token = process.env.INFLUX_TOKEN || "";
const org = process.env.INFLUX_ORG || "";

const client = new InfluxDB({ url, token });

/** Specify the time range and window period explicitly in the query */
const fluxQuery =
  'from(bucket: "metrics")   |> range(start: -1d)   |> filter(fn: (r) => r["_measurement"] == "disk") |> filter(fn: (r) => r["_field"] == "free") |> filter(fn: (r) => r["device"] == "dm-0") |> last()';

export async function GET() {
  try {
    const usage = await client.getQueryApi(org).collectRows(fluxQuery);
    const valuesArray = usage.map((item: any) => Number(item._value));
    const value = (valuesArray[0] / (1024 * 1024 * 1024)).toPrecision(6); // Access the first element of the array

    return NextResponse.json({ usage }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);

    // If an error occurs, return a 500 status response
    return NextResponse.json("Internal Server Error", { status: 500 });
  }
}
