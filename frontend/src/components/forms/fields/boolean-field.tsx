"use client";

import { FieldLabel, FieldDescription, FieldError } from "./field-label";
import type { BaseFieldProps } from "./types";
import { cn } from "@/lib/utils";

export function BooleanField({
  metadata,
  field,
  disabled,
  className,
}: BaseFieldProps) {
  const fieldId = `field-${metadata.property}`;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center space-x-2">
        <input
          id={fieldId}
          name={field.name}
          type="checkbox"
          checked={Boolean(field.state.value)}
          onChange={(e) => field.handleChange(e.target.checked)}
          onBlur={field.handleBlur}
          disabled={disabled}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <FieldLabel metadata={metadata} htmlFor={fieldId} />
      </div>
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
