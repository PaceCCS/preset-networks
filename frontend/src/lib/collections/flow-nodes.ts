import type { Node, Edge } from "@xyflow/react";
import type {
  NetworkEdge,
  BranchNodeData,
  GroupNodeData,
  GeographicNodeData,
  ImageNodeData,
} from "@/lib/api-client";

// Additional ReactFlow UI properties
type FlowNodeUIProps = Partial<
  Pick<
    Node,
    "selected" | "zIndex" | "focusable" | "resizing" | "style" | "className"
  >
> & {
  draggable?: boolean;
  selectable?: boolean;
  parentId?: string; // Convert null to undefined
  width?: number; // Convert null to undefined
  height?: number; // Convert null to undefined
  extent?: "parent"; // For parent-child relationships
};

// Base flow node properties (shared by all node types)
type FlowNodeBase = {
  id: string;
  position: { x: number; y: number };
} & FlowNodeUIProps;

// Specific flow node types that preserve the discriminated union
export type FlowBranchNode = FlowNodeBase & {
  type: "branch";
  data: BranchNodeData;
};

export type FlowGroupNode = FlowNodeBase & {
  type: "labeledGroup";
  data: GroupNodeData;
};

export type FlowGeographicAnchorNode = FlowNodeBase & {
  type: "geographicAnchor";
  data: GeographicNodeData;
};

export type FlowGeographicWindowNode = FlowNodeBase & {
  type: "geographicWindow";
  data: GeographicNodeData;
};

export type FlowImageNode = FlowNodeBase & {
  type: "image";
  data: ImageNodeData;
};

// Union type for all flow nodes - preserves discriminated union
export type FlowNode =
  | FlowBranchNode
  | FlowGroupNode
  | FlowGeographicAnchorNode
  | FlowGeographicWindowNode
  | FlowImageNode;

export type FlowEdge = NetworkEdge & Partial<Edge>;

// Type guards for node types - these now properly narrow the data type
export function isBranchNode(node: FlowNode): node is FlowBranchNode {
  return node.type === "branch";
}

export function isLabeledGroupNode(node: FlowNode): node is FlowGroupNode {
  return node.type === "labeledGroup";
}

export function isGeographicAnchorNode(
  node: FlowNode
): node is FlowGeographicAnchorNode {
  return node.type === "geographicAnchor";
}

export function isGeographicWindowNode(
  node: FlowNode
): node is FlowGeographicWindowNode {
  return node.type === "geographicWindow";
}

export function isImageNode(node: FlowNode): node is FlowImageNode {
  return node.type === "image";
}

// Legacy type aliases for backward compatibility during migration
export type AppNode = FlowNode;
export type AppEdge = FlowEdge;
