# EvOwl End-to-End Setup

Follow this guide to get the instructor tool and webapp running together. The component READMEs serve as further, more detailed reference docs.

## Pieces

- The **instructor tool** is a CLI used to load rosters, groups, assignments, submissions, metrics, TA assignments, and grades.
- The **webapp** is the Spring Boot/LTI application used by students, TAs, and instructors.

**Shared MySQL database** is the primary shared state. Both tools read and write the same database, so they must use the same host, database name, username, and password.

**Shared submission file-path access** is the second shared state. The instructor CLI records absolute submission file paths in the database; the webapp reads and displays those same files. Additionally, if you plan to use the instructor interface, the webapp requires access to the compiled instructor-tool jar. Should you run the tools on different machines, use a shared filesystem, or mount them at the same absolute path on the webapp host.

Both tools can run on different machines as long as both conditions above are met. For local development, running both on the same machine is simplest.

## Setup Overview

1. Install prerequisites.
2. Choose a shared database name and MySQL credentials.
3. Configure and build the instructor tool.
4. Run the instructor setup phase: roster --> groups --> assignment --> optional parse/metrics.
5. Configure, build, and run the webapp against the same database.
6. Configure LTI/Canvas when ready to launch through an LMS.
7. Post-launch instructor workflow: analyze --> assign TAs --> export/load grades --> compute final scores.

## 1. Install Prerequisites

