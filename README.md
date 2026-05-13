This repo hosts W3C's proposed Impact Framework, based on a Theory of Change approach (see [the design considerations behind the framework](design-considerations.md)).

Each level of the Theory of Change is managed in a top-level directory (`impacts`, `outcomes`, `outputs`, `activities`, `inputs`); indicators used to measure progress across these different levels are managed in the `indicators` directory.

Each file in these directories represent a particular node of the theory of change, formatted as a markdown file with a YAML front matter. The YAML front matter sets the metadata of the node (id, title, status, and links to other nodes), with the markdown body used to further describe the node and its logical relationship to the rest of the chain.

These files are processed by a GitHub action relying on scripts and contents maintained in the `_tools` directory to generate an [HTML representation of the framework](https://w3c.github.io/impact-framework/).
