"use client";

import type { PropertyMetadata } from "@/hooks/use-schema-properties";
import { cn } from "@/lib/utils";

type FieldLabelProps = {
  metadata: PropertyMetadata;
  htmlFor?: string;
  className?: string;
};

export function FieldLabel({ metadata, htmlFor, className }: FieldLabelProps) {
  const label = metadata.title ?? metadata.property;
  const isRequired = metadata.required;

  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
    >
      {label}
      {isRequired && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

export function FieldDescription({
  description,
  className,
}: {
  description?: string;
  className?: string;
}) {
  if (!description) return null;

  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {description}
    </p>
  );
}

export function FieldError({
  error,
  className,
}: {
  error?: string;
  className?: string;
}) {
  if (!error) return null;

  return (
    <p className={cn("text-sm text-destructive", className)}>{error}</p>
  );
}
