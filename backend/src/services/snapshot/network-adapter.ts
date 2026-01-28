/**
 * Network to Snapshot Adapter
 *
 * Transforms network blocks into snapshot conditions for the Scenario Modeller API.
 */

import * as path from "path";
import * as fs from "fs/promises";
import { resolveNetworkPath } from "../../utils/network-path";
import {
  getEnrichedBlockFromValidation,
  type Block,
  validateNetworkBlocks,
  type NetworkSource,
} from "../effectValidation";
import dim from "../dim";
import { getDagger } from "../../utils/getDagger";
import { Conditions, UnitValue } from "./types";

// ============================================================================
// Types
// ============================================================================

export type NetworkData = {
  groups: NetworkGroup[];
  branches: NetworkBranch[];
};

export type NetworkGroup = {
  id: string;
  label?: string;
  branchIds: string[];
};

export type NetworkBranch = {
  id: string;
  label?: string;
  parentId?: string;
  blocks: NetworkBlock[];
  // Branch-level properties that can be inherited by blocks
  [key: string]: unknown;
};

export type NetworkBlock = {
  type: string;
  quantity?: number;
  label?: string;
  [key: string]: unknown;
};

/**
 * Validation status for a component condition.
 */
export type ConditionStatus = "extracted" | "missing" | "default";

/**
 * Extracted condition with validation metadata.
 */
export type ExtractedCondition = {
  key: string;
  value: UnitValue | null;
  status: ConditionStatus;
  property: string;
  unit: string;
  sourceBlockId?: string;
};

/**
 * Component validation result.
 */
export type ComponentValidation = {
  componentType: string;
  componentId: string;
  label?: string;
  sourceBlockId: string;
  conditions: ExtractedCondition[];
  extractedCount: number;
  missingCount: number;
};

/**
 * Result of transforming a network to snapshot conditions.
 */
export type SnapshotTransformResult = {
  conditions: Conditions;
  validation: {
    isReady: boolean;
    summary: {
      componentCount: number;
      totalConditions: number;
      extractedConditions: number;
      missingConditions: number;
    };
    components: ComponentValidation[];
  };
};

// ============================================================================
// Component Type Mapping
// ============================================================================

/**
 * Map block types to snapshot component types.
 */
const BLOCK_TYPE_TO_COMPONENT: Record<string, string> = {
  // Direct mappings
  Source: "source",
  Pipe: "pipe",
  Compressor: "compressorTrain",
  CompressorTrain: "compressorTrain",
  Cooler: "cooler",
  Heater: "heater",
  Pump: "pump",
  Valve: "valve",
  Well: "well",
  Reservoir: "reservoir",
  Scavenger: "scavenger",
  // Alternate names
  Emitter: "source",
  InjectionWell: "well",
};

/**
 * Required properties for each component type with their units.
 */
const COMPONENT_REQUIRED_PROPERTIES: Record<
  string,
  Array<{ property: string; unit: string; required: boolean }>
> = {
  source: [
    { property: "flowrate", unit: "mtpa", required: true },
    { property: "pressure", unit: "bara", required: true },
    { property: "temperature", unit: "celsius", required: true },
    { property: "enabled", unit: "boolean", required: false },
    // Composition fractions - these are optional but commonly used
    {
      property: "carbonDioxideFraction",
      unit: "molFraction",
      required: false,
    },
    { property: "nitrogenFraction", unit: "molFraction", required: false },
    { property: "waterFraction", unit: "molFraction", required: false },
    {
      property: "hydrogenSulfideFraction",
      unit: "molFraction",
      required: false,
    },
    {
      property: "carbonMonoxideFraction",
      unit: "molFraction",
      required: false,
    },
    { property: "argonFraction", unit: "molFraction", required: false },
    { property: "methaneFraction", unit: "molFraction", required: false },
    { property: "hydrogenFraction", unit: "molFraction", required: false },
    { property: "oxygenFraction", unit: "molFraction", required: false },
  ],
  compressorTrain: [
    { property: "enabled", unit: "boolean", required: false },
    { property: "isentropicEfficiency", unit: "scalar", required: false },
    { property: "outletTemperature", unit: "celsius", required: false },
    { property: "pressureDelta", unit: "bara", required: false },
    { property: "numberOfStages", unit: "scalar", required: false },
    { property: "maximumPressure", unit: "bara", required: false },
    { property: "minimumUpstreamPressure", unit: "bara", required: false },
    {
      property: "maximumOperatingTemperature",
      unit: "celsius",
      required: false,
    },
    { property: "mechanicalEfficiency", unit: "scalar", required: false },
  ],
  cooler: [
    { property: "enabled", unit: "boolean", required: false },
    { property: "outletTemperature", unit: "celsius", required: false },
    { property: "pressureDelta", unit: "bara", required: false },
  ],
  heater: [
    { property: "enabled", unit: "boolean", required: false },
    { property: "outletTemperature", unit: "celsius", required: false },
    { property: "pressureDelta", unit: "bara", required: false },
    { property: "isentropicEfficiency", unit: "scalar", required: false },
  ],
  pump: [
    { property: "enabled", unit: "boolean", required: false },
    { property: "isentropicEfficiency", unit: "scalar", required: false },
    { property: "maximumPressure", unit: "bara", required: false },
    { property: "minimumUpstreamPressure", unit: "bara", required: false },
    {
      property: "maximumOperatingTemperature",
      unit: "celsius",
      required: false,
    },
  ],
  valve: [
    { property: "minimumUpstreamPressure", unit: "bara", required: false },
  ],
  well: [{ property: "wellCount", unit: "scalar", required: false }],
  reservoir: [
    { property: "enabled", unit: "boolean", required: false },
    { property: "pressure", unit: "bara", required: true },
  ],
  scavenger: [{ property: "enabled", unit: "boolean", required: false }],
  pipe: [
    { property: "length", unit: "meters", required: true },
    { property: "diameter", unit: "meters", required: true },
    { property: "uValue", unit: "wPerM2K", required: true },
    { property: "ambientTemperature", unit: "celsius", required: true },
  ],
};

