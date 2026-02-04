import { Schema } from "effect";
import { schemaRegistry } from "../schemas/index";

export type PropertyMetadata = {
  dimension?: string;
  defaultUnit?: string;
  title?: string;
  min?: number;
  max?: number;
  type: "number" | "string" | "enum" | "boolean";
  description?: string;
  enumValues?: (string | number | boolean)[];
};

export type SchemaMetadata = {
  blockType: string;
  schemaSet: string;
  required: string[];
  optional: string[];
  properties: Record<string, PropertyMetadata>;
};

/**
 * Get a schema from the registry
 */
export function getSchema(
  schemaSet: string,
  blockType: string
): Schema.Schema<unknown> | undefined {
  const registry = schemaRegistry as Record<
    string,
    Record<string, Schema.Schema<unknown>>
  >;
  return registry[schemaSet]?.[blockType];
}

/**
 * List all available schema sets
 */
export function listSchemaSets(): string[] {
  return Object.keys(schemaRegistry);
}

/**
 * List all block types for a given schema set
 */
export function listBlockTypes(schemaSet: string): string[] {
  const registry = schemaRegistry as Record<
    string,
    Record<string, Schema.Schema<any>>
  >;
  return Object.keys(registry[schemaSet] || {});
}

/**
 * Extract annotations from a schema
 * Annotations are stored in the AST's annotations object
 */
