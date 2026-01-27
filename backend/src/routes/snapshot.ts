import { Hono } from "hono";
import { Either } from "effect";
import * as S from "effect/Schema";
import {
  transformToScenarioRequest,
  transformScenarioResponse,
  type ScenarioRequest,
  type ScenarioOkResponse,
  type ScenarioFailResponse,
} from "../services/snapshot";
import {
  transformNetworkToSnapshotConditions,
  type NetworkSource,
} from "../services/snapshot/network-adapter";

export const snapshotRoutes = new Hono();

// Default snapshot server URL (Scenario Modeller API)
const SNAPSHOT_SERVER_URL =
  process.env.SNAPSHOT_SERVER_URL || "http://localhost:5000";

// ============================================================================
// Request Schemas
// ============================================================================

const NetworkBlockSchema = S.mutable(S.Struct({
  type: S.String,
  quantity: S.optional(S.Number),
}).pipe(S.extend(S.Record({ key: S.String, value: S.Unknown }))));

const NetworkBranchSchema = S.mutable(S.Struct({
  id: S.String,
  label: S.optional(S.String),
  parentId: S.optional(S.String),
  blocks: S.mutable(S.Array(NetworkBlockSchema)),
}));

const NetworkGroupSchema = S.mutable(S.Struct({
  id: S.String,
  label: S.optional(S.String),
  branchIds: S.mutable(S.Array(S.String)),
}));

const NetworkDataSchema = S.mutable(S.Struct({
  groups: S.mutable(S.Array(NetworkGroupSchema)),
  branches: S.mutable(S.Array(NetworkBranchSchema)),
}));

const DataSourceSchema = S.mutable(S.Struct({
  type: S.Literal("data"),
  network: NetworkDataSchema,
}));

const NetworkIdSourceSchema = S.Struct({
  type: S.Literal("networkId"),
  networkId: S.String,
});

const NetworkSourceSchema = S.Union(DataSourceSchema, NetworkIdSourceSchema);

const ConditionsSchema = S.Record({
  key: S.String,
  value: S.Record({ key: S.String, value: S.Union(S.Number, S.Boolean) }),
});

const SnapshotRunRequestSchema = S.Struct({
  source: NetworkSourceSchema,
  baseNetworkId: S.optional(S.String),
  conditionOverrides: S.optional(ConditionsSchema),
  includeAllPipes: S.optional(S.Boolean),
});

const SnapshotValidateRequestSchema = S.Struct({
  source: NetworkSourceSchema,
  baseNetworkId: S.optional(S.String),
});

// ============================================================================
// Validation Helper
// ============================================================================

