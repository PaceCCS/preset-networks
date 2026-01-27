/**
 * Types for operations and their results.
 * These mirror the backend types for the frontend.
 */

// ============================================================================
// Operation Registry Types
// ============================================================================

/**
 * Definition of an available operation.
 */
export type Operation = {
  /** Unique operation ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this operation does */
  description: string;

  /** Schema version to validate against (e.g., "v1.0-costing") */
  schemaVersion: string;

  /** API endpoint path (e.g., "/api/operations/costing/estimate") */
  endpoint: string;

  /** Validation endpoint path */
  validateEndpoint: string;

  /** Health check endpoint path */
  healthEndpoint?: string;
};

/**
 * Validation result for an operation.
 */
export type OperationValidation = {
  /** Whether the network is ready for this operation */
  isReady: boolean;

  /** Summary of what can be costed */
  summary: {
    assetCount: number;
    totalBlocks: number;
    costableBlocks: number;
    unmappedBlocks: number;
  };

  /** Per-asset validation info */
  assets: AssetValidation[];
};

export type BlockValidation = {
  id: string;
  type: string;
  status: "costable" | "missing_properties" | "not_costable" | "unknown";
  /** Properties defined on this block */
  definedProperties: Record<string, unknown>;
  /** Properties required but missing */
  missingProperties: string[];
  /** Module type (if costable) */
  moduleType?: string;
  moduleSubtype?: string;
};

export type AssetValidation = {
  id: string;
  name?: string;
  isGroup: boolean;
  /** Total blocks in this asset */
  blockCount: number;
  /** Number of blocks that can be costed */
  costableBlockCount: number;
  /** Which asset-level properties are using defaults */
  usingDefaults: string[];
  /** Per-block validation */
  blocks: BlockValidation[];
};

// ============================================================================
// Costing Types (mirroring backend request-types.ts)
// ============================================================================

/**
 * Timeline for asset operations.
 */
export type Timeline = {
  construction_start: number;
  construction_finish: number;
  operation_start: number;
  operation_finish: number;
  decommissioning_start: number;
  decommissioning_finish: number;
};

/**
 * Cost parameter with currency.
 */
export type CostParameter = {
  currency_code: string;
  amount: number;
};

/**
 * CAPEX Lang factors for cost estimation.
 */
export type CapexLangFactors = {
  equipment_erection: number;
  piping: number;
  instrumentation: number;
  electrical: number;
  buildings_and_process: number;
  utilities: number;
  storages: number;
  site_development: number;
  ancillary_buildings: number;
  design_and_engineering: number;
  contractors_fee: number;
  contingency: number;
};

/**
 * Fixed OPEX factors.
 */
export type FixedOpexFactors = {
  maintenance: number;
  control_room_facilities: number;
  insurance_liability: number;
  insurance_equipment_loss: number;
  cost_of_capital: number;
  major_turnarounds: number;
};

/**
 * Overridable asset-level properties for costing request.
 */
export type AssetPropertyOverrides = {
  timeline?: Partial<Timeline>;
  labour_average_salary?: CostParameter;
  fte_personnel?: number;
  asset_uptime?: number;
  discount_rate?: number;
  capex_lang_factors?: Partial<CapexLangFactors>;
  opex_factors?: Partial<FixedOpexFactors>;
};

/**
 * Block data for network operations.
 */
export type NetworkBlock = {
  type: string;
  quantity?: number;
  [key: string]: unknown;
};

/**
 * Branch data for network operations.
 */
export type NetworkBranch = {
  id: string;
  label?: string;
  parentId?: string;
  blocks: NetworkBlock[];
};

/**
 * Group data for network operations.
 */
export type NetworkGroup = {
  id: string;
  label?: string;
  branchIds: string[];
};

/**
 * Network data structure for inline operations.
 */
export type NetworkData = {
  groups: NetworkGroup[];
  branches: NetworkBranch[];
};

/**
 * Network source - either inline data or a network ID reference.
 */