function getAnnotations(schema: Schema.Schema<any>): Record<string, any> {
  try {
    // Effect Schema stores annotations in the AST
    const ast = (schema as any).ast;
    if (!ast) {
      return {};
    }

    // Get annotations from AST - they're stored as a plain object
    const annotations = ast.annotations || {};

    // Extract plain object properties (not Symbol keys)
    const result: Record<string, any> = {};
    for (const key in annotations) {
      // Skip Symbol keys, only get string keys
      if (typeof key === "string") {
        result[key] = annotations[key];
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Extract property metadata from a schema property
 */
function getPropertyMetadata(
  propertySchema: Schema.Schema<unknown>
): PropertyMetadata {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schemaAny = propertySchema as any;

  // Get the AST - check the schema itself first
  let ast = schemaAny.ast;

  // If no AST on the schema itself, and it has a 'from' field, check the 'from' schema
  // This handles optional properties (PropertySignatureWithFromImpl) where the actual schema is in 'from'
  if (!ast && schemaAny.from) {
    const fromSchema = schemaAny.from;
    // Check if fromSchema has an ast (it might be a Refinement or other schema type)
    if (fromSchema && typeof fromSchema === "object" && "ast" in fromSchema) {
      ast = fromSchema.ast;
    }
  }

  if (!ast) {
    return { type: "string" };
  }

  const annotations = ast.annotations || {};

  // Extract enum values first (needed for type inference)
  const enumValues = extractEnumValues(ast);

  // Infer property type
  const propertyType = inferPropertyType(ast, enumValues);

  // Extract description
  const description = extractDescription(ast);

  const metadata: PropertyMetadata = {
    type: propertyType,
  };

  // Add enum values if present
  if (enumValues && enumValues.length > 0) {
    metadata.enumValues = enumValues;
  }

  // Add description if present
  if (description) {
    metadata.description = description;
  }

  // Extract plain object properties from annotations (string keys)
  const stringKeys = Object.keys(annotations);
  for (const key of stringKeys) {
    const value = annotations[key];
    if (key === "dimension") {
      metadata.dimension = String(value);
    } else if (key === "defaultUnit") {
      metadata.defaultUnit = String(value);
    } else if (key === "title") {
      metadata.title = String(value);
    } else if (key === "description" && !metadata.description) {
      metadata.description = String(value);
    }
  }

  // Extract title from Symbol key (Effect Schema stores it as Symbol(effect/annotation/Title))
  const symbolKeys = Object.getOwnPropertySymbols(annotations);
  for (const key of symbolKeys) {
    const keyStr = String(key);
    if (keyStr.includes("Title")) {
      metadata.title = String(annotations[key]);
    }
  }

  // Extract min/max from constraints in JSONSchema annotation
  metadata.min = extractMinConstraint(ast);
  metadata.max = extractMaxConstraint(ast);

  return metadata;
}

/**
 * Extract min constraint from schema AST
 * Constraints are stored in annotations JSONSchema object
 * Need to traverse nested refinements to find all constraints
 */
function extractMinConstraint(ast: any): number | undefined {
  if (!ast) return undefined;

  // Check annotations for JSONSchema with minimum/exclusiveMinimum
  const annotations = ast.annotations || {};

  // Find the JSONSchema annotation (it's a Symbol key)
  let jsonSchema: any = undefined;
  for (const key of Object.getOwnPropertySymbols(annotations)) {
    if (String(key).includes("JSONSchema")) {
      jsonSchema = annotations[key];
      break;
    }
  }

  if (jsonSchema) {
    if (jsonSchema.minimum !== undefined) {
      return jsonSchema.minimum;
    }
    if (jsonSchema.exclusiveMinimum !== undefined) {
      return jsonSchema.exclusiveMinimum;
    }
  }

  // If this is a Refinement, check the nested refinement chain
  // ast.from is the nested AST itself, not an object with an ast property
  if (
    ast._tag === "Refinement" &&
    ast.from &&
    typeof ast.from === "object" &&
    ast.from._tag
  ) {
    const nestedMin = extractMinConstraint(ast.from);
    if (nestedMin !== undefined) {
      return nestedMin;
    }
  }

  return undefined;
}

/**
 * Extract max constraint from schema AST
 * Constraints are stored in annotations JSONSchema object
 * Need to traverse nested refinements to find all constraints
 */
function extractMaxConstraint(ast: any): number | undefined {
  if (!ast) return undefined;

  // Check annotations for JSONSchema with maximum/exclusiveMaximum
  const annotations = ast.annotations || {};

  // Find the JSONSchema annotation (it's a Symbol key)
  let jsonSchema: any = undefined;
  for (const key of Object.getOwnPropertySymbols(annotations)) {
    if (String(key).includes("JSONSchema")) {
      jsonSchema = annotations[key];
      break;
    }
  }

  if (jsonSchema) {
    if (jsonSchema.maximum !== undefined) {
      return jsonSchema.maximum;
    }
    if (jsonSchema.exclusiveMaximum !== undefined) {
      return jsonSchema.exclusiveMaximum;
    }
  }

  // If this is a Refinement, check the nested refinement chain
  // ast.from is the nested AST itself, not an object with an ast property
  if (
    ast._tag === "Refinement" &&
    ast.from &&
    typeof ast.from === "object" &&
    ast.from._tag
  ) {
    const nestedMax = extractMaxConstraint(ast.from);
    if (nestedMax !== undefined) {
      return nestedMax;
    }
  }

  return undefined;
}

/**
 * Extract literal values from Effect Schema AST for enum fields.
 * Handles both single literals and unions of literals (Schema.Literal("a", "b", "c"))
 */
function extractEnumValues(
  ast: any
): (string | number | boolean)[] | undefined {
  if (!ast) return undefined;

  // Single literal: Schema.Literal("value")
  if (ast._tag === "Literal") {
    return [ast.literal];
  }

  // Union of literals: Schema.Literal("a", "b", "c")
  if (ast._tag === "Union" && ast.types) {
    const literals = ast.types
      .filter((t: any) => t._tag === "Literal")
      .map((t: any) => t.literal);

    // Only return if ALL types are literals (not mixed union)
    if (literals.length === ast.types.length && literals.length > 0) {
      return literals;
    }
  }

  // Check if this is a Refinement wrapping a Literal/Union
  if (ast._tag === "Refinement" && ast.from) {
    return extractEnumValues(ast.from);
  }

  return undefined;
}

/**
 * Infer the property type from Effect Schema AST.
 * Returns "enum" if enum values are present, otherwise infers from AST tag.
 */
function inferPropertyType(
  ast: any,
  enumValues?: (string | number | boolean)[]
): PropertyMetadata["type"] {
  if (enumValues && enumValues.length > 0) return "enum";
  if (!ast) return "string";

  if (ast._tag === "BooleanKeyword") return "boolean";
  if (ast._tag === "NumberKeyword") return "number";
  if (ast._tag === "StringKeyword") return "string";

  // Handle Refinement by checking base type
  if (ast._tag === "Refinement" && ast.from) {
    return inferPropertyType(ast.from, enumValues);
  }

  // Handle Union (non-literal union falls through to string)
  if (ast._tag === "Union") {
    // If we got here, it's not a pure literal union (enumValues would be set)
    // Check if it's a union of same primitive types
    const types = ast.types || [];
    const hasNumber = types.some((t: any) => t._tag === "NumberKeyword");
    const hasString = types.some((t: any) => t._tag === "StringKeyword");
    const hasBoolean = types.some((t: any) => t._tag === "BooleanKeyword");

    if (hasNumber && !hasString && !hasBoolean) return "number";
    if (hasBoolean && !hasString && !hasNumber) return "boolean";
  }

  // Handle Literal
  if (ast._tag === "Literal") {
    const literal = ast.literal;
    if (typeof literal === "boolean") return "boolean";
    if (typeof literal === "number") return "number";
    return "string";
  }

  return "string";
}

/**
 * Extract description from schema annotations.
 */
function extractDescription(ast: any): string | undefined {
  if (!ast) return undefined;

  const annotations = ast.annotations || {};

  // Check string keys first
  if (annotations.description) {
    return String(annotations.description);
  }

  // Check Symbol keys for Description annotation
  const symbolKeys = Object.getOwnPropertySymbols(annotations);
  for (const key of symbolKeys) {
    const keyStr = String(key);
    if (keyStr.includes("Description")) {
      return String(annotations[key]);
    }
  }

  // Check nested refinements
  if (ast._tag === "Refinement" && ast.from) {
    return extractDescription(ast.from);
  }

  return undefined;
}

/**
 * Check if a property is optional in a struct schema
 */
function isOptionalProperty(
  structSchema: Schema.Schema<unknown>,
  propertyName: string
): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ast = (structSchema as any).ast;
    if (ast && ast._tag === "TypeLiteral") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const property = ast.propertySignatures?.find(
        (p: any) => p.name === propertyName
      );
      if (property) {
        return property.isOptional === true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get all property names from a struct schema
 */
function getPropertyNames(structSchema: Schema.Schema<unknown>): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ast = (structSchema as any).ast;
    if (ast && ast._tag === "TypeLiteral") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ast.propertySignatures?.map((p: any) => p.name) || [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Get property schema from a struct schema
 * For optional properties, the type is a Union, we need to extract the actual schema
 * We use the fields directly from the schema object for better access
 */
function getPropertySchema(
  structSchema: Schema.Schema<unknown>,
  propertyName: string
): Schema.Schema<unknown> | undefined {
  try {
    // Access the schema's fields directly - this gives us the actual schema objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaAny = structSchema as any;
    const fields = schemaAny.fields;
    if (fields && fields[propertyName]) {
      return fields[propertyName];
    }

    // Fallback: try AST approach
    const ast = schemaAny.ast;
    if (ast && ast._tag === "TypeLiteral") {
      const property = ast.propertySignatures?.find(
        (p: any) => p.name === propertyName
      );
      if (property) {
        // For optional properties, type is a Union, extract the non-undefined branch
        if (property.isOptional && property.type._tag === "Union") {
          // Find the non-undefined type in the union
          const nonUndefined = property.type.types?.find(
            (t: any) => t._tag !== "UndefinedKeyword"
          );
          return nonUndefined || property.type;
        }
        // For required properties, return the type directly
        return property.type;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get complete schema metadata including all properties
 */
export function getSchemaMetadata(
  schemaSet: string,
  blockType: string
): SchemaMetadata | null {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return null;
  }

  const propertyNames = getPropertyNames(schema);
  const required: string[] = [];
  const optional: string[] = [];
  const properties: Record<string, PropertyMetadata> = {};

  for (const propName of propertyNames) {
    // Skip type and quantity as they're always present
    if (propName === "type" || propName === "quantity") {
      continue;
    }

    const isOptional = isOptionalProperty(schema, propName);
    if (isOptional) {
      optional.push(propName);
    } else {
      required.push(propName);
    }

    // Get schema directly from fields - this works for both required and optional
    const schemaAny = schema as any;
    let propSchema: Schema.Schema<any> | undefined;

    if (schemaAny.fields && schemaAny.fields[propName]) {
      propSchema = schemaAny.fields[propName];

      // For optional properties, the field is a PropertySignatureWithFromImpl
      // We need to get the actual schema from the 'from' field
      // But only do this if the property is optional (required properties with refinements should use the schema directly)
      if (isOptional && propSchema && (propSchema as any).from) {
        propSchema = (propSchema as any).from;
      }
    } else {
      // Fallback to getPropertySchema
      propSchema = getPropertySchema(schema, propName);
    }

    if (propSchema) {
      properties[propName] = getPropertyMetadata(propSchema);
    }
  }

  return {
    blockType,
    schemaSet,
    required,
    optional,
    properties,
  };
}

/**
 * Get property constraints (min/max) for a specific property
 */
export function getPropertyConstraints(
  schemaSet: string,
  blockType: string,
  propertyName: string
): { min?: number; max?: number } {
  const schema = getSchema(schemaSet, blockType);
  if (!schema) {
    return {};
  }

  const propSchema = getPropertySchema(schema, propertyName);
  if (!propSchema) {
    return {};
  }

  const metadata = getPropertyMetadata(propSchema);
  return {
    min: metadata.min,
    max: metadata.max,
  };
}
