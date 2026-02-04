"use client";

import type {
  PropertyMetadata,
  AggregatedPropertyMetadata,
  ResolvedValue,
} from "@/hooks/use-schema-properties";
import type { BaseFieldProps, FieldApiLike } from "./fields/types";
import {
  StringField,
  NumberField,
  BooleanField,
  EnumField,
  DimensionField,
} from "./fields";

export type FieldRendererProps = {
  /** Property metadata (can be regular or aggregated) */
  metadata: PropertyMetadata | AggregatedPropertyMetadata;
  /** TanStack Form field API */
  field: FieldApiLike;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show affected blocks indicator (for aggregated metadata) */
  showAffectedBlocks?: boolean;
  /** Inherited value from outer scope (for block scope forms) */
  inheritedValue?: ResolvedValue;
  /** Callback to clear value and inherit from outer scope */
  onClear?: () => void;
};

/**
 * FieldRenderer maps PropertyMetadata to the appropriate field component.
 *
 * Resolution order:
 * 1. Has `dimension` -> DimensionField
 * 2. `type === "enum"` -> EnumField
 * 3. `type === "number"` -> NumberField
 * 4. `type === "boolean"` -> BooleanField
 * 5. Default -> StringField
 */
export function FieldRenderer({
  metadata,
  field,
  disabled,
  className,
  showAffectedBlocks = false,
  inheritedValue,
  onClear,
}: FieldRendererProps) {
  // Common props for all field components
  const fieldProps: BaseFieldProps & { showAffectedBlocks?: boolean } = {
    metadata: metadata as PropertyMetadata,
    field,
    disabled,
    className,
    showAffectedBlocks,
    inheritedValue,
    onClear,
  };

  // Priority 1: Dimension fields (have physical dimension with units)
  if (metadata.dimension) {
    return <DimensionField {...fieldProps} />;
  }

  // Priority 2: Enum fields (have enumValues)
  if (metadata.type === "enum" && metadata.enumValues?.length) {
    return <EnumField {...fieldProps} />;
  }

  // Priority 3: Type-based field selection
  switch (metadata.type) {
    case "number":
      return <NumberField {...fieldProps} />;

    case "boolean":
      return <BooleanField {...fieldProps} />;

    case "string":
    default:
      return <StringField {...fieldProps} />;
  }
}

/**
 * Utility to get a human-readable field type description.
 */
export function getFieldTypeLabel(metadata: PropertyMetadata): string {
  if (metadata.dimension) {
    return `Dimension (${metadata.dimension})`;
  }
  if (metadata.type === "enum") {
    return "Selection";
  }
  switch (metadata.type) {
    case "number":
      return "Number";
    case "boolean":
      return "Yes/No";
    case "string":
    default:
      return "Text";
  }
}
