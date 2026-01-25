"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "@tanstack/react-db";
import { FlowNetwork } from "@/components/flow/flow-network";
import {
  loadPresetFromApi,
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

export default function NetworkPage() {
  const params = useParams();
  const networkId = params.networkId as string;
  const [isLoaded, setIsLoaded] = useState(false);

  // Fetch network data
  const {
    data: network,
    isLoading,
    error,
  } = useQuery(networkQueryOptions(networkId));

  // Load network into collections when data arrives
  useEffect(() => {
    if (network && !isLoaded) {
      loadPresetFromApi(network).then(() => setIsLoaded(true));
    }
  }, [network, isLoaded]);

  // Live query the collections
  const { data: nodesRaw = [] } = useLiveQuery(nodesCollection);
  const { data: edges = [] } = useLiveQuery(edgesCollection);

  // Sort nodes so parents come before children (ReactFlow requirement)
  const nodes = useMemo(() => sortNodesWithParentsFirst(nodesRaw), [nodesRaw]);

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

  return (
    <SidebarProvider defaultOpen={true}>
      <SidebarInset className="flex-1 min-h-0 flex flex-col bg-brand-white border border-brand-grey-3">
        <div className="p-4 border-b border-brand-grey-3 flex items-center justify-between">
          <h1 className="text-3xl">{network.label}</h1>
          <div className="flex items-center gap-2">
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
  );
}
