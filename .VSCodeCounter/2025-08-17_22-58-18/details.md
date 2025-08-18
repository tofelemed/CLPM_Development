# Details

Date : 2025-08-17 22:58:18

Directory l:\\Office\\CLPM\\clpm-app-latest\\backend

Total : 48 files,  3104 codes, 156 comments, 619 blanks, all 3879 lines

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/aggregation/Dockerfile](/backend/aggregation/Dockerfile) | Docker | 7 | 0 | 1 | 8 |
| [backend/aggregation/package.json](/backend/aggregation/package.json) | JSON | 16 | 0 | 1 | 17 |
| [backend/aggregation/src/index.js](/backend/aggregation/src/index.js) | JavaScript | 255 | 21 | 56 | 332 |
| [backend/aggregation/src/rabbit.js](/backend/aggregation/src/rabbit.js) | JavaScript | 11 | 1 | 4 | 16 |
| [backend/api-gateway/Dockerfile](/backend/api-gateway/Dockerfile) | Docker | 15 | 0 | 2 | 17 |
| [backend/api-gateway/package.json](/backend/api-gateway/package.json) | JSON | 49 | 0 | 1 | 50 |
| [backend/api-gateway/src/app.module.ts](/backend/api-gateway/src/app.module.ts) | TypeScript | 49 | 3 | 2 | 54 |
| [backend/api-gateway/src/auth/auth.module.ts](/backend/api-gateway/src/auth/auth.module.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [backend/api-gateway/src/auth/jwt.guard.ts](/backend/api-gateway/src/auth/jwt.guard.ts) | TypeScript | 4 | 0 | 2 | 6 |
| [backend/api-gateway/src/auth/jwt.strategy.ts](/backend/api-gateway/src/auth/jwt.strategy.ts) | TypeScript | 35 | 1 | 4 | 40 |
| [backend/api-gateway/src/auth/roles.decorator.ts](/backend/api-gateway/src/auth/roles.decorator.ts) | TypeScript | 4 | 0 | 1 | 5 |
| [backend/api-gateway/src/auth/roles.guard.ts](/backend/api-gateway/src/auth/roles.guard.ts) | TypeScript | 17 | 0 | 3 | 20 |
| [backend/api-gateway/src/data/data.controller.ts](/backend/api-gateway/src/data/data.controller.ts) | TypeScript | 20 | 0 | 3 | 23 |
| [backend/api-gateway/src/data/data.module.ts](/backend/api-gateway/src/data/data.module.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [backend/api-gateway/src/data/data.service.ts](/backend/api-gateway/src/data/data.service.ts) | TypeScript | 18 | 0 | 6 | 24 |
| [backend/api-gateway/src/diagnostics/diagnostics.controller.ts](/backend/api-gateway/src/diagnostics/diagnostics.controller.ts) | TypeScript | 29 | 0 | 4 | 33 |
| [backend/api-gateway/src/diagnostics/diagnostics.module.ts](/backend/api-gateway/src/diagnostics/diagnostics.module.ts) | TypeScript | 11 | 0 | 2 | 13 |
| [backend/api-gateway/src/diagnostics/diagnostics.service.ts](/backend/api-gateway/src/diagnostics/diagnostics.service.ts) | TypeScript | 12 | 0 | 3 | 15 |
| [backend/api-gateway/src/kpi/kpi.controller.ts](/backend/api-gateway/src/kpi/kpi.controller.ts) | TypeScript | 46 | 0 | 5 | 51 |
| [backend/api-gateway/src/kpi/kpi.module.ts](/backend/api-gateway/src/kpi/kpi.module.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [backend/api-gateway/src/kpi/kpi.service.ts](/backend/api-gateway/src/kpi/kpi.service.ts) | TypeScript | 233 | 10 | 39 | 282 |
| [backend/api-gateway/src/loops/dto/create-loop.dto.ts](/backend/api-gateway/src/loops/dto/create-loop.dto.ts) | TypeScript | 12 | 0 | 2 | 14 |
| [backend/api-gateway/src/loops/dto/update-loop.dto.ts](/backend/api-gateway/src/loops/dto/update-loop.dto.ts) | TypeScript | 3 | 0 | 1 | 4 |
| [backend/api-gateway/src/loops/entities/loop.entity.ts](/backend/api-gateway/src/loops/entities/loop.entity.ts) | TypeScript | 16 | 0 | 2 | 18 |
| [backend/api-gateway/src/loops/loops.controller.ts](/backend/api-gateway/src/loops/loops.controller.ts) | TypeScript | 22 | 0 | 7 | 29 |
| [backend/api-gateway/src/loops/loops.module.ts](/backend/api-gateway/src/loops/loops.module.ts) | TypeScript | 12 | 0 | 2 | 14 |
| [backend/api-gateway/src/loops/loops.service.ts](/backend/api-gateway/src/loops/loops.service.ts) | TypeScript | 50 | 0 | 7 | 57 |
| [backend/api-gateway/src/main.ts](/backend/api-gateway/src/main.ts) | TypeScript | 21 | 0 | 4 | 25 |
| [backend/api-gateway/src/shared/pg.service.ts](/backend/api-gateway/src/shared/pg.service.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [backend/api-gateway/tsconfig.json](/backend/api-gateway/tsconfig.json) | JSON with Comments | 16 | 0 | 1 | 17 |
| [backend/ingestion/Dockerfile](/backend/ingestion/Dockerfile) | Docker | 7 | 0 | 1 | 8 |
| [backend/ingestion/package.json](/backend/ingestion/package.json) | JSON | 16 | 0 | 1 | 17 |
| [backend/ingestion/src/config.js](/backend/ingestion/src/config.js) | JavaScript | 6 | 0 | 1 | 7 |
| [backend/ingestion/src/database.js](/backend/ingestion/src/database.js) | JavaScript | 175 | 2 | 23 | 200 |
| [backend/ingestion/src/index.js](/backend/ingestion/src/index.js) | JavaScript | 122 | 14 | 22 | 158 |
| [backend/ingestion/src/opc/uaClient.js](/backend/ingestion/src/opc/uaClient.js) | JavaScript | 103 | 7 | 18 | 128 |
| [backend/ingestion/src/rabbit.js](/backend/ingestion/src/rabbit.js) | JavaScript | 10 | 0 | 2 | 12 |
| [backend/kpi-worker/Dockerfile](/backend/kpi-worker/Dockerfile) | Docker | 7 | 0 | 1 | 8 |
| [backend/kpi-worker/package.json](/backend/kpi-worker/package.json) | JSON | 16 | 0 | 1 | 17 |
| [backend/kpi-worker/src/index.js](/backend/kpi-worker/src/index.js) | JavaScript | 379 | 27 | 85 | 491 |
| [backend/kpi-worker/src/rabbit.js](/backend/kpi-worker/src/rabbit.js) | JavaScript | 11 | 1 | 4 | 16 |
| [backend/mock-opcua-server/Dockerfile](/backend/mock-opcua-server/Dockerfile) | Docker | 7 | 0 | 1 | 8 |
| [backend/mock-opcua-server/README.md](/backend/mock-opcua-server/README.md) | Markdown | 304 | 0 | 102 | 406 |
| [backend/mock-opcua-server/package.json](/backend/mock-opcua-server/package.json) | JSON | 25 | 0 | 1 | 26 |
| [backend/mock-opcua-server/src/opcua-api.js](/backend/mock-opcua-server/src/opcua-api.js) | JavaScript | 353 | 38 | 68 | 459 |
| [backend/mock-opcua-server/src/opcua-client.js](/backend/mock-opcua-server/src/opcua-client.js) | JavaScript | 402 | 17 | 81 | 500 |
| [backend/mock-opcua-server/src/server.js](/backend/mock-opcua-server/src/server.js) | JavaScript | 46 | 0 | 9 | 55 |
| [backend/mock-opcua-server/test-opcua.js](/backend/mock-opcua-server/test-opcua.js) | JavaScript | 96 | 14 | 25 | 135 |

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)