/**
 * Compare adapter output against snapshot-request-example.json
 */
import { describe, it, expect } from "vitest";
import { transformNetworkToSnapshotConditions } from "./network-adapter";
import * as fs from "fs/promises";
import * as path from "path";

describe("snapshot-example network adapter output", () => {
  it("should match the structure of snapshot-request-example.json", async () => {
    const result = await transformNetworkToSnapshotConditions(
      { type: "networkId", networkId: "snapshot-example" },
      "v1.0-snapshot",
    );

    const examplePath = path.resolve(
      __dirname,
      "../../routes/snapshot-request-example.json",
    );
    const example = JSON.parse(await fs.readFile(examplePath, "utf-8"));

    // Strip network-level conditions from example (those come from route, not adapter)
    const exampleConditions = { ...example.conditions };
    delete exampleConditions["network|Network|airMedium"];
    delete exampleConditions["network|Network|soilMedium"];
    delete exampleConditions["network|Network|waterMedium"];

    const actualStructure = result.networkStructure;
    const expectedStructure = example.structure;

    const errors: string[] = [];

    // ===== Check conditions (adapter-produced) =====
    for (const [key, value] of Object.entries(exampleConditions)) {
      if (!result.conditions[key]) {
        errors.push(`CONDITION MISSING: ${key}`);
      } else if (JSON.stringify(result.conditions[key]) !== JSON.stringify(value)) {
        errors.push(`CONDITION MISMATCH: ${key} actual=${JSON.stringify(result.conditions[key])} expected=${JSON.stringify(value)}`);
      }
    }

    // ===== Check subnet keys =====
    const actualSubnetKeys = Object.keys(actualStructure.subnets).sort();
    const expectedSubnetKeys = Object.keys(expectedStructure.subnets).sort();
    if (JSON.stringify(actualSubnetKeys) !== JSON.stringify(expectedSubnetKeys)) {
      errors.push(`SUBNET KEYS: actual=${JSON.stringify(actualSubnetKeys)} expected=${JSON.stringify(expectedSubnetKeys)}`);
    }

    // ===== Check each subnet =====
    for (const subnetKey of expectedSubnetKeys) {
      const actual = actualStructure.subnets[subnetKey];
      const expected = expectedStructure.subnets[subnetKey];
      if (!actual) { errors.push(`SUBNET MISSING: ${subnetKey}`); continue; }

      if (actual.downstreamSubnetName !== expected.downstreamSubnetName) {
        errors.push(`SUBNET ${subnetKey} downstreamSubnetName: actual="${actual.downstreamSubnetName}" expected="${expected.downstreamSubnetName}"`);
      }
      if (JSON.stringify(actual.componentSeriesMap) !== JSON.stringify(expected.componentSeriesMap)) {
        errors.push(`SUBNET ${subnetKey} componentSeriesMap:\n  actual=${JSON.stringify(actual.componentSeriesMap)}\n  expected=${JSON.stringify(expected.componentSeriesMap)}`);
      }
    }

    // ===== Check series keys =====
    const actualSeriesKeys = new Set(Object.keys(actualStructure.series));
    const expectedSeriesKeys = new Set(Object.keys(expectedStructure.series));
    for (const key of expectedSeriesKeys) {
      if (!actualSeriesKeys.has(key)) errors.push(`SERIES KEY MISSING: ${key}`);
    }
    for (const key of actualSeriesKeys) {
      if (!expectedSeriesKeys.has(key)) errors.push(`SERIES KEY EXTRA: ${key}`);
    }

    // ===== Check series component details =====
    for (const [seriesKey, expectedComponents] of Object.entries(expectedStructure.series) as [string, any[]][]) {
      const actualComponents = actualStructure.series[seriesKey];
      if (!actualComponents) continue;

      if (actualComponents.length !== expectedComponents.length) {
        errors.push(`SERIES ${seriesKey}: length actual=${actualComponents.length} expected=${expectedComponents.length}`);
      }

      for (let i = 0; i < Math.max(actualComponents.length, expectedComponents.length); i++) {
        const actual = actualComponents[i];
        const expected = expectedComponents[i];
        if (!actual) { errors.push(`SERIES ${seriesKey}[${i}]: MISSING in actual`); continue; }
        if (!expected) { errors.push(`SERIES ${seriesKey}[${i}]: EXTRA in actual: ${JSON.stringify(actual)}`); continue; }

        if (actual.elem !== expected.elem) {
          errors.push(`SERIES ${seriesKey}[${i}].elem: actual="${actual.elem}" expected="${expected.elem}"`);
        }
        if (actual.name !== expected.name) {
          errors.push(`SERIES ${seriesKey}[${i}].name: actual="${actual.name}" expected="${expected.name}"`);
        }

        // Check all expected properties
        const allKeys = new Set([...Object.keys(expected)]);
        for (const key of allKeys) {
          if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) {
            errors.push(`SERIES ${seriesKey}[${i}].${key}: actual=${JSON.stringify(actual[key])} expected=${JSON.stringify(expected[key])}`);
          }
        }

        // Check for unexpected properties (only flag important ones)
        for (const key of Object.keys(actual)) {
          if (!(key in expected)) {
            errors.push(`SERIES ${seriesKey}[${i}].${key}: EXTRA property, value=${JSON.stringify(actual[key])}`);
          }
        }
      }
    }

    // Print all errors and fail if any
    if (errors.length > 0) {
      console.log("\n===== ALL DIFFERENCES =====");
      for (const e of errors) console.log(e);
      console.log(`\nTotal differences: ${errors.length}`);
    }

    expect(errors).toEqual([]);
  });
});
