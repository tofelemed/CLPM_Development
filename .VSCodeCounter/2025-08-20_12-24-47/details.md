# Details

Date : 2025-08-20 12:24:47

Directory l:\\Office\\CLPM\\clpm-app-latest\\backend

Total : 42 files,  2879 codes, 103 comments, 444 blanks, all 3426 lines

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/aggregation/Dockerfile](/backend/aggregation/Dockerfile) | Docker | 7 | 0 | 1 | 8 |
| [backend/aggregation/package.json](/backend/aggregation/package.json) | JSON | 25 | 0 | 1 | 26 |
| [backend/aggregation/src/index.js](/backend/aggregation/src/index.js) | JavaScript | 302 | 18 | 58 | 378 |
| [backend/aggregation/src/influxClient.js](/backend/aggregation/src/influxClient.js) | JavaScript | 191 | 0 | 27 | 218 |
| [backend/api-gateway/Dockerfile](/backend/api-gateway/Dockerfile) | Docker | 15 | 0 | 2 | 17 |
| [backend/api-gateway/package.json](/backend/api-gateway/package.json) | JSON | 81 | 0 | 1 | 82 |
| [backend/api-gateway/src/app.module.ts](/backend/api-gateway/src/app.module.ts) | TypeScript | 51 | 3 | 2 | 56 |
| [backend/api-gateway/src/auth/auth.module.ts](/backend/api-gateway/src/auth/auth.module.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [backend/api-gateway/src/auth/jwt.guard.ts](/backend/api-gateway/src/auth/jwt.guard.ts) | TypeScript | 4 | 0 | 2 | 6 |
| [backend/api-gateway/src/auth/jwt.strategy.ts](/backend/api-gateway/src/auth/jwt.strategy.ts) | TypeScript | 35 | 1 | 4 | 40 |
| [backend/api-gateway/src/auth/roles.decorator.ts](/backend/api-gateway/src/auth/roles.decorator.ts) | TypeScript | 4 | 0 | 1 | 5 |
| [backend/api-gateway/src/auth/roles.guard.ts](/backend/api-gateway/src/auth/roles.guard.ts) | TypeScript | 17 | 0 | 3 | 20 |
| [backend/api-gateway/src/data/data.controller.ts](/backend/api-gateway/src/data/data.controller.ts) | TypeScript | 45 | 0 | 12 | 57 |
| [backend/api-gateway/src/data/data.module.ts](/backend/api-gateway/src/data/data.module.ts) | TypeScript | 11 | 0 | 2 | 13 |
| [backend/api-gateway/src/data/data.service.ts](/backend/api-gateway/src/data/data.service.ts) | TypeScript | 119 | 13 | 25 | 157 |
| [backend/api-gateway/src/diagnostics/diagnostics.controller.ts](/backend/api-gateway/src/diagnostics/diagnostics.controller.ts) | TypeScript | 37 | 0 | 5 | 42 |
| [backend/api-gateway/src/diagnostics/diagnostics.module.ts](/backend/api-gateway/src/diagnostics/diagnostics.module.ts) | TypeScript | 11 | 0 | 2 | 13 |
| [backend/api-gateway/src/diagnostics/diagnostics.service.ts](/backend/api-gateway/src/diagnostics/diagnostics.service.ts) | TypeScript | 12 | 0 | 3 | 15 |
| [backend/api-gateway/src/kpi/kpi.controller.ts](/backend/api-gateway/src/kpi/kpi.controller.ts) | TypeScript | 60 | 0 | 6 | 66 |
| [backend/api-gateway/src/kpi/kpi.module.ts](/backend/api-gateway/src/kpi/kpi.module.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [backend/api-gateway/src/kpi/kpi.service.ts](/backend/api-gateway/src/kpi/kpi.service.ts) | TypeScript | 397 | 11 | 48 | 456 |
| [backend/api-gateway/src/loops/dto/create-loop-config.dto.ts](/backend/api-gateway/src/loops/dto/create-loop-config.dto.ts) | TypeScript | 20 | 0 | 3 | 23 |
| [backend/api-gateway/src/loops/dto/create-loop.dto.ts](/backend/api-gateway/src/loops/dto/create-loop.dto.ts) | TypeScript | 12 | 0 | 2 | 14 |
| [backend/api-gateway/src/loops/dto/update-loop-config.dto.ts](/backend/api-gateway/src/loops/dto/update-loop-config.dto.ts) | TypeScript | 3 | 0 | 1 | 4 |
| [backend/api-gateway/src/loops/dto/update-loop.dto.ts](/backend/api-gateway/src/loops/dto/update-loop.dto.ts) | TypeScript | 3 | 0 | 1 | 4 |
| [backend/api-gateway/src/loops/entities/loop-config.entity.ts](/backend/api-gateway/src/loops/entities/loop-config.entity.ts) | TypeScript | 26 | 4 | 7 | 37 |
| [backend/api-gateway/src/loops/entities/loop.entity.ts](/backend/api-gateway/src/loops/entities/loop.entity.ts) | TypeScript | 16 | 0 | 2 | 18 |
| [backend/api-gateway/src/loops/loop-config.service.ts](/backend/api-gateway/src/loops/loop-config.service.ts) | TypeScript | 115 | 9 | 22 | 146 |
| [backend/api-gateway/src/loops/loops.controller.ts](/backend/api-gateway/src/loops/loops.controller.ts) | TypeScript | 201 | 5 | 16 | 222 |
| [backend/api-gateway/src/loops/loops.module.ts](/backend/api-gateway/src/loops/loops.module.ts) | TypeScript | 19 | 0 | 2 | 21 |
| [backend/api-gateway/src/loops/loops.service.ts](/backend/api-gateway/src/loops/loops.service.ts) | TypeScript | 50 | 0 | 7 | 57 |
| [backend/api-gateway/src/loops/opcua.service.ts](/backend/api-gateway/src/loops/opcua.service.ts) | TypeScript | 155 | 6 | 23 | 184 |
| [backend/api-gateway/src/main.ts](/backend/api-gateway/src/main.ts) | TypeScript | 21 | 0 | 4 | 25 |
| [backend/api-gateway/src/opcua/opcua-proxy.controller.ts](/backend/api-gateway/src/opcua/opcua-proxy.controller.ts) | TypeScript | 43 | 4 | 9 | 56 |
| [backend/api-gateway/src/opcua/opcua-proxy.module.ts](/backend/api-gateway/src/opcua/opcua-proxy.module.ts) | TypeScript | 8 | 0 | 2 | 10 |
| [backend/api-gateway/src/shared/influxdb.service.ts](/backend/api-gateway/src/shared/influxdb.service.ts) | TypeScript | 175 | 0 | 24 | 199 |
| [backend/api-gateway/src/shared/pg.service.ts](/backend/api-gateway/src/shared/pg.service.ts) | TypeScript | 9 | 0 | 2 | 11 |
| [backend/api-gateway/tsconfig.json](/backend/api-gateway/tsconfig.json) | JSON with Comments | 16 | 0 | 1 | 17 |
| [backend/kpi-worker/Dockerfile](/backend/kpi-worker/Dockerfile) | Docker | 7 | 0 | 1 | 8 |
| [backend/kpi-worker/package.json](/backend/kpi-worker/package.json) | JSON | 26 | 0 | 1 | 27 |
| [backend/kpi-worker/src/index.js](/backend/kpi-worker/src/index.js) | JavaScript | 382 | 29 | 86 | 497 |
| [backend/kpi-worker/src/influxClient.js](/backend/kpi-worker/src/influxClient.js) | JavaScript | 130 | 0 | 19 | 149 |

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)