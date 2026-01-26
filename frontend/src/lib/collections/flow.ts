"use client";

import {
  createCollection,
  eq,
  liveQueryCollectionOptions,
  localStorageCollectionOptions,
} from "@tanstack/react-db";
import type { FlowNode, FlowEdge } from "./flow-nodes";
import { getNetwork, type NetworkResponse } from "@/lib/api-client";
import type { NetworkSource, NetworkData } from "@/lib/operations/types";

// Storage key for tracking which network is currently loaded
const LOADED_NETWORK_KEY = "flow:loadedNetworkId";

/**
 * Get z-index for node layering.
 * Geographic nodes at bottom, images above, everything else on top.
 */
function getNodeZIndex(nodeType: string): number {
  switch (nodeType) {
    case "geographicWindow":
    case "geographicAnchor":
      return -2; // Bottom layer
    case "image":
      return -1; // Above geographic
    default:
      return 0; // Top layer (branches, groups, etc.)
  }
}

/**
 * Sort nodes so parent nodes come before their children
 * ReactFlow requires this ordering when nodes have parentId
 * This must be called whenever nodes are read from collections
 * Also ensures z-index is applied for proper layering
 */
export function sortNodesWithParentsFirst(nodes: FlowNode[]): FlowNode[] {
  const nodeMap = new Map<string, FlowNode>();
  const sorted: FlowNode[] = [];
  const visited = new Set<string>();

  // Create a map for quick lookup
  nodes.forEach((node) => nodeMap.set(node.id, node));

  // Helper to add node and its ancestors
  const addNode = (node: FlowNode) => {
    if (visited.has(node.id)) return;

    // If node has a parent, add parent first
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        addNode(parent);
      }
    }

    // Add this node with z-index for layering
    sorted.push({
      ...node,
      zIndex: node.zIndex ?? getNodeZIndex(node.type),
    });
    visited.add(node.id);
  };

  // Add all nodes
  nodes.forEach((node) => addNode(node));

  return sorted;
}

export const nodesCollection = createCollection(
  localStorageCollectionOptions<FlowNode>({
    id: "flow:nodes",
    storageKey: "flow:nodes",
    getKey: (node) => node.id,
  })
);

export const findById = (nodeId: string) =>
  createCollection(
    liveQueryCollectionOptions({
      query: (q) =>
        q
          .from({ node: nodesCollection })
          .where(({ node }) => eq(node.id, nodeId))
          .findOne(),
    })
  );

export const edgesCollection = createCollection(
  localStorageCollectionOptions<FlowEdge>({
    id: "flow:edges",
    storageKey: "flow:edges",
    getKey: (edge) => edge.id,
  })
);

export const findEdgesBySource = (sourceId: string) =>
  createCollection(
    liveQueryCollectionOptions({
      query: (q) =>
        q
          .from({ edge: edgesCollection })
          .where(({ edge }) => eq(edge.source, sourceId)),
    })
  );

export const findEdgesByTarget = (targetId: string) =>
  createCollection(
    liveQueryCollectionOptions({
      query: (q) =>
        q
          .from({ edge: edgesCollection })
          .where(({ edge }) => eq(edge.target, targetId)),
    })
  );

// ---------------------------------------------------------------------------
// Network tracking helpers
// ---------------------------------------------------------------------------

/**
 * Get the ID of the currently loaded network
 */
export function getLoadedNetworkId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOADED_NETWORK_KEY);
}

/**
 * Set the ID of the currently loaded network
 */
function setLoadedNetworkId(networkId: string | null): void {
  if (typeof window === "undefined") return;
  if (networkId) {
    localStorage.setItem(LOADED_NETWORK_KEY, networkId);
  } else {
    localStorage.removeItem(LOADED_NETWORK_KEY);
  }
}

/**
 * Check if a specific network is already loaded in collections
 */
export function isNetworkLoaded(networkId: string): boolean {
  return getLoadedNetworkId() === networkId;
}

