"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { FieldRenderer } from "./field-renderer";
import { toFieldApiLike } from "./fields/types";
import {
  useSchemaProperties,
  groupPropertiesByBlock,
  type PropertyMetadata,
} from "@/hooks/use-schema-properties";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { convertExprToUnit } from "@/lib/dim/dim";

export type SchemaFormProps = {
  /** Query path to the block (e.g., "branch-1/blocks/0") */
  queryPath: string;
  /** Schema version override (otherwise uses OperationContext) */
  schemaVersion?: string;
  /** Current values for the form fields */
  values?: Record<string, unknown>;
  /** Callback when form values change */
  onValuesChange?: (values: Record<string, unknown>) => void;
  /** Callback when form is submitted */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Whether to auto-save changes (calls onValuesChange on every change) */
  autoSave?: boolean;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show loading skeleton */
  showLoadingSkeleton?: boolean;
};

/**
 * SchemaForm dynamically generates form fields based on schema metadata.
 *
 * Features:
 * - Fetches schema properties from API
 * - Renders appropriate field components based on property types
 * - Supports auto-save mode for real-time updates
 * - Integrates with TanStack Form for state management
 */
export function SchemaForm({
  queryPath,
  schemaVersion,
  values = {},
  onValuesChange,
  onSubmit,
  autoSave = false,
  disabled = false,
  className,
  showLoadingSkeleton = true,
}: SchemaFormProps) {
  // Fetch schema properties for the query path
  const {
    data: schemaProperties,
    isLoading,
    error,
  } = useSchemaProperties(queryPath, {
    schemaVersion,
  });

  // Group properties by block and extract the relevant block's properties
  const blockProperties = useMemo(() => {
    if (!schemaProperties) return null;

    const grouped = groupPropertiesByBlock(schemaProperties);

    // Find the block matching our query path
    const blockPath = Object.keys(grouped).find(
      (path) => path === queryPath || queryPath.startsWith(path)
    );

    return blockPath ? grouped[blockPath] : null;
  }, [schemaProperties, queryPath]);

  // Get ordered list of property names (required first, then optional)
  const orderedProperties = useMemo(() => {
    if (!blockProperties) return [];

    const props = Object.entries(blockProperties);
    const required = props.filter(([, meta]) => meta.required);
    const optional = props.filter(([, meta]) => !meta.required);

    return [...required, ...optional];
  }, [blockProperties]);

  // Initialize TanStack Form with values as default
  // Note: We don't reset on values prop change to avoid overwriting user input
  const form = useForm({
    defaultValues: values,
    onSubmit: async ({ value }) => {
      onSubmit?.(value);
    },
  });

  // Auto-save: trigger onValuesChange when form state changes
  useEffect(() => {
    if (autoSave && onValuesChange) {
      const currentValues = form.state.values;
      onValuesChange(currentValues);
    }
  }, [form.state.values, autoSave, onValuesChange]);

  if (isLoading && showLoadingSkeleton) {
    return (
      <div className={cn("space-y-4", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-destructive text-sm", className)}>
        Failed to load form schema: {error.message}
      </div>
    );
  }

  if (!blockProperties || orderedProperties.length === 0) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        No editable properties found for this block.
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className={cn("space-y-4", className)}
    >
      {orderedProperties.map(([propertyName, metadata]) => (
        <form.Field
          key={propertyName}
          name={propertyName}
          validators={{
            onChange: createValidator(metadata),
          }}
        >
          {(field) => (
            <FieldRenderer
              metadata={metadata}
              field={toFieldApiLike(field)}
              disabled={disabled}
            />
          )}
        </form.Field>
      ))}
    </form>
  );
}

/**
 * Create a validator function based on property metadata.
 * For dimension fields, validates min/max using unit conversion.
 */
function createValidator(metadata: PropertyMetadata) {
  return ({ value }: { value: unknown }) => {
    // Required field validation
    if (metadata.required && (value === undefined || value === null || value === "")) {
      return `${metadata.title ?? metadata.property} is required`;
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    // Dimension field validation with unit conversion
    if (metadata.dimension && typeof value === "string" && value.trim()) {
      const defaultUnit = metadata.defaultUnit || "";

      // Only validate min/max if we have a default unit to convert to
      if (defaultUnit && (metadata.min !== undefined || metadata.max !== undefined)) {
        try {
          // Convert user's expression to the schema's default unit
          // e.g., "5 km" as "m" -> "5000 m"
          const converted = convertExprToUnit(value, defaultUnit);

          // Extract numeric part: "5000 m" -> 5000
          const numericValue = parseFloat(converted.split(" ")[0]);

          if (!isNaN(numericValue)) {
            if (metadata.min !== undefined && numericValue < metadata.min) {
              return `Must be at least ${metadata.min} ${defaultUnit}`;
            }
            if (metadata.max !== undefined && numericValue > metadata.max) {
              return `Must be at most ${metadata.max} ${defaultUnit}`;
            }
          }
        } catch {
          // If conversion fails (incompatible units or invalid expression),
          // the DimensionField component will show its own validation error via useDim
        }
      }

      // Skip regular number validation for dimension fields
      return undefined;
    }

    // Number constraints (for non-dimension numeric fields)
    if (metadata.type === "number" && typeof value === "number") {
      if (metadata.min !== undefined && value < metadata.min) {
        return `Must be at least ${metadata.min}`;
      }
      if (metadata.max !== undefined && value > metadata.max) {
        return `Must be at most ${metadata.max}`;
      }
    }

    // Enum validation
    if (metadata.type === "enum" && metadata.enumValues?.length) {
      const stringValue = String(value);
      const isValid = metadata.enumValues.some(
        (v) => String(v) === stringValue
      );
      if (!isValid) {
        return `Invalid value. Must be one of: ${metadata.enumValues.join(", ")}`;
      }
    }

    return undefined;
  };
}

/**
 * Hook to get just the form state without rendering.
 * Useful for external form management.
 */
export function useSchemaForm(
  queryPath: string,
  options?: {
    schemaVersion?: string;
    initialValues?: Record<string, unknown>;
  }
) {
  const {
    data: schemaProperties,
    isLoading,
    error,
  } = useSchemaProperties(queryPath, {
    schemaVersion: options?.schemaVersion,
  });

  const blockProperties = useMemo(() => {
    if (!schemaProperties) return null;
    const grouped = groupPropertiesByBlock(schemaProperties);
    const blockPath = Object.keys(grouped).find(
      (path) => path === queryPath || queryPath.startsWith(path)
    );
    return blockPath ? grouped[blockPath] : null;
  }, [schemaProperties, queryPath]);

  const form = useForm({
    defaultValues: options?.initialValues ?? {},
  });

  return {
    form,
    schemaProperties,
    blockProperties,
    isLoading,
    error,
  };
}
