"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "@tanstack/react-db";
import { FlowNetwork } from "@/components/flow/flow-network";
import {
  loadPresetFromApi,
  resetFlowToNetwork,
  nodesCollection,
  edgesCollection,
  sortNodesWithParentsFirst,
} from "@/lib/collections/flow";
import { networkQueryOptions } from "@/lib/api-client";
import { NetworkProvider } from "@/contexts/network-context";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { OperationsList } from "@/components/operations";
import { Button } from "@/components/ui/button";
import { RotateCcwIcon } from "lucide-react";
import { OperationProvider } from "@/contexts/operation-context";
import { getOperation } from "@/lib/operations";

export default function NetworkPage() {
  const params = useParams();
  const networkId = params.networkId as string;
  const [loadAttempted, setLoadAttempted] = useState(false);

  // Fetch network data
  const {
    data: network,
    isLoading,
    error,
  } = useQuery(networkQueryOptions(networkId));

  // Load network into collections when data arrives (only if not already loaded)
  useEffect(() => {
    if (network && !loadAttempted) {
      // loadPresetFromApi will skip if this network is already loaded
      loadPresetFromApi(network).then(() => setLoadAttempted(true));
    }
  }, [network, loadAttempted]);

  // Reset to reload the network, discarding user changes
  const handleReset = useCallback(() => {
    if (network) {
      resetFlowToNetwork(network, networkId);
    }
  }, [network, networkId]);

  // Live query the collections
  const { data: nodesRaw = [] } = useLiveQuery(nodesCollection);
  const { data: edges = [] } = useLiveQuery(edgesCollection);

  // Sort nodes so parents come before children (ReactFlow requirement)
  const nodes = useMemo(() => sortNodesWithParentsFirst(nodesRaw), [nodesRaw]);

  // Show loading until mounted on client (useLiveQuery requires client-side rendering)
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

  if (!network) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-brand-grey-2">Network not found</div>
      </div>
    );
  }

  const operation = getOperation("costing");
  if (!operation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-destructive">Operation not found</div>
      </div>
    );
  }
  return (
    <OperationProvider operation={operation}>
      <SidebarProvider defaultOpen={true}>
        <SidebarInset className="flex-1 min-h-0 flex flex-col bg-brand-white border border-brand-grey-3">
          <div className="p-4 border-b border-brand-grey-3 flex items-center justify-between">
            <h1 className="text-3xl">{network.label}</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                title="Reset to preset (discard changes)"
              >
                <RotateCcwIcon className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <SidebarTrigger />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <NetworkProvider networkId={networkId}>
              <FlowNetwork nodes={nodes} edges={edges} />
            </NetworkProvider>
          </div>
        </SidebarInset>
        <Sidebar side="right" collapsible="offcanvas">
          <SidebarContent>
            <OperationsList networkPath={networkId} />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </OperationProvider>
  );
}