export type NetworkSource =
  | { type: "networkId"; networkId: string }
  | { type: "data"; network: NetworkData };

/**
 * Request body for costing estimate.
 */
export type CostingEstimateRequest = {
  /** Network source - path to network directory or network ID */
  source: NetworkSource;

  /** Cost library to use (e.g., "V1.1_working") */
  libraryId: string;

  /** Target currency for results (e.g., "USD", "EUR") */
  targetCurrency?: string;

  /** Optional asset-level property overrides (applies to all assets) */
  assetDefaults?: AssetPropertyOverrides;

  /** Per-asset overrides keyed by group ID or branch ID */
  assetOverrides?: Record<string, AssetPropertyOverrides>;
};

// ============================================================================
// Costing Response Types
// ============================================================================

/**
 * Response from the costing estimate endpoint.
 */
export type CostingEstimateResponse = {
  /** Network ID */
  networkId: string;

  /** Network name (if available) */
  networkName?: string;

  /** Currency used for all amounts */
  currency: string;

  /** Network-level totals (undiscounted) */
  lifetimeCosts: LifetimeCosts;

  /** Network-level totals (discounted - Net Present Cost) */
  lifetimeNpcCosts: LifetimeCosts;

  /** Per-asset results */
  assets: AssetCostResult[];

  /** IDs of assets that used all defaults */
  assetsUsingDefaults: string[];
};

/**
 * Cost breakdown for an asset.
 */
export type AssetCostResult = {
  /** Asset ID (group ID or branch ID) */
  id: string;

  /** Asset name */
  name?: string;

  /** Whether this asset used default properties */
  isUsingDefaults: boolean;

  /** Which properties used defaults */
  propertiesUsingDefaults: string[];

  /** Lifetime costs (undiscounted) */
  lifetimeCosts: LifetimeCosts;

  /** Lifetime NPC (discounted) */
  lifetimeNpcCosts: LifetimeCosts;

  /** Per-block costs */
  blocks: BlockCostResult[];
};

/**
 * Cost breakdown for a block (module).
 */
export type BlockCostResult = {
  /** Block ID */
  id: string;

  /** Block type (e.g., "CaptureUnit") */
  blockType: string;

  /** Block subtype */
  subtype?: string;

  /** Module reference in cost library */
  moduleRef: string;

  /** Quantity */
  quantity: number;

  /** Direct equipment cost */
  directEquipmentCost: number;

  /** Total installed cost */
  totalInstalledCost: number;
};

/**
 * Lifetime cost breakdown.
 */
export type LifetimeCosts = {
  directEquipmentCost: number;
  langFactoredCapitalCost: LangFactoredCosts;
  totalInstalledCost: number;
  fixedOpexCost: FixedOpexCosts;
  variableOpexCost: VariableOpexCosts;
  decommissioningCost: number;
};

/**
 * Lang-factored capital cost breakdown.
 */
export type LangFactoredCosts = {
  equipmentErection: number;
  piping: number;
  instrumentation: number;
  electrical: number;
  buildingsAndProcess: number;
  utilities: number;
  storages: number;
  siteDevelopment: number;
  ancillaryBuildings: number;
  designAndEngineering: number;
  contractorsFee: number;
  contingency: number;
};

/**
 * Fixed OPEX cost breakdown.
 */
export type FixedOpexCosts = {
  maintenance: number;
  controlRoomFacilities: number;
  insuranceLiability: number;
  insuranceEquipmentLoss: number;
  costOfCapital: number;
  majorTurnarounds: number;
  labourCost: number;
};

/**
 * Variable OPEX cost breakdown.
 */
export type VariableOpexCosts = {
  electricity: number;
  naturalGas: number;
  water: number;
  other: number;
};

// ============================================================================
// Cost Library Types
// ============================================================================

export type CostLibrary = {
  id: string;
  name: string;
};

export type CostLibraryModule = {
  id: string;
  subtype: string;
  requiredParameters: string[];
};

