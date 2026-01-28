/**
 * Operations module
 *
 * Provides the operation registry, types, and query functions for
 * running operations like costing on networks.
 */

// Types
export type {
  Operation,
  OperationValidation,
  AssetValidation,
  BlockValidation,
  Timeline,
  CostParameter,
  CapexLangFactors,
  FixedOpexFactors,
  AssetPropertyOverrides,
  NetworkSource,
  CostingEstimateRequest,
  CostingEstimateResponse,
  AssetCostResult,
  BlockCostResult,
  LifetimeCosts,
  LangFactoredCosts,
  FixedOpexCosts,
  VariableOpexCosts,
  CostLibrary,
  CostLibraryModule,
  CostLibraryType,
  HealthStatus,
  // Snapshot types
  UnitValue,
  SnapshotConditions,
  SnapshotRequest,
  SnapshotResponse,
  SnapshotComponentResult,
  SnapshotThresholds,
  FluidProperties,
  // Snapshot validation types
  ConditionStatus,
  ExtractedCondition,
  SnapshotComponentValidation,
  SnapshotValidation,
} from "./types";

// Registry
export { OPERATIONS, getOperation, getOperations, hasOperation } from "./registry";

// Queries and API functions
export {
  // Costing API functions
  runCostingEstimate,
  validateCostingNetwork,
  listCostLibraries,
  getCostLibraryTypes,
  getCostLibraryModules,
  checkCostingHealth,
  // Costing Query options
  costingValidationQueryOptions,
  costLibrariesQueryOptions,
  costLibraryTypesQueryOptions,
  costLibraryModulesQueryOptions,
  costingHealthQueryOptions,
  // Costing Helpers
  createCostingRequest,
  createNetworkSource,
  // Snapshot API functions
  validateSnapshotNetwork,
  runSnapshot,
  runSnapshotRaw,
  checkSnapshotHealth,
  // Snapshot Query options
  snapshotValidationQueryOptions,
  snapshotHealthQueryOptions,
  // Snapshot types
  type NetworkConditions,
} from "./queries";