/**
 * Clear all data from flow collections
 * Uses delete mutations so subscribers update immediately
 */
export async function clearFlowCollections(): Promise<void> {
  await Promise.all([nodesCollection.preload(), edgesCollection.preload()]);

  const edgeKeys = Array.from(edgesCollection.keys()) as string[];
  if (edgeKeys.length) {
    const delTx = edgesCollection.delete(edgeKeys);
    await delTx.isPersisted.promise;
  }

  const nodeKeys = Array.from(nodesCollection.keys()) as string[];
  if (nodeKeys.length) {
    const delTx = nodesCollection.delete(nodeKeys);
    await delTx.isPersisted.promise;
  }

  // Clear the loaded network tracker
  setLoadedNetworkId(null);
}

/**
 * Reset collections to a network response from the API
 * This ALWAYS clears and reloads, discarding any user changes.
 * Use loadPresetFromApi() for normal loading which skips if already loaded.
 *
 * @param network - The network response from API
 * @param networkId - The network ID to track as loaded
 */
export async function resetFlowToNetwork(
  network: NetworkResponse,
  networkId?: string
): Promise<void> {
  await Promise.all([nodesCollection.preload(), edgesCollection.preload()]);

  const edgeKeys = Array.from(edgesCollection.keys()) as string[];
  if (edgeKeys.length) {
    const delTx = edgesCollection.delete(edgeKeys);
    await delTx.isPersisted.promise;
  }

  const nodeKeys = Array.from(nodesCollection.keys()) as string[];
  if (nodeKeys.length) {
    const delTx = nodesCollection.delete(nodeKeys);
    await delTx.isPersisted.promise;
  }

  // Add ReactFlow properties and validate edges (same as loadPresetFromApi)
  const flowNodes: FlowNode[] = network.nodes.map((node) => {
    const flowNode: FlowNode = {
      ...node,
      width: node.width ?? undefined,
      height: node.height ?? undefined,
      parentId: node.parentId ?? undefined,
      // Preserve extent if it exists (needed for parent-child relationships)
      extent: node.extent === "parent" ? "parent" : undefined,
      // Image nodes are not draggable (they're static reference images)
      draggable: node.type !== "image",
      selectable: true,
      // Layer nodes: geographic at bottom, images above, everything else on top
      zIndex: getNodeZIndex(node.type),
    };
    return flowNode;
  });

  const validEdges = network.edges.filter((edge) => {
    const sourceNode = flowNodes.find((n) => n.id === edge.source);
    const targetNode = flowNodes.find((n) => n.id === edge.target);
    return (
      sourceNode?.type === "branch" &&
      targetNode?.type === "branch" &&
      edge.source !== edge.target
    );
  });

  // Sort nodes so parent nodes come before their children (ReactFlow requirement)
  const sortedNodes = sortNodesWithParentsFirst(flowNodes);

  const insNodesTx = nodesCollection.insert(sortedNodes);
  const insEdgesTx = edgesCollection.insert(validEdges);
  await Promise.all([
    insNodesTx.isPersisted.promise,
    insEdgesTx.isPersisted.promise,
  ]);

  // Track which network is loaded
  setLoadedNetworkId(networkId ?? network.id);
}

/**
 * Load a network into collections (if not already loaded)
 * Adds ReactFlow UI properties and validates edges
 * Skips loading if the same network is already in collections.
 *
 * @param networkOrId - NetworkResponse from API (or networkId to fetch)
 * @param forceReload - If true, always reload even if already loaded
 */
export async function loadPresetFromApi(
  networkOrId: string | NetworkResponse,
  forceReload = false
): Promise<void> {
  const networkId = typeof networkOrId === "string" ? networkOrId : networkOrId.id;

  // Skip if this network is already loaded (unless force reload)
  if (!forceReload && isNetworkLoaded(networkId)) {
    return;
  }

  // Get network data (either use provided or fetch)
  const network =
    typeof networkOrId === "string"
      ? await getNetwork(networkOrId)
      : networkOrId;

  // Use resetFlowToNetwork to handle the transformation and insertion
  await resetFlowToNetwork(network, networkId);
}

