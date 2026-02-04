"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { BranchNodeData as ApiBranchNodeData } from "@/lib/api-client";
import { SchemaForm } from "@/components/forms";
import { useOperationOptional } from "@/contexts/operation-context";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Extend the API type to include originalNode for ReactFlow
export type BranchNodeData = ApiBranchNodeData & {
  originalNode?: unknown;
};

export function BranchNode({ data }: NodeProps) {
  const nodeData = data as BranchNodeData;
  const { label, blocks } = nodeData;

  // Track which block is expanded for editing
  const [expandedBlockIndex, setExpandedBlockIndex] = useState<number | null>(
    null
  );

  const toggleBlock = (index: number) => {
    setExpandedBlockIndex(expandedBlockIndex === index ? null : index);
  };

  return (
    <div className="bg-white border border-brand-grey-3 rounded-lg shadow-sm p-3 min-w-[200px]">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-brand-blue-1 rounded-full"></div>
          <div className="text-sm font-medium">{label || nodeData.id}</div>
        </div>
      </div>
      {blocks && blocks.length > 0 && (
        <div className="mt-2 pt-2 border-t border-brand-grey-3">
          <div className="text-xs text-brand-grey-2 mb-1">
            Blocks ({blocks.length})
          </div>
          <div className="space-y-1">
            {blocks.map(
              (block: BranchNodeData["blocks"][0], index: number) => (
                <div key={index}>
                  <button
                    type="button"
                    onClick={() => toggleBlock(index)}
                    className={cn(
                      "w-full text-xs flex items-center gap-2 p-1 rounded hover:bg-gray-50 transition-colors",
                      expandedBlockIndex === index && "bg-gray-50"
                    )}
                  >
                    {expandedBlockIndex === index ? (
                      <ChevronDown className="h-3 w-3 text-brand-grey-2" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-brand-grey-2" />
                    )}
                    <span className="text-brand-grey-2">×{block.quantity}</span>
                    <span className="flex-1 text-left">{block.label}</span>
                  </button>

                  {expandedBlockIndex === index && (
                    <div className="nodrag nowheel ml-5 mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <BlockForm
                        branchId={nodeData.id}
                        blockIndex={index}
                        block={block}
                      />
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

/**
 * Block form component - renders the schema-driven form for a block.
 * Uses schemaVersion from OperationContext.
 */
function BlockForm({
  branchId,
  blockIndex,
  block,
}: {
  branchId: string;
  blockIndex: number;
  block: BranchNodeData["blocks"][0];
}) {
  const queryPath = `${branchId}/blocks/${blockIndex}`;
  const operationContext = useOperationOptional();

  // Extract current values from the block
  const initialValues: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block)) {
    if (key !== "quantity" && key !== "type" && key !== "kind" && key !== "label") {
      initialValues[key] = value;
    }
  }

  // If no operation context, show a message
  if (!operationContext) {
    return (
      <div className="text-xs text-muted-foreground">
        No operation selected. Wrap in OperationProvider to enable form editing.
      </div>
    );
  }

  return (
    <SchemaForm
      queryPath={queryPath}
      values={initialValues}
      onValuesChange={(values) => {
        // In a real implementation, this would update the collection
        console.log(`[BlockForm] ${queryPath} values changed:`, values);
      }}
      className="space-y-3"
    />
  );
}
