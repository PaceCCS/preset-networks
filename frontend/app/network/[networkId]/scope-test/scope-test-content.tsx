"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "@tanstack/react-db";
import {
  loadPresetFromApi,
  nodesCollection,
  setGlobalDefault,
  clearGlobalDefault,
} from "@/lib/collections/flow";
import { networkQueryOptions } from "@/lib/api-client";
import { NetworkProvider } from "@/contexts/network-context";
import { OperationProvider } from "@/contexts/operation-context";
import { getOperation } from "@/lib/operations";
import { SchemaForm, type ValidationMode } from "@/components/forms";
import type { PropertyScope } from "@/hooks/use-schema-properties";
import {
  isBranchNode,
  isLabeledGroupNode,
  type FlowNode,
  type FlowBranchNode,
  type FlowGroupNode,
} from "@/lib/collections/flow-nodes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

/**
 * Parse a block path to extract branch ID and block index.
 * - "branch-1/blocks/0" -> { branchId: "branch-1", blockIndex: 0 }
 */
function parseBlockPath(scopePath: string): {
  branchId: string;
  blockIndex: number;
} | null {
  const parts = scopePath.split("/blocks/");
  if (parts.length === 2) {
    const blockIndex = parseInt(parts[1], 10);
    if (!isNaN(blockIndex)) {
      return { branchId: parts[0], blockIndex };
    }
  }
  return null;
}

type AvailablePath = { value: string; label: string };

/**
 * Test page content for validating hierarchical scope forms.
 * Split into separate component to allow dynamic import with ssr: false.
 */
