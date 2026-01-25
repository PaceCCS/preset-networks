# preset networks

Using toml files in the backend to create presets for flow networks and input forms for schema registries

I'm need to be able to visit a page to load a network preset. The flow networks have components for branches, which will have property sets defined by a chosen schema. For a given schema, I want to generate a form for the user which I will display in the branch node component.

when I try to perform an evaluation calculation/operation with the network, I may need additional properties from the user which will mean more input fields. but the interactive flow network will have the fields for the branch in the branch component.

the reference directory contains a previous implementation. this is just for reference. no file watching here. we're not writing to local files this time. the calls for evaluation/operations will use properties from the application state, so the process may be a little different but the goal is the same.

I intend to use my quantity input component for the form fields where it makes sense.
