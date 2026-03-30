export type GroupableInverter = {
  serial_number?: string;
  username?: string;
  description?: string;
  alias?: string;
  system_type?: string;
  location?: string;
};

export type UserInverterGroup = {
  groupKey: string;
  displayName: string;
  alias: string;
  groupType: "username" | "description" | "alias" | "unknown";
  inverterIds: string[];
  systemTypes: string[];
  location: string;
};

export function normalizeGroupToken(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pickGroupingBase(inverter: GroupableInverter): {
  value: string;
  type: UserInverterGroup["groupType"];
} {
  const alias = String(inverter.alias ?? "").trim();
  if (alias) return { value: alias, type: "alias" };

  const username = String(inverter.username ?? "").trim();
  if (username) return { value: username, type: "username" };

  const description = String(inverter.description ?? "").trim();
  if (description) return { value: description, type: "description" };

  return { value: "unknown-user", type: "unknown" };
}

export function buildUserGroupKey(inverter: GroupableInverter): string {
  const { value } = pickGroupingBase(inverter);
  return normalizeGroupToken(value) || "unknown-user";
}

function pickDisplayName(inverter: GroupableInverter): string {
  // const alias = String(inverter.alias ?? "").trim();
  // if (alias) return alias;

  // const username = String(inverter.username ?? "").trim();
  // if (username) return username;

  const description = String(inverter.description ?? "").trim();
  if (description) return description;

  return "Unknown User";
}

function pickAlias(inverter: GroupableInverter): string {
  const alias = String(inverter.alias ?? "").trim();
  if (alias) return alias;
  return "Unknown Alias";
}

function normalizeSystemTypeLabel(value: string | undefined): string {
  const raw = String(value ?? "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  if (raw === "offgrid") return "offgrid";
  if (raw === "ongrid") return "ongrid";
  if (raw === "hybrid") return "hybrid";
  return "unknown";
}

function normalizeLocation(value: string | undefined): string {
  const location = String(value ?? "").trim();
  return location || "N/A";
}

export function groupInvertersByUser(
  inverters: GroupableInverter[],
): UserInverterGroup[] {
  const groups = new Map<string, UserInverterGroup>();

  for (const inverter of inverters) {
    const serial = String(inverter.serial_number ?? "").trim();
    if (!serial) continue;

    const { type } = pickGroupingBase(inverter);
    const groupKey = buildUserGroupKey(inverter);
    const displayName = pickDisplayName(inverter);
    const alias = pickAlias(inverter);
    const location = normalizeLocation(inverter.location);

    const existing = groups.get(groupKey);
    if (existing) {
      existing.inverterIds.push(serial);
      existing.systemTypes.push(normalizeSystemTypeLabel(inverter.system_type));
      if (
        existing.displayName === "Unknown User" &&
        displayName !== "Unknown User"
      ) {
        existing.displayName = displayName;
      }
      if (existing.location === "N/A" && location !== "N/A") {
        existing.location = location;
      }
      continue;
    }

    groups.set(groupKey, {
      groupKey,
      alias,
      displayName,
      groupType: type,
      inverterIds: [serial],
      systemTypes: [normalizeSystemTypeLabel(inverter.system_type)],
      location,
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      inverterIds: [...new Set(group.inverterIds)].sort((a, b) =>
        a.localeCompare(b),
      ),
      systemTypes: [...new Set(group.systemTypes)],
    }))
    .sort((a, b) => {
      const nameSort = a.displayName.localeCompare(b.displayName);
      if (nameSort !== 0) return nameSort;
      return a.groupKey.localeCompare(b.groupKey);
    });
}
