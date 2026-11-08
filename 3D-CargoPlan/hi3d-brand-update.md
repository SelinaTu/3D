<!-- #created 11/08/2026 -->
# CargoPlan · 舱策

The approved English product name is CargoPlan; the Chinese name is 舱策.
Branding is synchronized across the web app, retained maritime assistant,
reports, documentation, examples, desktop/native bridges and package identifiers.
The four web sections remain 装箱工作台、海陆样例、客户价值、海运知识库.

## Running the project

Run `npm ci` and `npm run check`, then `npm start` for the standard web build.
The separate globe is built by `npm run build:globe`.

The optional external evidence library is not bundled. Configure
`CARGOPLAN_KNOWLEDGE_ROOT` to its existing folder before running
`npm run knowledge:server`. If its `/api/status` response uses another
`application_id`, set `CARGOPLAN_KNOWLEDGE_APP_ID` in the main server environment
to that exact identifier; the default is `cargoplan-knowledgebase`.
Without the service, the maritime helper continues to provide bundled answers
and shows a visible notice when original-document lookup is unavailable.

## Desktop and historical records

Electron and macOS source identifiers now use CargoPlan. A branded macOS binary
has not been compiled or tested on Windows. Included native/package validation
records predate this rename; brand strings in those text records were normalized
for this source package. They do not verify the renamed desktop application.
Historical screenshots may show the earlier interface. The uploaded original
archive is preserved separately and unchanged.

The new native autosave location is
`~/Library/Application Support/CargoPlan/workspace-v1.json`. Existing external
saves and installations have not been moved or modified. For an existing native
installation, copy the prior `workspace-v1.json` into the new location before
launching the renamed app if you want to restore that workspace.
