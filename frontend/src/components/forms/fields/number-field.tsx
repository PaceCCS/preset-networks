"use client";

import { Input } from "@/components/ui/input";
import { FieldLabel, FieldDescription, FieldError } from "./field-label";
import type { BaseFieldProps } from "./types";
import { cn } from "@/lib/utils";

export function NumberField({
  metadata,
  field,
  disabled,
  className,
}: BaseFieldProps) {
  const fieldId = `field-${metadata.property}`;

  return (
    <div className={cn("space-y-2", className)}>
      <FieldLabel metadata={metadata} htmlFor={fieldId} />
      <Input
        id={fieldId}
        name={field.name}
        type="number"
        value={field.state.value !== undefined ? String(field.state.value) : ""}
        onChange={(e) => {
          const value = e.target.value;
          field.handleChange(value === "" ? undefined : Number(value));
        }}
        onBlur={field.handleBlur}
        disabled={disabled}
        min={metadata.min}
        max={metadata.max}
        step="any"
        placeholder={metadata.description}
      />
      <div className="flex justify-between">
        <FieldDescription description={metadata.description} />
        {(metadata.min !== undefined || metadata.max !== undefined) && (
          <span className="text-xs text-muted-foreground">
            {metadata.min !== undefined && `Min: ${metadata.min}`}
            {metadata.min !== undefined && metadata.max !== undefined && " | "}
            {metadata.max !== undefined && `Max: ${metadata.max}`}
          </span>
        )}
      </div>
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
