"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { FlowNetwork } from "@/components/flow/flow-network";
import {
  loadPresetFromApi,
  resetFlowToNetwork,
  nodesCollection,
  edgesCollection,
  sortNodesWithParentsFirst,
} from "@/lib/collections/flow";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";
import type { NetworkResponse } from "@/lib/api-client";

type FlowNetworkContentProps = {
  network: NetworkResponse;
  networkId: string;
};

export function FlowNetworkContent({ network, networkId }: FlowNetworkContentProps) {
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Load network into collections when data arrives (only if not already loaded)
  useEffect(() => {
    if (network && !loadAttempted) {
      loadPresetFromApi(network).then(() => setLoadAttempted(true));
    }
  }, [network, loadAttempted]);

  // Reset to reload the network, discarding user changes
  const handleReset = useCallback(() => {
    if (network) {
      resetFlowToNetwork(network, networkId);
    }
  }, [network, networkId]);

  // Live query the collections - safe here because this component is client-only
  const { data: nodesRaw = [] } = useLiveQuery(nodesCollection);
  const { data: edges = [] } = useLiveQuery(edgesCollection);

  // Sort nodes so parents come before children (ReactFlow requirement)
  const nodes = useMemo(() => sortNodesWithParentsFirst(nodesRaw), [nodesRaw]);

  return (
    <div className="flex flex-col h-full">
      <div className="absolute top-4 right-16 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          title="Reset to preset (discard changes)"
        >
          <RotateCcwIcon className="h-4 w-4 mr-1" />
          Reset
        </Button>
      </div>
      <FlowNetwork nodes={nodes} edges={edges} />
    </div>
  );
}
