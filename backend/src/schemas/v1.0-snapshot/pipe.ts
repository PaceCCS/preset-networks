import { Schema } from "effect";

export const PipeSchema = Schema.Struct({
  type: Schema.Literal("Pipe"),
  quantity: Schema.optional(Schema.Number),
  elevationProfile: Schema.String.pipe(
    Schema.annotations({
      dimension: "string",
      defaultUnit: "",
      title: "Elevation Profile",
    }),
  ),

  diameter: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "length",
      defaultUnit: "m",
      title: "Diameter",
    }),
  ),
  uValue: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "uValue",
      defaultUnit: "W/m²*K",
      title: "U-Value",
    }),
  ),
  ambientTemperature: Schema.Number.pipe(
    Schema.greaterThan(0),
    Schema.annotations({
      dimension: "temperature",
      defaultUnit: "°C",
      title: "Ambient Temperature",
    }),
  ),
});

export type Pipe = Schema.Schema.Type<typeof PipeSchema>;
