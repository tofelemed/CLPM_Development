# Diff Details

Date : 2025-08-20 12:24:47

Directory l:\\Office\\CLPM\\clpm-app-latest\\backend

Total : 81 files,  -5897 codes, -103 comments, -233 blanks, all -6233 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

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
| [frontend/Dockerfile](/frontend/Dockerfile) | Docker | -13 | -1 | -2 | -16 |
| [frontend/index.html](/frontend/index.html) | HTML | -12 | 0 | -1 | -13 |
| [frontend/package.json](/frontend/package.json) | JSON | -45 | 0 | -1 | -46 |
| [frontend/postcss.config.js](/frontend/postcss.config.js) | JavaScript | -6 | 0 | -1 | -7 |
| [frontend/src/App.tsx](/frontend/src/App.tsx) | TypeScript JSX | -103 | -6 | -11 | -120 |
| [frontend/src/components/AppShell.tsx](/frontend/src/components/AppShell.tsx) | TypeScript JSX | -251 | -2 | -17 | -270 |
| [frontend/src/components/LoopConfiguration.tsx](/frontend/src/components/LoopConfiguration.tsx) | TypeScript JSX | -861 | -16 | -80 | -957 |
| [frontend/src/components/opcua/HealthDashboard.tsx](/frontend/src/components/opcua/HealthDashboard.tsx) | TypeScript JSX | -297 | -8 | -20 | -325 |
| [frontend/src/components/opcua/ServerForm.tsx](/frontend/src/components/opcua/ServerForm.tsx) | TypeScript JSX | -411 | -5 | -43 | -459 |
| [frontend/src/components/opcua/ServerManager.tsx](/frontend/src/components/opcua/ServerManager.tsx) | TypeScript JSX | -277 | -10 | -16 | -303 |
| [frontend/src/components/opcua/TagBrowser.tsx](/frontend/src/components/opcua/TagBrowser.tsx) | TypeScript JSX | -343 | -9 | -31 | -383 |
| [frontend/src/components/ui/badge.tsx](/frontend/src/components/ui/badge.tsx) | TypeScript JSX | -25 | 0 | -4 | -29 |
| [frontend/src/components/ui/button.tsx](/frontend/src/components/ui/button.tsx) | TypeScript JSX | -37 | 0 | -4 | -41 |
| [frontend/src/components/ui/card.tsx](/frontend/src/components/ui/card.tsx) | TypeScript JSX | -49 | 0 | -6 | -55 |
| [frontend/src/components/ui/dialog.tsx](/frontend/src/components/ui/dialog.tsx) | TypeScript JSX | -85 | -4 | -11 | -100 |
| [frontend/src/components/ui/input.tsx](/frontend/src/components/ui/input.tsx) | TypeScript JSX | -39 | 0 | -5 | -44 |
| [frontend/src/components/ui/select.tsx](/frontend/src/components/ui/select.tsx) | TypeScript JSX | -61 | 0 | -6 | -67 |
| [frontend/src/components/ui/table.tsx](/frontend/src/components/ui/table.tsx) | TypeScript JSX | -97 | 0 | -16 | -113 |
| [frontend/src/components/ui/tabs.tsx](/frontend/src/components/ui/tabs.tsx) | TypeScript JSX | -47 | 0 | -6 | -53 |
| [frontend/src/contexts/AuthContext.tsx](/frontend/src/contexts/AuthContext.tsx) | TypeScript JSX | -131 | -8 | -19 | -158 |
| [frontend/src/hooks/useOPCUA.ts](/frontend/src/hooks/useOPCUA.ts) | TypeScript | -350 | -13 | -44 | -407 |
| [frontend/src/index.css](/frontend/src/index.css) | CSS | -56 | 0 | -4 | -60 |
| [frontend/src/main.tsx](/frontend/src/main.tsx) | TypeScript JSX | -9 | 0 | -2 | -11 |
| [frontend/src/pages/APCAttainment.tsx](/frontend/src/pages/APCAttainment.tsx) | TypeScript JSX | -302 | -6 | -22 | -330 |
| [frontend/src/pages/Dashboard.tsx](/frontend/src/pages/Dashboard.tsx) | TypeScript JSX | -746 | -16 | -40 | -802 |
| [frontend/src/pages/LoginPage.tsx](/frontend/src/pages/LoginPage.tsx) | TypeScript JSX | -138 | 0 | -8 | -146 |
| [frontend/src/pages/LoopConfig.tsx](/frontend/src/pages/LoopConfig.tsx) | TypeScript JSX | -377 | -7 | -36 | -420 |
| [frontend/src/pages/LoopConfiguration.tsx](/frontend/src/pages/LoopConfiguration.tsx) | TypeScript JSX | -767 | -13 | -36 | -816 |
| [frontend/src/pages/LoopDetail.tsx](/frontend/src/pages/LoopDetail.tsx) | TypeScript JSX | -885 | -24 | -47 | -956 |
| [frontend/src/pages/LoopsList.tsx](/frontend/src/pages/LoopsList.tsx) | TypeScript JSX | -742 | -7 | -25 | -774 |
| [frontend/src/pages/OPCUAConfig.tsx](/frontend/src/pages/OPCUAConfig.tsx) | TypeScript JSX | -231 | -12 | -18 | -261 |
| [frontend/src/pages/OscillationClusters.tsx](/frontend/src/pages/OscillationClusters.tsx) | TypeScript JSX | -336 | -7 | -20 | -363 |
| [frontend/src/pages/Reports.tsx](/frontend/src/pages/Reports.tsx) | TypeScript JSX | -219 | -4 | -7 | -230 |
| [frontend/src/services/opcua-api.ts](/frontend/src/services/opcua-api.ts) | TypeScript | -175 | -15 | -39 | -229 |
| [frontend/src/types/opcua.ts](/frontend/src/types/opcua.ts) | TypeScript | -163 | -9 | -20 | -192 |
| [frontend/src/vite-env.d.ts](/frontend/src/vite-env.d.ts) | TypeScript | -8 | -1 | -3 | -12 |
| [frontend/tailwind.config.js](/frontend/tailwind.config.js) | JavaScript | -51 | -1 | -1 | -53 |
| [frontend/tsconfig.json](/frontend/tsconfig.json) | JSON with Comments | -12 | 0 | -1 | -13 |
| [frontend/vite.config.ts](/frontend/vite.config.ts) | TypeScript | -19 | -2 | -4 | -25 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details