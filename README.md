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

cd local; docker compose --profile dev up -d --build
```

### Stop containers

```bash
just down

# or

cd local; docker compose --profile dev down && docker compose --profile prod down
```

## Network representation

This is built on top of [a tool I made for working with directed graphs](https://github.com/Jerell/dagger). That tool is useful for representing flow networks, because flow networks are directed graphs, but it's a separate thing.

### Directed graphs

Flow networks are best represented as directed graphs, which are naturally capable of representing all network shapes. If an API requires another shape, the directed graph can be transformed as necessary, but the shapes used by our existing APIs to represent networks are not compatible with each other. The directed graph should be seen as the primary form of the network and anything else is a projection of it.

## Presets

Presets are defined in backend/networks in their own directories. They must be added to `AVAILABLE_NETWORKS` in backend/src/routes/network.ts to be exposed via the API.

```
network-name/
├── config.toml          # Global configuration
├── group-1.toml         # Group definitions
├── branch-1.toml        # Branch definitions
├── branch-2.toml
└── ...
```

These can be used to define different network configurations.

### Scope Hierarchy

Properties defined at outer scopes are accessible to inner scopes:

```
Global (config.toml)
  └─> Group (group-*.toml)
       └─> Branch (branch-*.toml)
            └─> Block (within branch)
```

The file names are used as IDs for nodes in the graph. They do not need to say "group-" or "branch-" to be a group or a branch.

### Example Network

**config.toml** (Global scope):

```toml
[properties]
ambientTemperature = "20.0 C"
pressure = 14.7 # as this doesn't have a unit, the default would depend on the schema

[inheritance]
general = ["block", "branch", "group", "global"]

[unitPreferences.Pipe]
length = "km"
```

**branch-1.toml** (Branch scope):

```toml
type = "branch"
label = "Branch 1"
parentId = "group-1"

[position]
x = 20
y = 30

[[block]]
type = "Source"
pressure = "100 bar"

[[block]]
type = "Pipe"
length = "1000 m"
```

The properties in these files are effectively defaults. User inputs will override them.

Units are parsed. [You can write almost whatever you want](https://github.com/Jerell/dim/tree/main/src/registry). Default units will be defined in the schemas.

#### Visuals

Networks can also have image nodes, which need a position, path, width, height and label.

The visual representation of the branch nodes can be tailored to the appication. We might want input fields on the graph itself, or to have a simple diagram of the branch that can be clicked to display information elsewhere.

Geographic nodes are not yet implemented. The plan is for Geographic Anchors to set the anchor coordinates and scale and the Geographic Window to provide a separate window view of the map that may be disconnected from the anchor.

##### Input forms

I'm working towards something like [this](https://x.com/nandafyi/status/2004213111486820795) with the current plan being to display form fields in the flow network elements but that's not a requirement and they can be shown elsewhere. I use that example to show that the contents of the flow network elements can be changed to show the appropriate level of detail.

The form fields will be generated according to the schema required for the operation.

## Operations

Operations are the things you can do with a network description. The operation registry lists each available operation along with things like the schema for input data and the endpoint to call to perform the calculation or validate the inputs.

Right now the operation selection is done through the sidebar but I imagine we'll have pages where an operation, like `snapshot`, will already be chosen and the user can only interact with the network in `snapshot` related ways.

## Input data schema queries

The schema endpoints can be used to get the schema for any subsection of the network.

## Results display

The results are specific to the operation. I would suggest that, where possible, we reshape the response in such a way that allows us to tie them back to the flow network elements. For the costing API, I just displayed the results in a table.
