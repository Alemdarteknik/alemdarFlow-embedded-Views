import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { watchpowerKeys } from "@/lib/watchpower";
import { notFound } from "next/navigation";
import { transformInverterData } from "@/utils/transform-inverter-data";
import { groupInvertersByUser } from "@/utils/user-groups";
import DashboardUserClient from "./dashboard-user-client";

const FLASK_API_URL =
  process.env.FLASK_API_URL ||
  `http://localhost:${process.env.FLASK_API_PORT || 5000}`;

type ApiInverter = {
  serial_number?: string;
  username?: string;
  description?: string;
  alias?: string;
  system_type?: string;
};

async function fetchInverters() {
  try {
    const response = await fetch(`${FLASK_API_URL}/api/inverters`, {
      cache: "no-store",
    });
    if (!response.ok) return [] as ApiInverter[];
    const payload = await response.json();
    return Array.isArray(payload?.inverters) ? payload.inverters : [];
  } catch {
    return [] as ApiInverter[];
  }
}

async function fetchInverterData(serial: string) {
  try {
    const response = await fetch(`${FLASK_API_URL}/api/inverter/${serial}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const rawData = await response.json();
    const result = transformInverterData(rawData);
    return result.data;
  } catch {
    return null;
  }
}

async function fetchDailyData(serial: string) {
  try {
    const response = await fetch(
      `${FLASK_API_URL}/api/inverter/${serial}/daily`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;
    const result = await response.json();
    if (result.success && result.rows) return result;
    return null;
  } catch {
    return null;
  }
}

export default async function UserDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ userKey: string }>;
  searchParams?: Promise<{ embed?: string }>;
}) {
  const { userKey } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const embed = resolvedSearchParams.embed === "1";

  const inverters = await fetchInverters();
  const groups = groupInvertersByUser(inverters);
  const targetGroup = groups.find((group) => group.groupKey === userKey);

  if (!targetGroup || targetGroup.inverterIds.length === 0) {
    notFound();
  }

  const [apiEntries, dailyEntries] = await Promise.all([
    Promise.all(
      targetGroup.inverterIds.map(
        async (id): Promise<[string, Awaited<ReturnType<typeof fetchInverterData>>]> => [
          id,
          await fetchInverterData(id),
        ],
      ),
    ),
    Promise.all(
      targetGroup.inverterIds.map(
        async (id): Promise<[string, Awaited<ReturnType<typeof fetchDailyData>>]> => [
          id,
          await fetchDailyData(id),
        ],
      ),
    ),
  ]);

  const queryClient = getQueryClient();

  for (const [id, apiData] of apiEntries) {
    queryClient.setQueryData(watchpowerKeys.inverter(id), apiData);
  }

  for (const [id, dailyData] of dailyEntries) {
    queryClient.setQueryData(watchpowerKeys.inverterDaily(id), dailyData);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardUserClient
        userKey={targetGroup.groupKey}
        userDisplayName={targetGroup.displayName}
        inverterIds={targetGroup.inverterIds}
        embed={embed}
      />
    </HydrationBoundary>
  );
}
