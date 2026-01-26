# preset networks

## Presets

Presets are defined in backend/networks in their own directories. They must be added to `AVAILABLE_NETWORKS` in backend/src/routes/network.ts to be exposed via the API.

## Operations

Operations are the things you can do with a network description. The operation registry lists each available operation along with things like the schema for input data and the endpoint to call to perform the calculation or validate the inputs.

Right now the operation selection is done through the sidebar but I imagine we'll have pages where an operation, like `snapshot`, will already be chosen and the user can only interact with the network in `snapshot` related ways.

## Input forms

I'm working towards something like [this](https://x.com/nandafyi/status/2004213111486820795) with the current plan being to display form fields in the flow network elements but that's not a requirement and they can be shown elsewhere. I use that example to show that the contents of the flow network elements can be changed to show the appropriate level of detail.

The form fields will be generated according to the schema required for the operation.

## Input data schema queries

The schema endpoints can be used to get the schema for any subsection of the network.
