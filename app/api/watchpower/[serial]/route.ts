import { NextResponse } from "next/server";
import { transformInverterData } from "@/utils/transform-inverter-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const FLASK_API_URL = process.env.FLASK_API_URL;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serial: string }> },
) {
  const { serial } = await params;
  // console.log("Fetching data for inverter serial:", serial);

  try {
    const response = await fetch(`${FLASK_API_URL}/api/inverter/${serial}`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Inverter not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch inverter data from Flask API" },
        { status: response.status },
      );
    }

    const data = await response.json();
    const transformedData = transformInverterData(data);
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error(`Error fetching data for inverter ${serial}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
