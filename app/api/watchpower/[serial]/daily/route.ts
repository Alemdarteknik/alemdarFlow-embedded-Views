import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const FLASK_API_URL = process.env.FLASK_API_URL;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ serial: string }> },
) {
  const { serial } = await params;

  try {
    const response = await fetch(
      `${FLASK_API_URL}/api/inverter/${serial}/daily`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "No daily data found for this inverter" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch daily data from Flask API" },
        { status: response.status },
      );
    }

    const data = await response.json();
    // console.log(`Daily data for inverter ${serial}:`, data);
    return NextResponse.json(data);
  } catch (error) {
    // console.error(`Error fetching daily data for inverter ${serial}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