/**
 * Default values for optional properties.
 */
const DEFAULT_VALUES: Record<string, Record<string, UnitValue>> = {
  source: {
    enabled: { boolean: true },
  },
  compressorTrain: {
    enabled: { boolean: true },
    isentropicEfficiency: { scalar: 0.85 },
    mechanicalEfficiency: { scalar: 1 },
  },
  cooler: {
    enabled: { boolean: true },
  },
  heater: {
    enabled: { boolean: true },
    isentropicEfficiency: { scalar: 1 },
    pressureDelta: { bara: 0 },
  },
  pump: {
    enabled: { boolean: true },
    isentropicEfficiency: { scalar: 0.85 },
  },
  reservoir: {
    enabled: { boolean: true },
  },
  scavenger: {
    enabled: { boolean: false },
  },
};

// ============================================================================
// Network Loading
// ============================================================================

type NetworkFiles = {
  files: Record<string, string>;
  configContent: string | null;
};

async function readNetworkFiles(networkPath: string): Promise<NetworkFiles> {
  const absolutePath = path.resolve(process.cwd(), networkPath);
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  const files: Record<string, string> = {};
  let configContent: string | null = null;

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".toml")) {
      const filePath = path.join(absolutePath, entry.name);
      const content = await fs.readFile(filePath, "utf-8");
      files[entry.name] = content;

      if (entry.name === "config.toml") {
        configContent = content;
      }
    }
  }

  return { files, configContent };
}

/**
 * Load network data from a source.
 */
async function loadNetworkData(
  source: NetworkSource,
): Promise<{ data: NetworkData; networkPath: string | null }> {
  if (source.type === "data") {
    return { data: source.network, networkPath: null };
  }

  const networkPath = resolveNetworkPath(source.networkId);
  const { files, configContent } = await readNetworkFiles(networkPath);
  const filesJson = JSON.stringify(files);
  const dagger = getDagger();

  const nodesResult = dagger.query_from_files(
    filesJson,
    configContent || undefined,
    "network/nodes",
  );
  const nodes: Array<{
    id: string;
    type?: string;
    label?: string;
    parentId?: string;
    blocks?: NetworkBlock[];
    data?: Record<string, unknown>;
    position?: { x: number; y: number };
  }> = JSON.parse(nodesResult);

  const rawGroups = nodes.filter(
    (n) => n.type === "labeledGroup" || n.type === "group",
  );
  const rawBranches = nodes.filter((n) => n.type === "branch");

  const groups: NetworkGroup[] = rawGroups.map((g) => ({
    id: g.id,
    label: (g.label as string) ?? (g.data?.label as string | undefined),
    branchIds: rawBranches.filter((b) => b.parentId === g.id).map((b) => b.id),
  }));

  const branches: NetworkBranch[] = rawBranches.map((b) => {
    // Extract all properties from the raw branch, including branch-level properties
    // like length, diameter, uValue, ambientTemperature that blocks can inherit
    const {
      id,
      type,
      label,
      parentId,
      blocks,
      data,
      position,
      ...branchProps
    } = b;
    return {
      ...branchProps,
      ...((data as Record<string, unknown>) ?? {}),
      id,
      label: label ?? (data?.label as string | undefined),
      parentId,
      blocks: blocks ?? [],
    };
  });

  return { data: { groups, branches }, networkPath };
}

// ============================================================================
// Property Extraction
// ============================================================================