function validateRequest<A, I>(
  schema: S.Schema<A, I>,
  data: unknown
): Either.Either<A, string> {
  const result = S.decodeUnknownEither(schema)(data);
  if (Either.isRight(result)) {
    return Either.right(result.right);
  }
  return Either.left(String(result.left));
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/operations/snapshot/validate
 *
 * Validate a network for snapshot readiness.
 * Returns which conditions can be extracted and which are missing.
 */
snapshotRoutes.post("/validate", async (c) => {
  try {
    const rawBody = await c.req.json();

    const parseResult = validateRequest(SnapshotValidateRequestSchema, rawBody);
    if (Either.isLeft(parseResult)) {
      return c.json({ error: "Invalid request", details: parseResult.left }, 400);
    }
    const body = parseResult.right;

    // Transform network to get validation info
    const result = await transformNetworkToSnapshotConditions(
      body.source as NetworkSource,
      "v1.0-snapshot",
      body.baseNetworkId,
    );

    return c.json(result.validation);
  } catch (error) {
    console.error("Snapshot validation error:", error);
    return c.json(
      {
        error: "Validation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/operations/snapshot/run
 *
 * Run a snapshot simulation.
 *
 * The conditions are automatically extracted from the network.
 * Optional conditionOverrides can be provided to modify specific values.
 */
snapshotRoutes.post("/run", async (c) => {
  try {
    const rawBody = await c.req.json();

    const parseResult = validateRequest(SnapshotRunRequestSchema, rawBody);
    if (Either.isLeft(parseResult)) {
      return c.json({ error: "Invalid request", details: parseResult.left }, 400);
    }
    const body = parseResult.right;

    // Transform network to snapshot conditions
    const transformResult = await transformNetworkToSnapshotConditions(
      body.source as NetworkSource,
      "v1.0-snapshot",
      body.baseNetworkId,
    );

    // Merge with overrides
    const conditions = {
      ...transformResult.conditions,
      ...body.conditionOverrides,
    };

    // Build the scenario request
    const scenarioRequest: ScenarioRequest = {
      conditions,
      includeAllPipes: body.includeAllPipes,
    };

    // Log the request
    console.log("[Snapshot Run] Request:", JSON.stringify(scenarioRequest, null, 2));

    // Call the Scenario Modeller API
    let scenarioResponse: ScenarioOkResponse | ScenarioFailResponse;
    try {
      const response = await fetch(`${SNAPSHOT_SERVER_URL}/api/Scenario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scenarioRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return c.json(
          {
            error: "Snapshot server error",
            status: response.status,
            message: errorText,
          },
          502
        );
      }

      scenarioResponse = await response.json();
    } catch (fetchError) {
      return c.json(
        {
          error: "Snapshot server unavailable",
          message: `Failed to connect to snapshot server at ${SNAPSHOT_SERVER_URL}. ` +
            "Ensure the Scenario Modeller server is running.",
          details:
            fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        503
      );
    }

    // Transform response to our format
    const result = transformScenarioResponse(scenarioResponse);

    // Include validation info in the response
    return c.json({
      ...result,
      validation: transformResult.validation,
    });
  } catch (error) {
    console.error("Snapshot run error:", error);
    return c.json(
      {
        error: "Internal error",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * POST /api/operations/snapshot/raw
 *
 * Pass through a raw ScenarioRequest to the Scenario Modeller API.
 * Returns the raw response without transformation.
 */
snapshotRoutes.post("/raw", async (c) => {
  try {
    const body: ScenarioRequest = await c.req.json();

    if (!body.conditions || typeof body.conditions !== "object") {
      return c.json(
        {
          error: "Invalid request",
          message: "Request must include a 'conditions' object",
        },
        400
      );
    }

    let scenarioResponse: ScenarioOkResponse | ScenarioFailResponse;
    try {
      const response = await fetch(`${SNAPSHOT_SERVER_URL}/api/Scenario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return c.json(
          {
            error: "Snapshot server error",
            status: response.status,
            message: errorText,
          },
          502
        );
      }

      scenarioResponse = await response.json();
    } catch (fetchError) {
      return c.json(
        {
          error: "Snapshot server unavailable",
          message: `Failed to connect to snapshot server at ${SNAPSHOT_SERVER_URL}. ` +
            "Ensure the Scenario Modeller server is running.",
          details:
            fetchError instanceof Error ? fetchError.message : String(fetchError),
        },
        503
      );
    }

    return c.json(scenarioResponse);
  } catch (error) {
    console.error("Snapshot raw error:", error);
    return c.json(
      {
        error: "Internal error",
        message: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

/**
 * GET /api/operations/snapshot/health
 *
 * Check if the Scenario Modeller server is reachable.
 */
snapshotRoutes.get("/health", async (c) => {
  try {
    const response = await fetch(
      `${SNAPSHOT_SERVER_URL}/api/ScenarioDescription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (response.ok) {
      return c.json({
        status: "ok",
        snapshotServer: SNAPSHOT_SERVER_URL,
        serverStatus: "reachable",
      });
    } else {
      return c.json({
        status: "degraded",
        snapshotServer: SNAPSHOT_SERVER_URL,
        serverStatus: "unhealthy",
        statusCode: response.status,
      });
    }
  } catch (error) {
    return c.json({
      status: "error",
      snapshotServer: SNAPSHOT_SERVER_URL,
      serverStatus: "unreachable",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
