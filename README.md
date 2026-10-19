# EvOwl

EvOwl is a Spring Boot web application with a bundled frontend under `src/main/webapp`.

**First time setting up** — Start with the [End-to-End Setup guide](end-to-end.md), which walks through both repos in the right order. This README documents webapp-specific configuration keys, the built-in metric pages, and how to add terminology for a new language.

## Prerequisites

- Java 8
- Maven
- Node.js and npm
- **MySQL Server** running locally or remotely.
  - Download / install MySQL Community Server (Version >= 9.0.0): https://dev.mysql.com/downloads/mysql/
    (installation guide: https://dev.mysql.com/doc/refman/8.0/en/installing.html)
  - Optional but recommended — **MySQL Workbench**, a GUI for browsing and verifying the data loaded by this tool: https://dev.mysql.com/downloads/workbench/

## Configuration Reference

All keys live in `config/application.properties`.

| Key | Description |
|-----|-------------|
| `spring.datasource.url` | MySQL JDBC URL. The database name is the segment after `:3306/` and before `?`. Must match `evowl.instructor-tool.db-name` and the instructor tool's `--db`. |
| `spring.datasource.username` | MySQL username. |
| `spring.datasource.password` | MySQL password. |
| `evowl.instructor-tool.db-name` | Shared database name. Must match the instructor tool. |
| `evowl.instructor-tool.jar-path` | Path to the built instructor-tool jar the webapp shells out to. |
| `evowl.instructor-ui.enabled` | Used to enable the instructor UI. Disabled by default. |
| `server.ssl.key-store-password` | Password for the PKCS12 keystore at `config/keystore.p12`. |
| `server.port` | HTTPS port. Default: `8444`. |
| `evowl.fetch-endpoint` | Host and port the compiled frontend bundle calls (e.g. `https://your-host:8444`). Changing this requires rebuilding the frontend. |
| `lti.instance` | LTI Consumer Key from the Canvas app configuration. |
| `lti.secret` | LTI Shared Secret from the Canvas app configuration. |

## Instructor Tool

The instructor CLI tool ([evowl-instructor-tool](https://github.com/rice-cs-edutools/evowl-instructor-tool)) loads rosters, groups, assignments, grades, and more. Run it before the webapp to populate the database. See the [End-to-End Setup guide](end-to-end.md) for the full sequenced walkthrough.

## Instructor UI

We have added preliminary support for a web-based instructor UI that can be used to configure an assignment. However, it only offers a subset of the functionalities provided by the instructor tool. 

In addition, enabling the instructor interface will cause it to be displayed whenever the user who launches the tool is (a) an instructor on the Canvas site from which the tool was launched, or (b) listed as a professor on the roster. To confirm that an assignment has been configured properly, you may find it beneficial to disable the instructor interface disabled and list yourself as a student on the roster.

## Metric Pages

Which metric pages appear during peer grading is controlled entirely by the criteria defined in the instructor tool's assignment config. See the [instructor tool](https://github.com/rice-cs-edutools/evowl-instructor-tool) for how to create and configure assignments.

**Built-in metric pages** — The latest version of EvOwl includes support for interactive metric pages for the following criteria. A built-in page is shown whenever a criterion's `name` field (after stripping HTML tags) contains one of the following keywords (case-insensitive):

| Keyword | Page shown |
|---|---|
| `modularity` | Modularity & Cohesion |
| `decoupling` | Decoupling |
| `encapsulation` | Encapsulation & Interfaces |
| `clarity` | Clarity |
| `robustness` | Robustness |

To **disable** a built-in page, simply omit the criterion with that keyword from the assignment config.

**Custom (generic) metric pages** — Any criterion whose name does not match a built-in keyword gets a generic (blank) metric page: two code editors and comparison controls, but no automated metrics in the sidebar. To add one, include a criterion in the config whose name does not contain any of the keywords above.

See the [instructor tool](https://github.com/rice-cs-edutools/evowl-instructor-tool) for more information on configuring criteria displayed.

## Adding Terminology for a New Language

Terminology (e.g. "struct" vs "class", "package" vs "module") is managed by `LanguageTerminology` in `src/main/webapp/src/editor/peerGradingInfo.ts`.

**Step 1** — Implement a subclass in `peerGradingInfo.ts`:

```ts
export class MyLangLanguageTerminology extends LanguageTerminology {
    constructor(criteriaQuestions: Record<string, string>) {
        super(criteriaQuestions);
    }
    // implement all abstract methods: structLabel, functionLabel,
    // peerInstructions, taInstructions, structPrefix, functionPrefix,
    // fileGroupMethod, showStructArgumentShouldBeInterface,
    // cannotBeDecoupledMessage, moduleSRLabel, functionSRLabel,
    // resolvedOrReturnedPercent, resolvedNorReturnedCheckbox
}
```

**Step 2** — In `src/main/webapp/main.ts`, inside `makeGradingInfo`, replace the `return` statement:

```ts
// Before:
return new GoOrTsPeerGradingInfo(isGo ? "go" : "typescript", criteriaQuestions);

// After (return your terminology instead):
return new MyLangPeerGradingInfo(criteriaQuestions);
```

`GoOrTsLanguageTerminology` in `peerGradingInfo.ts` is the existing implementation for Go and TypeScript, use it as a reference.

# Credit

This project owes its success to the following contributors:

[Praise Mayor](https://github.com/praisem1) \
[Adam Tillou](https://github.com/benzanol) \
[Scott Rixner](https://github.com/rixner) \
[Rebecca Schreib](https://github.com/rebeccasmith) \
[Luisa Martinez](https://github.com/luisa0martinez) \
[Lily Gao](https://github.com/Moongram) \
[Arantxa Pacheco](https://github.com/celesteeeeeeee)