- Java 8 for the webapp; Java 11+ for the instructor tool.
- Maven.
- Node.js and npm.
- MySQL Server, running locally or remotely. [Version >= 9.0.0](https://dev.mysql.com/downloads/mysql/). [See Installation guide](https://dev.mysql.com/doc/refman/8.0/en/installing.html).
- Optional but recommended: [MySQL Workbench](https://dev.mysql.com/downloads/workbench/), for inspecting the data loaded by the instructor tool.
- Go, only if you will run `parse` or `metrics` for Golang submissions:

```bash
go install golang.org/x/tools/cmd/goimports@latest
go install github.com/praisem1/gocover-cobertura@v1.0.0
```

Make sure Go tool binaries are on your shell `PATH` so commands like 'goimports' resolve correctly. For most systems:

```bash
export PATH="$PATH:$(go env GOPATH)/bin"
```

See [webapp prerequisites](README.md#prerequisites) and [instructor tool prerequisites](https://github.com/rice-cs-edutools/evowl-instructor-tool/blob/release/README.md#prerequisites) for component-specific notes.

## 2. Choose the Shared Database

Pick a database name, for example `mydb`. You will use this same name in three places:

- Instructor tool commands: `--db=mydb`
- Webapp config `spring.datasource.url`: `...3306/mydb?...`
- Webapp config `evowl.instructor-tool.db-name=mydb`

If MySQL is remote, use the same MySQL host and port in both the instructor tool and webapp configuration.

## 3. Configure and Build the Instructor Tool

In the `evowl-instructor-tool` directory, edit `application.properties`:

```properties
evowl.db.url.template=jdbc:mariadb://localhost:3306/%s?timezone=UTC
evowl.db.username=<mysql-user>
evowl.db.password=<mysql-password>
```

Replace `localhost:3306` if your MySQL server is remote.

Set `EVOWL_CONFIG` to the absolute path of that file, or run all instructor-tool commands from the directory containing `application.properties`:

```bash
export EVOWL_CONFIG=/absolute/path/to/evowl-instructor-tool/application.properties
```

Build the tool:

```bash
cd evowl-instructor-tool
mvn clean install
```

This produces `target/evowl-1.0-SNAPSHOT-jar-with-dependencies.jar`.

## 4. Run the Instructor Tool Setup Phase

Complete the setup data before using the webapp. Sample input files are in `src/main/resources/instructor-files`. 

In the following steps, `java -jar target/evowl-1.0-SNAPSHOT-jar-with-dependencies.jar` is aliased as `evowl`.

### Load the Roster

The CSV must include `last_name`, `first_name`, `user_id`, and `role` (`student`, `ta`, or `professor`). The `user_id` must match the user's LMS account ID.

```bash
evowl roster --db=mydb --file=roster.csv
```

This creates the database if it does not already exist. Note that you can ignore the SLF4J warnings that appear when you run this and subsequent commands.

### Load Groups

The JSON file maps group names to lists of user IDs. Every user ID must appear in the roster.

```bash
evowl groups --db=mydb --file=groups.json
```

### Create an Assignment

```bash
evowl assignment \
  --db=mydb \
  --name="HW1" \
  --deadline="2035-12-01 23:59:59" \
  --criteria=config.json \
  --submissions=./submissions/
```

Add `--overwrite` to replace an existing assignment with the same name. See [CONFIG.md](https://github.com/rice-cs-edutools/evowl-instructor-tool/blob/release/CONFIG.md) for the full assignment config reference.

### Parse and Compute Metrics (Optional)

Run only if the assignment criteria use metrics-based interactive tasks. Run both commands on the same submissions directory, in order:

```bash
evowl parse --lang=golang --submissions=./submissions/
evowl metrics --lang=golang --submissions=./submissions/
```

For language and metrics support, see [EXTRACTORS.md](https://github.com/rice-cs-edutools/evowl-instructor-tool/blob/release/EXTRACTORS.md) and [METRICS.md](https://github.com/rice-cs-edutools/evowl-instructor-tool/blob/release/METRICS.md).

## 5. Configure the Webapp

In the webapp repo, edit `config/application.properties`.

### Database

Point the webapp at the same database used by the instructor tool. Specifically, update the two instances of `chosen-database-name` with the name that you used in the instructor tool, create a certificate and update `/absolute/path/to/cert.pem` to point to that (or use sslMode=trust for testing a local deployment), and set the username and password for your database.

```properties
evowl.instructor-tool.db-name=chosen-database-name
spring.datasource.url=jdbc:mariadb://localhost:3306/chosen-databaseb-name?sslMode=verify-full&serverSslCert=/absolute/path/to/cert.pem
spring.datasource.username=
spring.datasource.password=
```

### Submission File-Path Access

The instructor CLI records absolute submission file paths in the database. The webapp process must be able to read those same paths. On the same machine, no action should be necessary. On different machines, mount the submissions directory at the same absolute path on the webapp host, or use a shared filesystem.

### Instructor Tool Jar

The webapp shells out to the instructor tool jar. After building the instructor tool, copy or symlink the jar to a path, then set:

```properties
evowl.instructor-tool.jar-path=/absolute/path/to/evowl-instructor-tool.jar
```

### SSL

Generate a PKCS12 certificate, save it as `config/keystore.p12`, and set:

```properties
server.ssl.key-store-password=<your-keystore-password>
```

### Deployment Host

The default port is `8444`. If you deploy at a different port, update `server.port` and any reverse proxy or LTI configuration accordingly. To change the host or port the frontend calls, update `evowl.fetch-endpoint` and rebuild the frontend:

```properties
evowl.fetch-endpoint=https://<your-host>:<port>
```

See [Configuration Reference](README.md#configuration) for the full config reference.

## 6. Build and Run the Webapp

Build the frontend:

```bash
cd src/main/webapp
npm install
npm run build
cd ../../../
```

Quick run for development:

```bash
mvn spring-boot:run
```

The app is available, by default, at `https://localhost:8444/evowl`.

For production:

```bash
mvn clean install
java -jar target/evowl-0.0.1-SNAPSHOT.war
```

## 7. Configure LTI/Canvas (when launching through an LMS)

LTI is required when launching the webapp through an LMS such as Canvas.

In Canvas, go to **Settings --> Apps --> + App**. Record the **Consumer Key** and **Shared Secret**, then configure:

```properties
lti.instance=<your-consumer-key>
lti.secret=<your-shared-secret>
```

The default launch URL is `https://localhost:8444/evowl`. You may adjust either the hostname or the port. You must host the tool somewhere that has a publicly accessible domain name. Once you choose the hostname and port, set the same values in `config/application.properties` — see [Deployment Host](#deployment-host) for the `server.port` and `evowl.fetch-endpoint` keys.

## 8. Post-launch Instructor Workflow

After students and TAs have used the webapp:

1. Analyze peer evaluation results:

```bash
evowl analyze \
  --db=mydb \
  --assign=<assignment-id> \
  --tiers=3 \
  --location=strict-midpoint \
  --out=./analyze-out/
```

2. Assign TAs to round 2 submissions:

```bash
evowl assign-tas --db=mydb --assign=<assignment-id> --in=./analyze-out/
```

3. After TAs complete round 2 grading in the webapp, export evaluation and grading data:

```bash
evowl grades --db=mydb --assign=<assignment-id> --kind=<kind> --out=<output-file>
```

For the full list of `--kind` values, and other commands, see the [instructor tool README](https://github.com/rice-cs-edutools/evowl-instructor-tool/blob/release/README.md#phase-5-finalize-grades-after-ta-grading-closes).

4. Compute final scores:

```bash
evowl grade --db=mydb --assign=<assignment-id> --in=./analyze-out/ --out=./grades-out/
```

Alternatives: `grade-wo-tas` (without TA grades), `grade-instr` (instructor grades as anchors).

Run `evowl --help` or `evowl <subcommand> --help` for all flags. For the full subcommand list, see the [instructor tool README](https://github.com/rice-cs-edutools/evowl-instructor-tool/blob/release/README.md).
