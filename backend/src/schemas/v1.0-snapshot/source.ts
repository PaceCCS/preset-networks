import { Schema } from "effect";

export const SourceSchema = Schema.Struct({
  type: Schema.Literal("Source"),
  quantity: Schema.optional(Schema.Number),

  flowrate: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "massFlowrate",
      defaultUnit: "Mt/a",
      title: "Flowrate",
    }),
  ),

  pressure: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "pressure",
      defaultUnit: "bar",
      title: "Pressure",
    }),
  ),

  temperature: Schema.Number.pipe(
    Schema.annotations({
      dimension: "temperature",
      defaultUnit: "°C",
      title: "Temperature",
    }),
  ),
});

export type Source = Schema.Schema.Type<typeof SourceSchema>;
