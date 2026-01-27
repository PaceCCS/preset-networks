"use client";

import { useQuery } from "@tanstack/react-query";
import { Calculator, Activity } from "lucide-react";
import { openDialog } from "@/contexts/dialog-provider";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  getOperations,
  costingValidationQueryOptions,
  costingHealthQueryOptions,
  snapshotHealthQueryOptions,
  snapshotValidationQueryOptions,
  type Operation,
  type OperationValidation,
  type HealthStatus,
  type SnapshotValidation,
} from "@/lib/operations";
import {
  OperationStatusDot,
  type OperationStatus,
} from "./operation-status-indicator";
import { CostingOperationDialog } from "./costing-operation-dialog";
import { SnapshotOperationDialog } from "./snapshot-operation-dialog";

type OperationsListProps = {
  /** Path to the network directory */
  networkPath: string;
  /** Cost library to use */
  libraryId?: string;
};

/**
 * Get icon for an operation.
 */
function getOperationIcon(operationId: string) {
  switch (operationId) {
    case "costing":
      return Calculator;
    case "snapshot":
      return Activity;
    default:
      return Calculator;
  }
}

/**
 * Determine operation status from validation and health data.
 */
function getOperationStatus(
  validation: OperationValidation | undefined,
  health: HealthStatus | undefined,
  isLoading: boolean
): OperationStatus {
  if (isLoading) return "loading";
  if (health?.status === "error") return "error";
  if (!validation) return "unknown";
  if (validation.isReady) return "ready";
  if (validation.summary.costableBlocks > 0) return "warning";
  return "error";
}

/**
 * List of available operations for the sidebar.
 */
export function OperationsList({
  networkPath,
  libraryId = "V1.1_working",
}: OperationsListProps) {
  const operations = getOperations();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Operations</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {operations.map((operation) => (
            <OperationListItem
              key={operation.id}
              operation={operation}
              networkPath={networkPath}
              libraryId={libraryId}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

type OperationListItemProps = {
  operation: Operation;
  networkPath: string;
  libraryId: string;
};

function OperationListItem({
  operation,
  networkPath,
  libraryId,
}: OperationListItemProps) {
  // Fetch validation status for costing operation
  const { data: costingValidation, isLoading: isCostingValidationLoading } = useQuery({
    ...costingValidationQueryOptions(networkPath, libraryId),
    enabled: operation.id === "costing" && !!networkPath,
  });

  // Fetch health status for costing
  const { data: costingHealth, isLoading: isCostingHealthLoading } = useQuery({
    ...costingHealthQueryOptions(),
    enabled: operation.id === "costing",
  });

  // Fetch validation status for snapshot operation
  // Note: The full data source is used when running the operation in the dialog
  const { data: snapshotValidation, isLoading: isSnapshotValidationLoading } = useQuery({
    ...snapshotValidationQueryOptions({ type: "networkId", networkId: networkPath }, networkPath),
    enabled: operation.id === "snapshot" && !!networkPath,
  });

  // Fetch health status for snapshot
  const { data: snapshotHealth, isLoading: isSnapshotHealthLoading } = useQuery({
    ...snapshotHealthQueryOptions(),
    enabled: operation.id === "snapshot",
  });

  const isLoading =
    (operation.id === "costing" && (isCostingValidationLoading || isCostingHealthLoading)) ||
    (operation.id === "snapshot" && (isSnapshotValidationLoading || isSnapshotHealthLoading));

  const status = operation.id === "snapshot"
    ? getSnapshotOperationStatus(snapshotValidation, snapshotHealth, isSnapshotValidationLoading || isSnapshotHealthLoading)
    : getOperationStatus(costingValidation, costingHealth, isCostingValidationLoading || isCostingHealthLoading);

  const Icon = getOperationIcon(operation.id);

  const handleClick = () => {
    if (operation.id === "costing") {
      openDialog(
        ({ close }) => (
          <CostingOperationDialog
            networkPath={networkPath}
            libraryId={libraryId}
            validation={costingValidation}
            health={costingHealth}
            onClose={close}
          />
        ),
        {
          title: operation.name,
          description: operation.description,
          className: "max-w-2xl",
        }
      );
    } else if (operation.id === "snapshot") {
      openDialog(
        ({ close }) => (
          <SnapshotOperationDialog
            networkPath={networkPath}
            health={snapshotHealth}
            validation={snapshotValidation}
            onClose={close}
          />
        ),
        {
          title: operation.name,
          description: operation.description,
          className: "max-w-3xl",
        }
      );
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={handleClick} tooltip={operation.description}>
        <Icon className="h-4 w-4" />
        <span className="flex-1">{operation.name}</span>
        <OperationStatusDot status={status} />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Determine snapshot operation status from validation and health data.
 */
function getSnapshotOperationStatus(
  validation: SnapshotValidation | undefined,
  health: HealthStatus | undefined,
  isLoading: boolean
): OperationStatus {
  if (isLoading) return "loading";
  if (health?.status === "error") return "error";
  if (!validation) return "unknown";
  if (validation.isReady) return "ready";
  if (validation.summary.extractedConditions > 0) return "warning";
  return "error";
}