export type CostLibraryType = {
  type: string;
  subtypes: string[];
  moduleCount: number;
};

// ============================================================================
// Health Check Types
// ============================================================================

export type HealthStatus = {
  status: "ok" | "degraded" | "error";
  costingServer?: string;
  snapshotServer?: string;
  serverStatus: "reachable" | "unhealthy" | "unreachable";
  statusCode?: number;
  message?: string;
};

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Unit value wrapper - a value with its unit specified.
 * e.g., { "bara": 35 } or { "celsius": 55 } or { "mtpa": 1.7 }
 */
export type UnitValue = {
  [unit: string]: number | boolean;
};

/**
 * Conditions are a flat map of pipe-separated keys to unit values.
 * Key format: "componentType|componentId|property"
 */
export type SnapshotConditions = Record<string, UnitValue>;

/**
 * Request body for snapshot run.
 */
export type SnapshotRequest =
  | {
      type: "direct";
      conditions: SnapshotConditions;
      includeAllPipes?: boolean;
    }
  | {
      type: "network";
      networkId: string;
      conditionOverrides?: SnapshotConditions;
      includeAllPipes?: boolean;
    };

/**
 * Fluid properties at a point in the network.
 */
export type FluidProperties = {
  pressure?: {
    pascal: number;
    bara: number;
    psi: number;
    barg: number;
    psf: number;
  };
  temperature?: {
    kelvin: number;
    celsius: number;
  };
  flowrate?: {
    kgps: number;
    mtpa: number;
    kgPerDay: number;
    tonnePerHour: number;
  };
  density?: {
    kgPerM3: number;
    lbPerFt3: number;
  };
  viscosity?: {
    pascalSecond: number;
  };
  vapourFraction?: {
    scalar: number;
  };
  composition?: Record<string, { molFraction: number; molPercent: number }>;
};

/**
 * Component result in the response.
 */
export type SnapshotComponentResult = {
  id: string;
  type: string;
  enabled?: boolean;
  inlet?: FluidProperties;
  outlet?: FluidProperties;
  workDone?: {
    watts: number;
    kiloWatts: number;
    joulesPerSecond: number;
  };
  duty?: {
    watts: number;
    kiloWatts: number;
    joulesPerSecond: number;
  };
};

/**
 * Thresholds from the response.
 */
export type SnapshotThresholds = {
  maxWaterContentInPipeline?: { molFraction: number; molPercent: number };
  minTemperatureInPipeline?: { kelvin: number; celsius: number };
  maxPressureInOffshorePipeline?: { pascal: number; bara: number };
  maxPressureInOnshore?: { pascal: number; bara: number };
  temperatureInWell?: { kelvin: number; celsius: number };
  corrosionPotential?: 0 | 1 | 2;
};

/**
 * Response from the snapshot run endpoint.
 */
export type SnapshotResponse = {
  success: boolean;
  components: SnapshotComponentResult[];
  thresholds?: SnapshotThresholds;
  metadata?: Record<string, unknown>;
  report?: string;
  error?: {
    type?: string;
    message?: string;
    severity?: string;
    errorCode?: string;
  };
  validation?: SnapshotValidation;
};

// ============================================================================
// Snapshot Validation Types
// ============================================================================

/**
 * Status of an extracted condition.
 */
export type ConditionStatus = "extracted" | "missing" | "default";

/**
 * A single extracted condition with validation metadata.
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
 * Validation result for a single component.
 */
export type SnapshotComponentValidation = {
  componentType: string;
  componentId: string;
  label?: string;
  sourceBlockId: string;
  conditions: ExtractedCondition[];
  extractedCount: number;
  missingCount: number;
};

/**
 * Overall snapshot validation result.
 */
export type SnapshotValidation = {
  isReady: boolean;
  summary: {
    componentCount: number;
    totalConditions: number;
    extractedConditions: number;
    missingConditions: number;
  };
  components: SnapshotComponentValidation[];
};
