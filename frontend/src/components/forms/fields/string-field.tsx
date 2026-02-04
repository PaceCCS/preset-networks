"use client";

import { Input } from "@/components/ui/input";
import { FieldLabel, FieldDescription, FieldError } from "./field-label";
import type { BaseFieldProps } from "./types";
import { cn } from "@/lib/utils";

export function StringField({
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
        value={(field.state.value as string) ?? ""}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        disabled={disabled}
        placeholder={metadata.description}
      />
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
