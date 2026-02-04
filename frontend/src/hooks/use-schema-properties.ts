import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-proxy";
import { useNetwork } from "@/contexts/network-context";
import { useOperationOptional } from "@/contexts/operation-context";

/**
 * Property metadata from the schema API
 */
export type PropertyMetadata = {
  block_type: string;
  property: string;
  required: boolean;
  type: "number" | "string" | "enum" | "boolean";
  title?: string;
  description?: string;
  dimension?: string;
  defaultUnit?: string;
  min?: number;
  max?: number;
  enumValues?: (string | number | boolean)[];
};

/**
 * Schema properties response - flattened format
 * Keys are paths like "branch-1/blocks/0/length"
 */
export type SchemaPropertiesResponse = Record<string, PropertyMetadata>;

/**
 * Fetch schema properties for a specific query path
 */
async function fetchSchemaProperties(
  networkId: string,
  queryPath: string,
  schemaVersion: string
): Promise<SchemaPropertiesResponse> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({
    network: networkId,
    q: queryPath,
    version: schemaVersion,
  });

  const response = await fetch(`${baseUrl}/api/schema/properties?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch schema properties: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Hook to fetch schema properties for a query path.
 * Uses networkId from NetworkContext and schemaVersion from OperationContext.
 *
 * @param queryPath - The query path (e.g., "branch-1/blocks/0")
 * @param options - Optional overrides and query options
 */
export function useSchemaProperties(
  queryPath: string,
  options?: {
    schemaVersion?: string;
    enabled?: boolean;
  }
) {
  const { networkId } = useNetwork();
  const operationContext = useOperationOptional();

  const schemaVersion =
    options?.schemaVersion ?? operationContext?.schemaVersion;

  return useQuery({
    queryKey: ["schema-properties", networkId, queryPath, schemaVersion],
    queryFn: () => {
      if (!schemaVersion) {
        throw new Error(
          "schemaVersion is required. Either provide it via options or use within an OperationProvider."
        );
      }
      return fetchSchemaProperties(networkId, queryPath, schemaVersion);
    },
    enabled: options?.enabled !== false && !!schemaVersion,
  });
}

/**
 * Extract block-level properties from schema properties response.
 * Groups properties by block path.
 */
export function groupPropertiesByBlock(
  properties: SchemaPropertiesResponse
): Record<string, Record<string, PropertyMetadata>> {
  const grouped: Record<string, Record<string, PropertyMetadata>> = {};

  for (const [path, metadata] of Object.entries(properties)) {
    // Path format: "branch-1/blocks/0/propertyName"
    // Extract block path: "branch-1/blocks/0"
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) continue;

    const blockPath = path.substring(0, lastSlash);
    const propertyName = path.substring(lastSlash + 1);

    if (!grouped[blockPath]) {
      grouped[blockPath] = {};
    }
    grouped[blockPath][propertyName] = metadata;
  }

  return grouped;
}

/**
 * Hook to fetch all schema properties for a network.
 * Uses networkId from NetworkContext and schemaVersion from OperationContext.
 */
export function useNetworkSchemaProperties(options?: {
  schemaVersion?: string;
  enabled?: boolean;
}) {
  const { networkId } = useNetwork();
  const operationContext = useOperationOptional();

  const schemaVersion =
    options?.schemaVersion ?? operationContext?.schemaVersion;

  return useQuery({
    queryKey: ["network-schema-properties", networkId, schemaVersion],
    queryFn: async () => {
      if (!schemaVersion) {
        throw new Error(
          "schemaVersion is required. Either provide it via options or use within an OperationProvider."
        );
      }

      const baseUrl = getApiBaseUrl();
      const params = new URLSearchParams({
        network: networkId,
        version: schemaVersion,
      });

      const response = await fetch(
        `${baseUrl}/api/schema/network/properties?${params}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch network schema properties: ${response.statusText}`
        );
      }

      return response.json() as Promise<SchemaPropertiesResponse>;
    },
    enabled: options?.enabled !== false && !!schemaVersion,
  });
}
