"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel, FieldDescription, FieldError } from "./field-label";
import type { BaseFieldProps } from "./types";
import { cn } from "@/lib/utils";

export function EnumField({
  metadata,
  field,
  disabled,
  className,
}: BaseFieldProps) {
  const fieldId = `field-${metadata.property}`;
  const enumValues = metadata.enumValues ?? [];

  return (
    <div className={cn("space-y-2", className)}>
      <FieldLabel metadata={metadata} htmlFor={fieldId} />
      <Select
        name={field.name}
        value={field.state.value?.toString() ?? ""}
        onValueChange={(value) => {
          // Try to preserve the original type
          const originalValue = enumValues.find(
            (v) => v.toString() === value
          );
          field.handleChange(originalValue ?? value);
        }}
        disabled={disabled}
      >
        <SelectTrigger id={fieldId} className="w-full">
          <SelectValue placeholder={`Select ${metadata.title ?? metadata.property}`} />
        </SelectTrigger>
        <SelectContent>
          {enumValues.map((value) => (
            <SelectItem key={String(value)} value={String(value)}>
              {formatEnumValue(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription description={metadata.description} />
      <FieldError
        error={
          field.state.meta.isTouched && field.state.meta.errors.length > 0
            ? field.state.meta.errors.join(", ")
            : undefined
        }
      />
    </div>
  );
}

/**
 * Format enum value for display.
 * Converts snake_case or camelCase to Title Case.
 */
function formatEnumValue(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return value.toString();
  }
  // Convert snake_case or camelCase to Title Case
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
