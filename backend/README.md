# Dagger Backend API

Hono-based API server for the Dagger network inspection tool.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### Health Check

- `GET /health` - Health check endpoint

### Query API

- `GET /api/query?q=<query>&network=<path>` - Execute a query on the network

### Network API

- `GET /api/network?network=<path>` - Get full network structure
- `GET /api/network/nodes?network=<path>&type=<type>` - Get all nodes (optionally filtered by type)
- `GET /api/network/edges?network=<path>&source=<id>&target=<id>` - Get all edges (optionally filtered)

### Schema API

- `GET /api/schema` - Get all available schema versions
- `GET /api/schema/:version` - Get schemas for a specific version
- `GET /api/schema/network?network=<name>&version=<version>` - Get schema properties for all blocks in a network (flattened format)
- `GET /api/schema/properties?network=<name>&q=<query>&version=<version>` - Get schema properties for blocks matching a query path
- `GET /api/schema/validate?network=<name>&q=<query>&version=<version>` - Validate blocks matching a query path
- `GET /api/schema/network/validate?network=<name>&version=<version>` - Validate all blocks in a network
- `POST /api/schema/validate` - Validate a block against a schema (without network context)

This compiles the Rust code in `../cli` to WebAssembly and outputs it to `./pkg`.

### Operations API

I'll docment this later.

## Networks Directory

Networks are stored in `backend/networks/`. The API uses network names (e.g., `preset1`) which map to `networks/preset1/`.

## Environment Variables

- `PORT` - Server port (default: 3000)
- `SNAPSHOT_SERVER_URL` - URL of the Scenario Modeller API (default: `http://localhost:5000`)
- `SNAPSHOT_USE_MOCK` - Enable/disable mock fallback when snapshot server is unavailable (default: `true`). Set to `false` to disable mock responses.

## Snapshot API

The snapshot API (`/api/operations/snapshot/*`) integrates with the Scenario Modeller for flow simulations.

### Mock Mode

When the Scenario Modeller server is unavailable, the API automatically falls back to mock responses for demo purposes. This behavior is controlled by the `SNAPSHOT_USE_MOCK` environment variable.

**Response flag:** When a mock response is used, the response includes `_mock: true` to indicate the data is not from a live simulation.

```json
{
  "success": true,
  "components": [...],
  "_mock": true
}
```

To disable mock fallback and always require the real server:
```bash
SNAPSHOT_USE_MOCK=false npm run dev
```