// ---------------------------------------------------------------------------
// Write helpers for ReactFlow integration
// ---------------------------------------------------------------------------

export function writeNodesToCollection(updated: FlowNode[]): void {
  const prevKeys = new Set<string>(
    Array.from(nodesCollection.keys()) as string[]
  );
  const updatedKeys = new Set<string>(updated.map((n) => n.id));

  const toDelete: string[] = [];
  prevKeys.forEach((k) => {
    if (!updatedKeys.has(k)) toDelete.push(k);
  });
  if (toDelete.length) nodesCollection.delete(toDelete);

  updated.forEach((node) => {
    if (nodesCollection.has(node.id)) {
      nodesCollection.update(node.id, (draft) => {
        Object.assign(draft, node);
      });
    } else {
      nodesCollection.insert(node);
    }
  });
}

export function writeEdgesToCollection(updated: FlowEdge[]): void {
  const prevKeys = new Set<string>(
    Array.from(edgesCollection.keys()) as string[]
  );
  const updatedKeys = new Set<string>(updated.map((e) => e.id));

  const toDelete: string[] = [];
  prevKeys.forEach((k) => {
    if (!updatedKeys.has(k)) toDelete.push(k);
  });
  if (toDelete.length) edgesCollection.delete(toDelete);

  updated.forEach((edge) => {
    if (edgesCollection.has(edge.id)) {
      edgesCollection.update(edge.id, (draft) => {
        Object.assign(draft, edge);
      });
    } else {
      edgesCollection.insert(edge);
    }
  });
}

// ---------------------------------------------------------------------------
// Convert collection data to NetworkSource for operations
// ---------------------------------------------------------------------------

/**
 * Get a NetworkSource from the current collection state.
 * This returns the in-memory network data that can be sent to operations,
 * including any user modifications.
 */
export async function getNetworkSourceFromCollections(): Promise<NetworkSource> {
  await Promise.all([nodesCollection.preload(), edgesCollection.preload()]);

  const nodes = Array.from(nodesCollection.values()) as FlowNode[];
  const edges = Array.from(edgesCollection.values()) as FlowEdge[];

  // Build groups and branches from the nodes
  const groups: NetworkData["groups"] = [];
  const branches: NetworkData["branches"] = [];

  // First, identify all groups (type is "labeledGroup" in our schema)
  const groupNodes = nodes.filter((n) => n.type === "labeledGroup");

  // Build branch objects from branch nodes
  const branchNodes = nodes.filter((n) => n.type === "branch");

  for (const groupNode of groupNodes) {
    // Find branches that belong to this group (parentId matches group id)
    const groupBranchIds = branchNodes
      .filter((b) => b.parentId === groupNode.id)
      .map((b) => b.id);

    groups.push({
      id: groupNode.id,
      label: groupNode.data?.label ?? undefined,
      branchIds: groupBranchIds,
    });
  }

  for (const branchNode of branchNodes) {
    branches.push({
      id: branchNode.id,
      label: branchNode.data?.label ?? undefined,
      parentId: branchNode.parentId,
      blocks: branchNode.data?.blocks ?? [],
    });
  }

  return {
    type: "data",
    network: { groups, branches },
  };
}

/**
 * Create a NetworkSource - either from collections (if forceData is true or
 * networkId is undefined) or as a networkId reference.
 *
 * For operations that need the user's in-memory modifications, use forceData=true.
 */
export async function createNetworkSourceForOperation(
  networkId?: string,
  forceData = true
): Promise<NetworkSource> {
  // If we want to use the in-memory data (with user modifications)
  if (forceData || !networkId) {
    return getNetworkSourceFromCollections();
  }

  // Otherwise, reference the network by ID (backend will load from files)
  return { type: "networkId", networkId };
}