export default function ScopeTestContent() {
  const params = useParams();
  const networkId = params.networkId as string;
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Form configuration state
  const [scope, setScope] = useState<PropertyScope>("branch");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [validationMode, setValidationMode] = useState<ValidationMode>("relaxed");
  const [showAffectedBlocks, setShowAffectedBlocks] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [lastContext, setLastContext] = useState<{
    scope: PropertyScope;
    scopePath: string;
    affectedBlockPaths: string[];
  } | null>(null);

  // Fetch network data
  const {
    data: network,
    isLoading,
    error,
  } = useQuery(networkQueryOptions(networkId));

  // Load network into collections
  useEffect(() => {
    if (network && !loadAttempted) {
      loadPresetFromApi(network).then(() => setLoadAttempted(true));
    }
  }, [network, loadAttempted]);

  // Live query nodes to get branch IDs
  const { data: nodesRaw = [] } = useLiveQuery(nodesCollection);

  // Extract branch and group nodes
  const { branchNodes, groupNodes } = useMemo(() => {
    const nodes = nodesRaw as FlowNode[];
    return {
      branchNodes: nodes.filter(isBranchNode) as FlowBranchNode[],
      groupNodes: nodes.filter(isLabeledGroupNode) as FlowGroupNode[],
    };
  }, [nodesRaw]);

  // Get branches belonging to a specific group
  const getBranchesInGroup = useCallback(
    (groupId: string) => {
      return branchNodes.filter((b) => b.parentId === groupId);
    },
    [branchNodes]
  );

  // Get available scope paths based on scope type
  const availablePaths = useMemo((): AvailablePath[] => {
    if (scope === "global") {
      return [{ value: "__global__", label: "All Blocks (Global)" }];
    }
    if (scope === "group") {
      return groupNodes.map((node) => {
        const branchCount = getBranchesInGroup(node.id).length;
        const blockCount = getBranchesInGroup(node.id).reduce(
          (sum, b) => sum + b.data.blocks.length,
          0
        );
        return {
          value: node.id,
          label: `${node.data.label || node.id} (${branchCount} branches, ${blockCount} blocks)`,
        };
      });
    }
    if (scope === "branch") {
      return branchNodes.map((node) => ({
        value: node.data.id,
        label: `${node.data.label || node.data.id} (${node.data.blocks.length} blocks)`,
      }));
    }
    if (scope === "block") {
      const blockPaths: AvailablePath[] = [];
      for (const branch of branchNodes) {
        for (let i = 0; i < branch.data.blocks.length; i++) {
          const block = branch.data.blocks[i];
          blockPaths.push({
            value: `${branch.data.id}/blocks/${i}`,
            label: `${branch.data.label}/${block.label} (${block.type})`,
          });
        }
      }
      return blockPaths;
    }
    return [];
  }, [scope, branchNodes, groupNodes, getBranchesInGroup]);

  // Compute effective path - ensure it's valid
  const effectivePath = useMemo(() => {
    if (availablePaths.length === 0) return null;

    // If selected path is valid, use it
    if (selectedPath && availablePaths.some((p) => p.value === selectedPath)) {
      return selectedPath;
    }

    // Otherwise use first available
    return availablePaths[0].value;
  }, [availablePaths, selectedPath]);

  // Handle scope change - reset selected path
  const handleScopeChange = useCallback((newScope: PropertyScope) => {
    setScope(newScope);
    setSelectedPath(null); // Will auto-select first available
  }, []);

  // For group scope, get the branch IDs that belong to the group
  const scopePathsForGroup = useMemo(() => {
    if (scope !== "group" || !effectivePath || effectivePath === "__global__") {
      return undefined;
    }
    const branches = getBranchesInGroup(effectivePath);
    return branches.map((b) => b.data.id);
  }, [scope, effectivePath, getBranchesInGroup]);

  // Compute the actual scopePath to pass to SchemaForm
  // For group scope, we pass the group ID so it can be used for persistence,
  // but the branchFilter is what determines which properties are aggregated.
  const schemaFormScopePath = useMemo(() => {
    if (!effectivePath) return "";
    if (effectivePath === "__global__") return "";
    return effectivePath;
  }, [effectivePath]);

  const handleValuesChange = useCallback(
    (
      values: Record<string, unknown>,
      context: { scope: PropertyScope; scopePath: string; affectedBlockPaths: string[] }
    ) => {
      setFormValues(values);
      setLastContext(context);

      // Persist values to the collection based on scope
      switch (context.scope) {
        case "block": {
          // For block scope, update the specific block within a branch
          const parsed = parseBlockPath(context.scopePath);
          if (parsed) {
            nodesCollection.update(parsed.branchId, (draft) => {
              if (draft.type !== "branch") return;
              const blocks = [...(draft.data.blocks ?? [])];
              if (blocks[parsed.blockIndex]) {
                const updatedBlock = { ...blocks[parsed.blockIndex] };
                for (const [key, value] of Object.entries(values)) {
                  if (value !== undefined) {
                    (updatedBlock as Record<string, unknown>)[key] = value;
                  }
                }
                blocks[parsed.blockIndex] = updatedBlock;
                draft.data.blocks = blocks;
              }
            });
          }
          break;
        }

        case "branch": {
          // For branch scope, update the branch node's data directly
          const nodeId = context.scopePath;
          if (nodeId && nodesCollection.has(nodeId)) {
            nodesCollection.update(nodeId, (draft) => {
              if (draft.type !== "branch") return;
              for (const [key, value] of Object.entries(values)) {
                if (value !== undefined) {
                  (draft.data as Record<string, unknown>)[key] = value;
                }
              }
            });
          }
          break;
        }

        case "group": {
          // For group scope, update the group node's data directly
          const nodeId = context.scopePath;
          if (nodeId && nodesCollection.has(nodeId)) {
            nodesCollection.update(nodeId, (draft) => {
              if (draft.type !== "labeledGroup") return;
              for (const [key, value] of Object.entries(values)) {
                if (value !== undefined) {
                  (draft.data as Record<string, unknown>)[key] = value;
                }
              }
            });
          }
          break;
        }

        case "global": {
          // For global scope, update global config defaults
          for (const [key, value] of Object.entries(values)) {
            if (value !== undefined) {
              setGlobalDefault(key, value as string | number | boolean | null);
            }
          }
          break;
        }
      }
    },
    []
  );

  // Handle clearing a value to inherit from outer scope
  const handleClearValue = useCallback(
    (propertyName: string) => {
      switch (scope) {
        case "block": {
          const parsed = parseBlockPath(schemaFormScopePath);
          if (parsed) {
            nodesCollection.update(parsed.branchId, (draft) => {
              if (draft.type !== "branch") return;
              const blocks = [...(draft.data.blocks ?? [])];
              if (blocks[parsed.blockIndex]) {
                const updatedBlock = { ...blocks[parsed.blockIndex] };
                delete (updatedBlock as Record<string, unknown>)[propertyName];
                blocks[parsed.blockIndex] = updatedBlock;
                draft.data.blocks = blocks;
              }
            });
          }
          break;
        }

        case "branch": {
          const nodeId = schemaFormScopePath;
          if (nodeId && nodesCollection.has(nodeId)) {
            nodesCollection.update(nodeId, (draft) => {
              if (draft.type !== "branch") return;
              delete (draft.data as Record<string, unknown>)[propertyName];
            });
          }
          break;
        }

        case "group": {
          // For group scope, the effectivePath is the group ID
          const nodeId = effectivePath;
          if (nodeId && nodeId !== "__global__" && nodesCollection.has(nodeId)) {
            nodesCollection.update(nodeId, (draft) => {
              if (draft.type !== "labeledGroup") return;
              delete (draft.data as Record<string, unknown>)[propertyName];
            });
          }
          break;
        }

        case "global": {
          clearGlobalDefault(propertyName);
          break;
        }
      }
    },
    [scope, effectivePath, schemaFormScopePath]
  );

  const operation = getOperation("costing");

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-brand-grey-2">Loading network...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-destructive">
          Failed to load network: {error.message}
        </div>
      </div>
    );
  }

  if (!network || !operation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-brand-grey-2">Network or operation not found</div>
      </div>
    );
  }

  return (
    <OperationProvider operation={operation}>
      <NetworkProvider networkId={networkId}>
        <div className="flex-1 p-6 max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Scope Form Test</h1>
            <p className="text-muted-foreground">
              Test the hierarchical scope forms with different scope levels and
              validation modes.
            </p>
          </div>

          {/* Configuration Panel */}
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h2 className="font-semibold">Configuration</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Scope Level */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Scope Level</label>
                <Select
                  value={scope}
                  onValueChange={(v) => handleScopeChange(v as PropertyScope)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="branch">Branch</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scope Path */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Scope Path</label>
                {availablePaths.length > 0 && effectivePath ? (
                  <Select
                    value={effectivePath}
                    onValueChange={setSelectedPath}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePaths.map((path) => (
                        <SelectItem key={path.value} value={path.value}>
                          {path.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-10 flex items-center text-sm text-muted-foreground">
                    No paths available
                  </div>
                )}
              </div>

              {/* Validation Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Validation Mode</label>
                <Select
                  value={validationMode}
                  onValueChange={(v) => setValidationMode(v as ValidationMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show Affected Blocks */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Show Affected</label>
                <Button
                  variant={showAffectedBlocks ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setShowAffectedBlocks(!showAffectedBlocks)}
                >
                  {showAffectedBlocks ? "Yes" : "No"}
                </Button>
              </div>
            </div>

            {/* Show group branches info */}
            {scope === "group" && scopePathsForGroup && (
              <div className="text-sm text-muted-foreground">
                Branches in group: {scopePathsForGroup.join(", ") || "none"}
              </div>
            )}
          </div>

          {/* Form Panel */}
          <div className="border rounded-lg p-4 space-y-4">
            <h2 className="font-semibold">
              Schema Form ({scope} scope: {effectivePath === "__global__" ? "all" : effectivePath || "none"})
            </h2>

            {effectivePath && (
              <SchemaForm
                key={`${scope}-${effectivePath}`}
                scope={scope}
                scopePath={schemaFormScopePath}
                branchFilter={scopePathsForGroup}
                validationMode={validationMode}
                showAffectedBlocks={showAffectedBlocks}
                autoSave
                onValuesChange={handleValuesChange}
                onClearValue={handleClearValue}
              />
            )}
          </div>

          {/* Debug Panel */}
          <div className="border rounded-lg p-4 space-y-4">
            <h2 className="font-semibold">Debug Output</h2>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Form Values:</h3>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(formValues, null, 2)}
              </pre>
            </div>

            {lastContext && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Affected Block Paths ({lastContext.affectedBlockPaths.length}):
                </h3>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(lastContext.affectedBlockPaths, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </NetworkProvider>
    </OperationProvider>
  );
}
