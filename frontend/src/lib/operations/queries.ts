/**
 * React Query hooks and query options for operations.
 */

import { getApiBaseUrl } from "@/lib/api-proxy";
import type {
  CostingEstimateRequest,
  CostingEstimateResponse,
  OperationValidation,
  CostLibrary,
  CostLibraryType,
  CostLibraryModule,
  HealthStatus,
  AssetPropertyOverrides,
  NetworkSource,
} from "./types";

// ============================================================================
// API Functions
// ============================================================================

/**
 * Run a costing estimate for a network.
 * The request.source can be either:
 * - { type: "data", network: { groups, branches } } for in-memory data
 * - { type: "networkId", networkId: "preset1" } to load from files
 */
export async function runCostingEstimate(
  request: CostingEstimateRequest
): Promise<CostingEstimateResponse> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/operations/costing/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message || error.error || `Request failed with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Create a NetworkSource from a network ID.
 * @deprecated Use getNetworkSourceFromCollections() from flow.ts for user-modified data
 */
export function createNetworkSource(networkId: string): NetworkSource {
  return { type: "networkId", networkId };
}

/**
 * Validate a network for costing readiness.
 * Accepts a NetworkSource (either inline data or networkId reference).
 */
export async function validateCostingNetworkWithSource(
  source: NetworkSource,
  libraryId: string
): Promise<OperationValidation> {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/operations/costing/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, libraryId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message || error.error || `Request failed with status ${response.status}`
    );
  }

  return response.json();
}

/**
 * Validate a network for costing readiness (legacy - uses networkId).
 * @deprecated Use validateCostingNetworkWithSource with getNetworkSourceFromCollections()
 */
export async function validateCostingNetwork(
  networkPathOrId: string,
  libraryId: string
): Promise<OperationValidation> {
  const source = createNetworkSource(networkPathOrId);
  return validateCostingNetworkWithSource(source, libraryId);
}

/**
 * List available cost libraries.
 */
export async function listCostLibraries(): Promise<CostLibrary[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/operations/costing/libraries`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message || error.error || `Request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  // Backend returns array of strings, convert to objects
  const libraries: string[] = data.libraries;
  return libraries.map((id) => ({ id, name: id }));
}

/**
 * Get types available in a cost library.
 */
export async function getCostLibraryTypes(
  libraryId: string
): Promise<CostLibraryType[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/operations/costing/libraries/${encodeURIComponent(libraryId)}/modules`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message || error.error || `Request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  return data.types;
}

/**
 * Get modules for a specific type in a cost library.
 */
export async function getCostLibraryModules(
  libraryId: string,
  type: string
): Promise<CostLibraryModule[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/operations/costing/libraries/${encodeURIComponent(libraryId)}/modules?type=${encodeURIComponent(type)}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: "Unknown error",
      status: response.status,
    }));
    throw new Error(
      error.message || error.error || `Request failed with status ${response.status}`
    );
  }

  const data = await response.json();
  return data.modules;
}

/**
 * Check costing server health.
 */
export async function checkCostingHealth(): Promise<HealthStatus> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/operations/costing/health`);

  // Health endpoint always returns JSON, even on error
  return response.json();
}

// ============================================================================
// React Query Options
// ============================================================================

/**
 * Query options for costing validation.
 * Accepts either a filesystem path or a network ID.
 */
export function costingValidationQueryOptions(
  networkPathOrId: string,
  libraryId: string
) {
  return {
    queryKey: ["costing", "validation", networkPathOrId, libraryId] as const,
    queryFn: () => validateCostingNetwork(networkPathOrId, libraryId),
    staleTime: 1000 * 30, // 30 seconds
    enabled: !!networkPathOrId && !!libraryId,
  };
}

/**
 * Query options for listing cost libraries.
 */
export function costLibrariesQueryOptions() {
  return {
    queryKey: ["costing", "libraries"] as const,
    queryFn: () => listCostLibraries(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  };
}

/**
 * Query options for cost library types.
 */
export function costLibraryTypesQueryOptions(libraryId: string) {
  return {
    queryKey: ["costing", "libraries", libraryId, "types"] as const,
    queryFn: () => getCostLibraryTypes(libraryId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!libraryId,
  };
}

/**
 * Query options for cost library modules.
 */
export function costLibraryModulesQueryOptions(libraryId: string, type: string) {
  return {
    queryKey: ["costing", "libraries", libraryId, "modules", type] as const,
    queryFn: () => getCostLibraryModules(libraryId, type),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!libraryId && !!type,
  };
}

/**
 * Query options for costing health check.
 */
export function costingHealthQueryOptions() {
  return {
    queryKey: ["costing", "health"] as const,
    queryFn: () => checkCostingHealth(),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 1000 * 30, // Refetch every 30 seconds
  };
}

// ============================================================================
// Mutation helpers
// ============================================================================

/**
 * Create a costing estimate request with a NetworkSource.
 * Use getNetworkSourceFromCollections() from flow.ts to get the source with user modifications.
 */
export function createCostingRequestWithSource(options: {
  source: NetworkSource;
  libraryId: string;
  targetCurrency?: string;
  assetDefaults?: AssetPropertyOverrides;
  assetOverrides?: Record<string, AssetPropertyOverrides>;
}): CostingEstimateRequest {
  return {
    source: options.source,
    libraryId: options.libraryId,
    targetCurrency: options.targetCurrency,
    assetDefaults: options.assetDefaults,
    assetOverrides: options.assetOverrides,
  };
}

/**
 * Create a costing estimate request.
 * @deprecated Use createCostingRequestWithSource with getNetworkSourceFromCollections()
 */
export function createCostingRequest(options: {
  networkPathOrId: string;
  libraryId: string;
  targetCurrency?: string;
  assetDefaults?: AssetPropertyOverrides;
  assetOverrides?: Record<string, AssetPropertyOverrides>;
}): CostingEstimateRequest {
  return {
    source: createNetworkSource(options.networkPathOrId),
    libraryId: options.libraryId,
    targetCurrency: options.targetCurrency,
    assetDefaults: options.assetDefaults,
    assetOverrides: options.assetOverrides,
  };
}