/**
 * Property name mappings from block properties to snapshot properties.
 */
const PROPERTY_MAPPINGS: Record<string, string> = {
  // Common mappings
  efficiency: "isentropicEfficiency",
  outlet_temperature: "outletTemperature",
  pressure_delta: "pressureDelta",
  well_count: "wellCount",
  max_pressure: "maximumPressure",
  min_upstream_pressure: "minimumUpstreamPressure",
  max_operating_temperature: "maximumOperatingTemperature",
  num_stages: "numberOfStages",
  number_of_stages: "numberOfStages",
  co2_fraction: "carbonDioxideFraction",
  n2_fraction: "nitrogenFraction",
  h2o_fraction: "waterFraction",
  h2s_fraction: "hydrogenSulfideFraction",
  co_fraction: "carbonMonoxideFraction",
  ar_fraction: "argonFraction",
  ch4_fraction: "methaneFraction",
  h2_fraction: "hydrogenFraction",
  o2_fraction: "oxygenFraction",
};

/**
 * Get the snapshot property name for a block property.
 */
function mapPropertyName(blockProperty: string): string {
  // Check explicit mappings first
  if (PROPERTY_MAPPINGS[blockProperty]) {
    return PROPERTY_MAPPINGS[blockProperty];
  }

  // Convert snake_case to camelCase
  return blockProperty.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase(),
  );
}

/**
 * Map snapshot unit keys to dim-compatible unit strings for conversion.
 */
const UNIT_KEY_TO_DIM: Record<string, string> = {
  meters: "m",
  bara: "bar",
  celsius: "degC",
  mtpa: "mtpa",
  wPerM2K: "W/m^2*K",
  molFraction: "", // dimensionless
  scalar: "", // dimensionless
};

/**
 * Convert a block property value to a snapshot unit value using dim for unit conversion.
 */
function convertToUnitValue(value: unknown, unit: string): UnitValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (unit === "boolean") {
    if (typeof value === "boolean") {
      return { boolean: value };
    }
    if (typeof value === "number") {
      return { boolean: value !== 0 };
    }
    if (typeof value === "string") {
      return { boolean: value.toLowerCase() === "true" || value === "1" };
    }
    return null;
  }

  // For numeric values
  let numValue: number;

  if (typeof value === "number") {
    // Already a number, assume it's in the target unit
    numValue = value;
  } else if (typeof value === "string") {
    // Check if it's a unit string (has letters or degree symbol after the number)
    const hasUnits = /[a-zA-Z°]/.test(value);

    if (hasUnits) {
      // Use dim to convert to target unit
      const dimUnit = UNIT_KEY_TO_DIM[unit];
      if (dimUnit) {
        try {
          // Use "as" syntax: "10 km as m" returns "10000 m"
          const conversionExpr = `${value} as ${dimUnit}`;
          const result = dim.eval(conversionExpr);
          // Result is like "10000 m" - extract numeric part by splitting on space
          numValue = parseFloat(result.split(" ")[0]);
          if (isNaN(numValue)) {
            console.warn(
              `[Snapshot] dim.eval returned non-numeric: "${result}" for "${value}" -> ${unit}`,
            );
            return null;
          }
        } catch (error) {
          console.warn(
            `[Snapshot] Failed to convert "${value}" to ${unit}:`,
            error,
          );
          return null;
        }
      } else {
        // Dimensionless unit (scalar, molFraction) - just extract the number
        const match = value.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/);
        if (match) {
          numValue = parseFloat(match[1]);
        } else {
          return null;
        }
      }
    } else {
      // Plain numeric string
      numValue = parseFloat(value);
    }
  } else {
    return null;
  }

  if (isNaN(numValue)) {
    return null;
  }

  return { [unit]: numValue };
}

/**
 * Extract a component ID from a block.
 * Uses the same format as validation: branchId/blocks/index
 */
function getComponentId(
  block: NetworkBlock,
  branchId: string,
  blockIndex: number,
): string {
  // return `${branchId}/blocks/${blockIndex}`;
  return `${branchId}_blocks_${blockIndex}`;
}

/**
 * Extract conditions from a single block.
 */
