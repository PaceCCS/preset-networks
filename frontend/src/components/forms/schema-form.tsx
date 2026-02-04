"use client";

import { useEffect, useMemo, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { FieldRenderer } from "./field-renderer";
import { toFieldApiLike } from "./fields/types";
import {
  useScopedSchemaProperties,
  useResolvedValues,
  getResolvedValuesForBlock,
  type PropertyScope,
  type AggregatedPropertyMetadata,
} from "@/hooks/use-schema-properties";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { convertExprToUnit } from "@/lib/dim/dim";

/**
 * Validation mode for schema forms.
 * - "strict": Full validation (required, min/max, enum) - default for block scope
 * - "relaxed": Skip min/max, required only if universallyRequired - default for outer scopes
 * - "none": No validation
 */
export type ValidationMode = "strict" | "relaxed" | "none";

/**
 * Context provided to onValuesChange callback for scoped forms.
 */
export type ValuesChangeContext = {
  scope: PropertyScope;
  scopePath: string;
  affectedBlockPaths: string[];
};

export type SchemaFormProps = {
  /**
   * Scope level for the form.
   * - "block": Single block editing (default)
   * - "branch": Edit defaults for all blocks in a branch
   * - "group": Edit defaults for all blocks in a group
   * - "global": Edit defaults for all blocks in the network
   */
  scope?: PropertyScope;
  /**
   * Path to the scope being edited.
   * - For "block": "branch-1/blocks/0"
   * - For "branch": "branch-1"
   * - For "group": "group-1"
   * - For "global": "" (empty string)
   */
  scopePath: string;
  /** Schema version override (otherwise uses OperationContext) */
  schemaVersion?: string;
  /** Current values for the form fields */
  values?: Record<string, unknown>;
  /**
   * Callback when form values change.
   * For scoped forms, includes context with affected block paths.
   */
  onValuesChange?: (
    values: Record<string, unknown>,
    context: ValuesChangeContext
  ) => void;
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
  /**
   * Validation mode. Defaults based on scope:
   * - "strict" for block scope
   * - "relaxed" for branch/group/global scope
   */
  validationMode?: ValidationMode;
  /**
   * Whether to show which blocks are affected by each property.
   * Defaults to true for non-block scopes, false for block scope.
   */
  showAffectedBlocks?: boolean;
  /** Optional filter to only show properties for specific block types */
  blockTypeFilter?: string[];
  /**
   * Filter to only include properties from specific branches.
   * Used for group scope to limit to branches within the group.
   */
  branchFilter?: string[];
  /**
   * Whether to fetch and show resolved/inherited values.
   * When true, shows inherited values as placeholders and allows clearing to inherit.
   * Defaults to true for block scope, false for outer scopes.
   */
  showInheritedValues?: boolean;
  /**
   * Callback when a field is cleared to inherit from parent scope.
   * Receives the property name that was cleared.
   */
  onClearValue?: (propertyName: string) => void;
};

/**
 * SchemaForm dynamically generates form fields based on schema metadata.
 *
 * Features:
 * - Fetches schema properties from API
 * - Renders appropriate field components based on property types
 * - Supports auto-save mode for real-time updates
 * - Integrates with TanStack Form for state management
 * - Supports hierarchical scope editing (block, branch, group, global)
 * - Aggregates properties across multiple blocks for outer scopes
 * - Relaxed validation for outer scopes (defaults are overridable)
 */
export function SchemaForm({
  scope = "block",
  scopePath,
  schemaVersion,
  values = {},
  onValuesChange,
  onSubmit,
  autoSave = false,
  disabled = false,
  className,
  showLoadingSkeleton = true,
  validationMode,
  showAffectedBlocks,
  blockTypeFilter,
  branchFilter,
  showInheritedValues,
  onClearValue,
}: SchemaFormProps) {
  // Determine defaults based on scope
  const isOuterScope = scope !== "block";
  const effectiveValidationMode =
    validationMode ?? (isOuterScope ? "relaxed" : "strict");
  const effectiveShowAffectedBlocks = showAffectedBlocks ?? isOuterScope;
  // For block scope, show inherited values by default; for outer scopes, don't
  const effectiveShowInheritedValues = showInheritedValues ?? scope === "block";

  // Fetch schema properties using the scoped hook
  const {
    properties: scopedProperties,
    isLoading: propertiesLoading,
    error: propertiesError,
  } = useScopedSchemaProperties(scope, scopePath, {
    schemaVersion,
    blockTypeFilter,
    branchFilter,
  });

  // Fetch resolved values (for showing inherited defaults)
  const { data: validationResults, isLoading: validationLoading } =
    useResolvedValues({
      schemaVersion,
      enabled: effectiveShowInheritedValues,
    });

  // Extract resolved values for the current block path (only for block scope)
  const resolvedValues = useMemo(() => {
    if (scope !== "block" || !validationResults || !scopePath) {
      return {};
    }
    return getResolvedValuesForBlock(validationResults, scopePath);
  }, [scope, validationResults, scopePath]);

  const isLoading =
    propertiesLoading || (effectiveShowInheritedValues && validationLoading);
  const error = propertiesError;

  // Get ordered list of property names (required first, then optional)
  const orderedProperties = useMemo(() => {
    if (!scopedProperties) return [];

    const props = Object.entries(scopedProperties);

    // For outer scopes, use universallyRequired for sorting
    const required = props.filter(([, meta]) =>
      isOuterScope ? meta.universallyRequired : meta.required
    );
    const optional = props.filter(([, meta]) =>
      isOuterScope ? !meta.universallyRequired : !meta.required
    );

    return [...required, ...optional];
  }, [scopedProperties, isOuterScope]);

  // Collect all affected block paths for context
  const allAffectedBlockPaths = useMemo(() => {
    if (!scopedProperties) return [];

    const paths = new Set<string>();
    for (const metadata of Object.values(scopedProperties)) {
      for (const path of metadata.affectedBlockPaths) {
        paths.add(path);
      }
    }
    return Array.from(paths);
  }, [scopedProperties]);

  // Initialize TanStack Form with values as default
  // Note: We don't reset on values prop change to avoid overwriting user input
  const form = useForm({
    defaultValues: values,
    onSubmit: async ({ value }) => {
      onSubmit?.(value);
    },
  });

  // Track previous values to avoid infinite loops in autoSave
  const prevValuesRef = useRef<string>("");

  // Auto-save: trigger onValuesChange when form state changes
  useEffect(() => {
    if (autoSave && onValuesChange) {
      const currentValues = form.state.values;
      const serialized = JSON.stringify(currentValues);

      // Only trigger if values actually changed
      if (serialized !== prevValuesRef.current) {
        prevValuesRef.current = serialized;
        const context: ValuesChangeContext = {
          scope,
          scopePath,
          affectedBlockPaths: allAffectedBlockPaths,
        };
        onValuesChange(currentValues, context);
      }
    }
  }, [
    form.state.values,
    autoSave,
    onValuesChange,
    scope,
    scopePath,
    allAffectedBlockPaths,
  ]);

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

  if (!scopedProperties || orderedProperties.length === 0) {
    return (
      <div className={cn("text-muted-foreground text-sm", className)}>
        No editable properties found for this {scope}.
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
      {orderedProperties.map(([propertyName, metadata]) => {
        const resolved = resolvedValues[propertyName];
        return (
          <form.Field
            key={propertyName}
            name={propertyName}
            validators={{
              onChange: createScopedValidator(
                metadata,
                effectiveValidationMode
              ),
            }}
          >
            {(field) => (
              <FieldRenderer
                metadata={metadata}
                field={toFieldApiLike(field)}
                disabled={disabled}
                showAffectedBlocks={effectiveShowAffectedBlocks}
                inheritedValue={resolved}
                onClear={
                  onClearValue
                    ? () => {
                        field.handleChange(undefined);
                        onClearValue(propertyName);
                      }
                    : undefined
                }
              />
            )}
          </form.Field>
        );
      })}
    </form>
  );
}

/**
 * Create a validator function based on property metadata and validation mode.
 * For dimension fields, validates min/max using unit conversion.
 */
function createScopedValidator(
  metadata: AggregatedPropertyMetadata,
  validationMode: ValidationMode
) {
  return ({ value }: { value: unknown }) => {
    // No validation mode: skip all validation
    if (validationMode === "none") {
      return undefined;
    }

    const isRelaxed = validationMode === "relaxed";

    // Required field validation
    // In relaxed mode, only validate if universallyRequired
    const isRequired = isRelaxed
      ? metadata.universallyRequired
      : metadata.required;
    if (isRequired && (value === undefined || value === null || value === "")) {
      return `${metadata.title ?? metadata.property} is required`;
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    // In relaxed mode, skip min/max validation (defaults can be overridden)
    if (isRelaxed) {
      // Only validate enum values in relaxed mode
      if (metadata.type === "enum" && metadata.enumValues?.length) {
        const stringValue = String(value);
        const isValid = metadata.enumValues.some(
          (v) => String(v) === stringValue
        );
        if (!isValid) {
          return `Invalid value. Must be one of: ${metadata.enumValues.join(
            ", "
          )}`;
        }
      }
      return undefined;
    }

    // Strict mode: full validation

    // Dimension field validation with unit conversion
    if (metadata.dimension && typeof value === "string" && value.trim()) {
      const defaultUnit = metadata.defaultUnit || "";

      // Only validate min/max if we have a default unit to convert to
      if (
        defaultUnit &&
        (metadata.min !== undefined || metadata.max !== undefined)
      ) {
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
        return `Invalid value. Must be one of: ${metadata.enumValues.join(
          ", "
        )}`;
      }
    }

    return undefined;
  };
}
