/**
 * Integration tests for the costing adapter.
 *
 * These tests verify the full integration path:
 * 1. Unit conversion via dim (e.g., "100 t/h" → kg/h, "100 m^3/h" → m³/h)
 * 2. Transformation to costing server request format
 * 3. Calling the actual costing server
 * 4. Transforming response back to our format
 *
 * Prerequisites:
 * - Costing server running at http://localhost:8080
 *
 * Run with: npm run test:costing:integration
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  transformNetworkToCostingRequest,
  transformCostingResponse,
} from "./adapter";
import type { NetworkSource, NetworkData } from "./request-types";
import type { CostEstimateResponse } from "./types";

const COSTING_SERVER_URL =
  process.env.COSTING_SERVER_URL || "http://localhost:8080";
const LIBRARY_ID = "V1.1_working";

// Helper to check if costing server is available
async function isCostingServerAvailable(): Promise<boolean> {
  try {
    // Try the API endpoint with empty request
    const response = await fetch(
      `${COSTING_SERVER_URL}/api/cost/estimate?library_id=${LIBRARY_ID}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: [] }),
        signal: AbortSignal.timeout(5000),
      },
    );
    // Server is available if we get a response (even error response)
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

// Helper to call costing server
async function callCostingServer(
  request: unknown,
  libraryId: string = LIBRARY_ID,
  currency: string = "EUR",
): Promise<CostEstimateResponse> {
  const url = `${COSTING_SERVER_URL}/api/cost/estimate?library_id=${libraryId}&target_currency_code=${currency}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Costing server error: ${response.status} - ${text}`);
  }

  return response.json();
}

// Helper to parse EUR amount from string like "€1,012,452.60"
function parseEurAmount(str: string): number {
  return parseFloat(str.replace(/[€,]/g, ""));
}

describe("adapter integration tests", () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await isCostingServerAvailable();
    if (!serverAvailable) {
      console.warn(
        "⚠️  Costing server not available - skipping integration tests",
      );
    }
  });

  describe("reference network: Capture Unit (Amine)", () => {
    /**
     * Reference test from costing.spec.ts:
     * - Module: Amine (Capture Unit)
     * - Properties: Mass flow = 100 kg/h, Parallel splits = 3
     * - Expected direct equipment: €1,012,452.60
     * - Expected total installed: €3,796,697.23
     */
    it("produces correct costs for Amine capture unit", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // Construct network with single Capture Unit block
      // Uses unit strings to exercise dim parsing
      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "capture-branch",
            label: "Capture Unit",
            blocks: [
              {
                type: "CaptureUnit",
                capture_technology: "amine",
                mass_flow: "100 kg/h", // Cost library expects kg/h
                quantity: 3, // "Parallel splits" = 3 in the e2e test
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        },
      );

      expect(request.assets.length).toBe(1);
      expect(request.assets[0].cost_items.length).toBe(1);

      // Call costing server
      const costingResponse = await callCostingServer(request);

      // Transform response
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR",
      );

      // Expected values from e2e test (in EUR)
      const expectedDirectEquipment = parseEurAmount("€1,012,452.60");
      const expectedTotalInstalled = parseEurAmount("€3,796,697.23");

      expect(result.assets.length).toBe(1);
      expect(result.assets[0].lifetimeCosts.directEquipmentCost).toBeCloseTo(
        expectedDirectEquipment,
        0,
      );
      expect(result.assets[0].lifetimeCosts.totalInstalledCost).toBeCloseTo(
        expectedTotalInstalled,
        0,
      );
    });
  });

  describe("reference network: LP Compression (Electric Drive)", () => {
    /**
     * Reference test from costing.spec.ts:
     * - Module: LP Compression (1 to 40 bar) (Electric Drive)
     * - Properties: Compressor Duty = 100 MW, Electrical power (2x) = 100 kW, Cooling duty = 100 MW, Parallel splits = 2
     * - Expected direct equipment: €598,507,194.81
     *
     * Block properties use flat structure with item-specific suffixes:
     * - electrical_power_compressor → Item 007's "Electrical power"
     * - electrical_power_cooler → Item 008's "Electrical power"
     */
    it("produces costs for LP Compression with item-specific parameters", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "lp-compression-branch",
            label: "LP Compression (1 to 40 bar)",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "lp",
                drive_type: "electric",
                // Scaling factors - using unit strings
                compressor_duty: "100 MW", // scales compressor (Item 007)
                cooling_duty: "100 MW", // scales after-cooler (Item 008)
                // Item-specific electrical power (for variable OPEX)
                electrical_power_compressor: "100 kW", // compressor motor (Item 007)
                electrical_power_cooler: "100 kW", // cooler fans (Item 008)
                quantity: 2, // Parallel splits
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        },
      );

      expect(request.assets.length).toBe(1);
      // Should now have 2 cost items: one for compressor (Item 007), one for cooler (Item 008)
      expect(request.assets[0].cost_items.length).toBe(2);

      const costingResponse = await callCostingServer(request);
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR",
      );

      // Log for comparison - e2e expects €598,507,194.81
      console.log(
        `LP Compression direct equipment: €${result.assets[0].lifetimeCosts.directEquipmentCost.toLocaleString()}`,
      );
      console.log(`Expected (e2e): €598,507,194.81`);

      // Verify we get the expected cost
      const expectedDirectEquipment = parseEurAmount("€598,507,194.81");
      expect(result.assets[0].lifetimeCosts.directEquipmentCost).toBeCloseTo(
        expectedDirectEquipment,
        0,
      );
    });
  });

  describe("reference network: multi-asset chain", () => {
    /**
     * Test multiple assets in a chain.
     * Uses a subset of modules that we can reliably map.
     * All values use unit strings to exercise dim parsing.
     */
    it("produces costs for multiple assets", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // Simpler chain with modules we know work
      // Uses unit strings to exercise dim
      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "capture",
            label: "Capture Unit",
            blocks: [
              {
                type: "CaptureUnit",
                capture_technology: "amine",
                mass_flow: "100 kg/h",
                quantity: 3,
              },
            ],
          },
          {
            id: "lp-compression",
            label: "LP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "lp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
                cooling_duty: "100 MW",
                quantity: 2,
              },
            ],
          },
          {
            id: "hp-compression",
            label: "HP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "hp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
                cooling_duty: "100 MW",
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        },
      );

      console.log(
        "Multi-asset chain - Assets generated:",
        request.assets.length,
      );
      console.log(
        "Multi-asset chain - Asset IDs:",
        request.assets.map((a) => a.id),
      );

      expect(request.assets.length).toBe(3);

      const costingResponse = await callCostingServer(request);
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR",
      );

      // Log results
      console.log(
        "Network total direct equipment:",
        `€${result.lifetimeCosts.directEquipmentCost.toLocaleString()}`,
      );
      for (const asset of result.assets) {
        console.log(
          `  ${asset.id}: €${asset.lifetimeCosts.directEquipmentCost.toLocaleString()}`,
        );
      }

      // Verify structure
      expect(result.assets.length).toBe(3);
      expect(result.lifetimeCosts.directEquipmentCost).toBeGreaterThan(0);

      // All assets should have costs
      for (const asset of result.assets) {
        expect(asset.lifetimeCosts.directEquipmentCost).toBeGreaterThan(0);
      }
    });
  });

  describe("reference network: inline data (for comparison)", () => {
    /**
     * Inline data test for quick verification without file I/O.
     * Uses unit strings to exercise dim conversion.
     */
    it("produces correct costs with inline data using unit strings", async () => {
      if (!serverAvailable) {
        console.log("Skipping - costing server not available");
        return;
      }

      // Inline network with unit strings (same as TOML files)
      // These match the reference e2e test values
      const network: NetworkData = {
        groups: [],
        branches: [
          {
            id: "branch-source",
            label: "CO2 Source",
            blocks: [
              {
                type: "Emitter",
                emitter_type: "cement",
                mass_flow: "100 kg/h", // Cost library expects kg/h
              },
            ],
          },
          {
            id: "branch-capture",
            label: "Capture Unit",
            blocks: [
              {
                type: "CaptureUnit",
                capture_technology: "amine",
                mass_flow: "100 kg/h", // Cost library expects kg/h
                quantity: 3,
              },
            ],
          },
          {
            id: "branch-lp-compression",
            label: "LP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "lp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                cooling_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
                quantity: 2,
              },
            ],
          },
          {
            id: "branch-dehydration",
            label: "Dehydration",
            blocks: [
              {
                type: "Dehydration",
                dehydration_type: "molecular_sieve",
                mass_flow_co2: "100 MTPA",
              },
            ],
          },
          {
            id: "branch-hp-compression",
            label: "HP Compression",
            blocks: [
              {
                type: "Compressor",
                pressure_range: "hp",
                drive_type: "electric",
                compressor_duty: "100 MW",
                cooling_duty: "100 MW",
                electrical_power_compressor: "100 kW",
                electrical_power_cooler: "100 kW",
              },
            ],
          },
          {
            id: "branch-refrigeration",
            label: "Refrigeration",
            blocks: [
              {
                type: "Refrigeration",
                pressure_class: "ep",
                cooling_method: "water",
                heat_duty: "100 MW",
                cooling_water: "100 m^3/h", // Volumetric flow - dim parses m^3/h
              },
            ],
          },
          {
            id: "branch-shipping",
            label: "Shipping",
            blocks: [
              {
                type: "Shipping",
                pressure_class: "ep",
              },
            ],
          },
          {
            id: "branch-fisu",
            label: "FISU",
            blocks: [
              {
                type: "OffshorePlatform",
                platform_type: "fisu",
                number_of_fisu_vessels: 100,
              },
            ],
          },
          {
            id: "branch-injection-topsides",
            label: "Injection Topsides",
            blocks: [
              {
                type: "InjectionTopsides",
                location: "offshore",
                pump_motor_rating: "100 kW",
                pump_flowrate: "100 m^3/h", // Volumetric flow - dim parses m^3/h
                heater_duty: "100 MW",
                electrical_power_pump: "100 kW",
                electrical_power_heater: "100 kW",
              },
            ],
          },
          {
            id: "branch-injection-well",
            label: "Injection Well",
            blocks: [
              {
                type: "InjectionWell",
                location: "offshore",
                number_of_wells: 100,
              },
            ],
          },
        ],
      };

      const source: NetworkSource = { type: "data", network };

      const { request, assetMetadata } = await transformNetworkToCostingRequest(
        source,
        "v1.0-costing",
        {
          libraryId: LIBRARY_ID,
        },
      );

      console.log("\n=== Inline Data Test (with unit strings) ===");
      console.log("Assets generated:", request.assets.length);

      // Call costing server
      const costingResponse = await callCostingServer(request);
      const result = transformCostingResponse(
        costingResponse,
        assetMetadata,
        "EUR",
      );

      console.log(
        `Network Total Direct Equipment: €${result.lifetimeCosts.directEquipmentCost.toLocaleString()}`,
      );

      // Results should match the path-based test
      expect(result.assets.length).toBeGreaterThan(0);
      expect(result.lifetimeCosts.directEquipmentCost).toBeGreaterThan(0);
    });
  });
});
