"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { FieldLabel, FieldDescription, FieldError } from "./field-label";
import type { BaseFieldProps } from "./types";
import { cn } from "@/lib/utils";
import { useDim } from "@/lib/dim/use-dim";
import { Badge } from "@/components/ui/badge";
import { CheckIcon, XIcon } from "lucide-react";

/**
 * DimensionField handles dimensional quantities (values with units).
 *
 * Works like QuantityInput:
 * - User types a number -> we append the default unit for storage/validation
 * - User types "100 bar" -> we use that directly
 * - User types an expression "20*MW" -> we use that directly
 *
 * The stored value is always the full expression (e.g., "100 km").
 */
export function DimensionField({
  metadata,
  field,
  disabled,
  className,
}: BaseFieldProps) {
  const fieldId = `field-${metadata.property}`;
  const defaultUnit = metadata.defaultUnit ?? "";

  // Local state for what the user is typing
  // Initialize from field value, stripping the default unit if it's just "number unit"
  const getDisplayValue = (value: unknown): string => {
    if (value === undefined || value === null || value === "") {
      return "";
    }
    const strValue = String(value).trim();
    // If it's exactly "number defaultUnit", show just the number
    const match = strValue.match(/^([\d.]+)\s+(.+)$/);
    if (match && match[2] === defaultUnit) {
      return match[1];
    }
    return strValue;
  };

  const [inputValue, setInputValue] = useState(() =>
    getDisplayValue(field.state.value)
  );

  // Build expression for validation: if just a number, append default unit
  const getExpression = useCallback(
    (value: string): string | undefined => {
      if (!value.trim()) return undefined;

      // If it's just a number, append the default unit
      if (!isNaN(Number(value.trim())) && defaultUnit) {
        return `${value.trim()} ${defaultUnit}`;
      }

      // Otherwise use as-is (could be "100 bar" or "20*MW")
      return value.trim();
    },
    [defaultUnit]
  );

  const expression = getExpression(inputValue);

  // Validate using useDim hook
  const { status, results } = useDim(expression ? [expression] : [], {
    silenceErrors: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Update form value with the full expression
    const expr = getExpression(newValue);
    field.handleChange(expr);
  };

  const isValid = status === "success" && results.length === 1;

  // Get error message
  const errorMessage =
    field.state.meta.isTouched && field.state.meta.errors.length > 0
      ? field.state.meta.errors.filter(Boolean).join(", ")
      : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <FieldLabel metadata={metadata} htmlFor={fieldId} />
      <div className="flex flex-row gap-1 items-center">
        <Input
          id={fieldId}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onBlur={field.handleBlur}
          disabled={disabled}
          placeholder={defaultUnit ? `e.g., 100 or 100 ${defaultUnit}` : "Enter value"}
          autoComplete="off"
          className="flex-1"
        />
        {inputValue && status === "success" && (
          <Badge variant="default" className="size-6 px-0.5">
            {isValid ? (
              <CheckIcon className="size-4" />
            ) : (
              <XIcon className="size-4" />
            )}
          </Badge>
        )}
        {inputValue && status === "error" && (
          <Badge variant="destructive" className="size-6 px-0.5">
            <XIcon className="size-4" />
          </Badge>
        )}
      </div>
      {defaultUnit && (
        <p className="text-xs text-muted-foreground">
          Default unit: {defaultUnit}
        </p>
      )}
      <FieldDescription description={metadata.description} />
      <FieldError error={errorMessage} />
    </div>
  );
}
