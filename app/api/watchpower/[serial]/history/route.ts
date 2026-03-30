import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const FLASK_API_URL = process.env.FLASK_API_URL;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serial: string }> },
) {
  const { serial } = await params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");

  try {
    const url = `${FLASK_API_URL}/api/inverter/${serial}/history${
      limit ? `?limit=${limit}` : ""
    }`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "No historical data found for this inverter" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch historical data from Flask API" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching history for inverter ${serial}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
