# preset networks

## Development

### Prerequisites

- **Docker**
- **Node.js** (for backend API) and frontend
- [**just**](https://just.systems/) (optional, for running project commands)

If you're not using `just` then take a look at the justfile in this repo to see what the commands do. There's not much in there now but it's useful when you need to regularly run more complex commands.

#### Install dependencies

As the backend and frontend are both using node and we have the workspaces defined in the root package.json, you can install dependencies from the root with `npm install`

Or install dependencies separately in the backend and frontend subdirectories if you really want.

#### Start containers

```bash
just dev

# or

cd local; docker compose --profile dev up -d
```

### Stop containers

```bash
just down

# or

cd local; docker compose --profile dev down && docker compose --profile prod down
```

## Presets

Presets are defined in backend/networks in their own directories. They must be added to `AVAILABLE_NETWORKS` in backend/src/routes/network.ts to be exposed via the API.

## Operations

Operations are the things you can do with a network description. The operation registry lists each available operation along with things like the schema for input data and the endpoint to call to perform the calculation or validate the inputs.

Right now the operation selection is done through the sidebar but I imagine we'll have pages where an operation, like `snapshot`, will already be chosen and the user can only interact with the network in `snapshot` related ways.

## Flow network

The flow network is generated according to the preset configuration. All of the current components you in the flow network should be seen as placeholders. They can be replaced easily once we have a more specific idea of what we want.

## Input forms

I'm working towards something like [this](https://x.com/nandafyi/status/2004213111486820795) with the current plan being to display form fields in the flow network elements but that's not a requirement and they can be shown elsewhere. I use that example to show that the contents of the flow network elements can be changed to show the appropriate level of detail.

The form fields will be generated according to the schema required for the operation.

## Input data schema queries

The schema endpoints can be used to get the schema for any subsection of the network.

## Results display

The results are specific to the operation. I would suggest that, where possible, we reshape the response in such a way that allows us to tie them back to the flow network elements. For the costing API, I just displayed the results in a table.
