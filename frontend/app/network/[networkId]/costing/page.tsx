"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
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
import { OperationProvider } from "@/contexts/operation-context";
import { getOperation } from "@/lib/operations";

// Dynamic import for components that use useLiveQuery (requires client-side only)
const FlowNetworkWithCollections = dynamic(
  () => import("./flow-network-content").then((mod) => mod.FlowNetworkContent),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-brand-grey-2">Loading flow...</div>
      </div>
    ),
  }
);

export default function NetworkPage() {
  const params = useParams();
  const networkId = params.networkId as string;

  // Fetch network data
  const {
    data: network,
    isLoading,
    error,
  } = useQuery(networkQueryOptions(networkId));

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
              <SidebarTrigger />
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <NetworkProvider networkId={networkId}>
              <FlowNetworkWithCollections network={network} networkId={networkId} />
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