function extractBlockConditions(
  block: NetworkBlock,
  componentType: string,
  componentId: string,
  branchId: string,
  blockIndex: number,
): ComponentValidation {
  const requiredProps = COMPONENT_REQUIRED_PROPERTIES[componentType] || [];
  const defaults = DEFAULT_VALUES[componentType] || {};
  const conditions: ExtractedCondition[] = [];
  const sourceBlockId = `${branchId}_blocks_${blockIndex}`;

  for (const propDef of requiredProps) {
    const key = `${componentType}|${componentId}|${propDef.property}`;

    // Try to find the property in the block
    const blockPropertyNames = [
      propDef.property,
      // Also try snake_case version
      propDef.property.replace(/([A-Z])/g, "_$1").toLowerCase(),
    ];

    let value: UnitValue | null = null;
    let status: ConditionStatus = "missing";

    for (const propName of blockPropertyNames) {
      const blockValue = block[propName];
      if (blockValue !== undefined && blockValue !== null) {
        value = convertToUnitValue(blockValue, propDef.unit);
        if (value !== null) {
          status = "extracted";
          break;
        }
      }
    }

    // Apply default if available and value is still missing
    if (value === null && defaults[propDef.property]) {
      value = defaults[propDef.property];
      status = "default";
    }

    // Only include if we have a value or it's required
    if (value !== null || propDef.required) {
      conditions.push({
        key,
        value,
        status,
        property: propDef.property,
        unit: propDef.unit,
        sourceBlockId,
      });
    }
  }

  // Also extract any additional properties from the block that look like fractions
  for (const [propName, propValue] of Object.entries(block)) {
    if (propName.endsWith("Fraction") || propName.endsWith("_fraction")) {
      const snapshotProp = mapPropertyName(propName);
      const key = `${componentType}|${componentId}|${snapshotProp}`;

      // Skip if already extracted
      if (conditions.some((c) => c.property === snapshotProp)) {
        continue;
      }

      const value = convertToUnitValue(propValue, "molFraction");
      if (value !== null) {
        conditions.push({
          key,
          value,
          status: "extracted",
          property: snapshotProp,
          unit: "molFraction",
          sourceBlockId,
        });
      }
    }
  }

  const extractedCount = conditions.filter(
    (c) => c.status === "extracted" || c.status === "default",
  ).length;
  const missingCount = conditions.filter((c) => c.status === "missing").length;

  return {
    componentType,
    componentId,
    label: block.label,
    sourceBlockId,
    conditions,
    extractedCount,
    missingCount,
  };
}

// ============================================================================
// Main Transform Function
// ============================================================================

/**
 * Transform a network into snapshot conditions.
 *
 * @param source - Network source (networkId or inline data)
 * @param schemaSet - Schema set to use for property resolution (default: "v1.0-snapshot")
 * @param baseNetworkId - Optional networkId to use for inheritance when source is inline data
 */
export async function transformNetworkToSnapshotConditions(
  source: NetworkSource,
  schemaSet: string = "v1.0-snapshot",
  baseNetworkId?: string,
): Promise<SnapshotTransformResult> {
  await dim.init();

  const { data: networkData } = await loadNetworkData(source);
  const { branches } = networkData;

  // Validate all blocks and get resolved properties (with inheritance)
  const validationResults = await validateNetworkBlocks(
    source,
    schemaSet,
    baseNetworkId,
  );

  const componentValidations: ComponentValidation[] = [];
  const conditions: Conditions = {};

  // Process all blocks from all branches
  for (const branch of branches) {
    for (let i = 0; i < branch.blocks.length; i++) {
      const rawBlock = branch.blocks[i];

      // Map block type to snapshot component type
      const componentType = BLOCK_TYPE_TO_COMPONENT[rawBlock.type];
      if (!componentType) {
        // Skip blocks that don't map to snapshot components
        continue;
      }

      // Get enriched block with inherited properties from validation results
      const enrichedBlock = getEnrichedBlockFromValidation(
        rawBlock as Block,
        validationResults,
        branch.id,
        i,
      );

      const componentId = getComponentId(enrichedBlock, branch.id, i);
      const validation = extractBlockConditions(
        enrichedBlock,
        componentType,
        componentId,
        branch.id,
        i,
      );

      componentValidations.push(validation);

      // Add extracted conditions to the conditions map
      for (const cond of validation.conditions) {
        if (cond.value !== null) {
          conditions[cond.key] = cond.value;
        }
      }
    }
  }

  // Calculate summary
  const totalConditions = componentValidations.reduce(
    (sum, v) => sum + v.conditions.length,
    0,
  );
  const extractedConditions = componentValidations.reduce(
    (sum, v) => sum + v.extractedCount,
    0,
  );
  const missingConditions = componentValidations.reduce(
    (sum, v) => sum + v.missingCount,
    0,
  );

  // Network is ready if we have at least some conditions and no critical missing ones
  const hasCriticalMissing = componentValidations.some((v) =>
    v.conditions.some((c) => c.status === "missing" && c.value === null),
  );

  return {
    conditions,
    validation: {
      isReady: extractedConditions > 0 && !hasCriticalMissing,
      summary: {
        componentCount: componentValidations.length,
        totalConditions,
        extractedConditions,
        missingConditions,
      },
      components: componentValidations,
    },
  };
}
