import type { NetworkData } from "./effectValidation";

type TomlFiles = {
  files: Record<string, string>; // { "branch-1.toml": "...", "group-1.toml": "..." }
  configContent: string | null;
};

/**
 * Convert a JavaScript value to a TOML-compatible string representation.
 */
function toTomlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '""'; // Empty string for null/undefined
  }
  if (typeof value === "string") {
    // Escape backslashes and quotes in strings
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    // Arrays of primitives
    const items = value.map((v) => toTomlValue(v)).join(", ");
    return `[${items}]`;
  }
  // For objects, we'll handle them separately (inline tables or sections)
  return JSON.stringify(value);
}

/**
 * Convert a simple object to TOML key-value pairs.
 * Does not handle nested objects beyond inline tables.
 */
function objectToTomlLines(
  obj: Record<string, unknown>,
  excludeKeys: string[] = []
): string[] {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (excludeKeys.includes(key)) continue;
    if (value === undefined || value === null) continue;

    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      value !== null
    ) {
      // For nested objects, create a [section]
      lines.push("");
      lines.push(`[${key}]`);
      const nested = value as Record<string, unknown>;
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        if (nestedValue !== undefined && nestedValue !== null) {
          lines.push(`${nestedKey} = ${toTomlValue(nestedValue)}`);
        }
      }
    } else {
      lines.push(`${key} = ${toTomlValue(value)}`);
    }
  }

  return lines;
}

/**
 * Convert a block to TOML [[block]] format.
 */
function blockToToml(block: Record<string, unknown>): string[] {
  const lines: string[] = ["[[block]]"];

  // Order: type first, then other properties
  if (block.type !== undefined) {
    lines.push(`type = ${toTomlValue(block.type)}`);
  }

  for (const [key, value] of Object.entries(block)) {
    if (key === "type") continue; // Already added
    if (value === undefined || value === null) continue;

    if (
      typeof value === "object" &&
      !Array.isArray(value) &&
      value !== null
    ) {
      // Nested object in block - use inline table or skip
      // For now, skip complex nested objects in blocks
      continue;
    }

    lines.push(`${key} = ${toTomlValue(value)}`);
  }

  return lines;
}

/**
 * Convert inline NetworkData to TOML files format that WASM expects.
 *
 * This converts:
 * - Each group to a separate TOML file (group-id.toml)
 * - Each branch to a separate TOML file (branch-id.toml)
 * - Global defaults to config.toml [properties] section
 */
export function networkDataToTomlFiles(network: NetworkData): TomlFiles {
  const files: Record<string, string> = {};

  // Convert each group to TOML
  for (const group of network.groups) {
    const { id, label, branchIds, ...extra } = group;
    const lines: string[] = [];

    lines.push('type = "labeledGroup"');
    lines.push(`id = ${toTomlValue(id)}`);
    if (label !== undefined) {
      lines.push(`label = ${toTomlValue(label)}`);
    }

    // Add any extra group-level properties (for inheritance)
    // Skip branchIds as those are implicit from branch parentId
    const extraLines = objectToTomlLines(extra as Record<string, unknown>, [
      "id",
      "label",
      "branchIds",
      "type",
    ]);
    lines.push(...extraLines);

    files[`${id}.toml`] = lines.join("\n");
  }

  // Convert each branch to TOML
  for (const branch of network.branches) {
    const { id, label, parentId, blocks, ...extra } = branch;
    const lines: string[] = [];

    lines.push('type = "branch"');
    lines.push(`id = ${toTomlValue(id)}`);
    if (label !== undefined) {
      lines.push(`label = ${toTomlValue(label)}`);
    }
    if (parentId !== undefined) {
      lines.push(`parent_id = ${toTomlValue(parentId)}`);
    }

    // Add any extra branch-level properties (for inheritance)
    const extraLines = objectToTomlLines(extra as Record<string, unknown>, [
      "id",
      "label",
      "parentId",
      "parent_id",
      "blocks",
      "type",
    ]);
    lines.push(...extraLines);

    // Add blocks as [[block]] arrays
    if (blocks && blocks.length > 0) {
      lines.push(""); // Empty line before blocks
      for (const block of blocks) {
        const blockLines = blockToToml(block as Record<string, unknown>);
        lines.push(...blockLines);
        lines.push(""); // Empty line between blocks
      }
    }

    files[`${id}.toml`] = lines.join("\n");
  }

  // Convert defaults to config.toml [properties] section
  let configContent: string | null = null;
  if (network.defaults && Object.keys(network.defaults).length > 0) {
    const lines: string[] = ["[properties]"];
    for (const [key, value] of Object.entries(network.defaults)) {
      if (value !== undefined && value !== null) {
        lines.push(`${key} = ${toTomlValue(value)}`);
      }
    }
    configContent = lines.join("\n");
  }

  return { files, configContent };
}
