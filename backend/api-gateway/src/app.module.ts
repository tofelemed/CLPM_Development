import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { LoopsModule } from './loops/loops.module';
import { DataModule } from './data/data.module';
import { KpiModule } from './kpi/kpi.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { AuthModule } from './auth/auth.module';
import { OpcuaProxyModule } from './opcua/opcua-proxy.module';
import { JwtAuthGuard } from './auth/jwt.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
          console.warn('DATABASE_URL not configured, skipping database connection');
          return {
            type: 'postgres',
            url: 'postgresql://dummy:dummy@localhost:5432/dummy',
            synchronize: false,
            autoLoadEntities: true,
            logging: false,
            ssl: false,
            extra: {
              max: 0, // Disable connection pool
            }
          };
        }
        return {
          type: 'postgres',
          url: databaseUrl,
          synchronize: false,
          autoLoadEntities: true
        };
      },
    }),
    AuthModule,
    LoopsModule,
    DataModule,
    KpiModule,
    DiagnosticsModule,
    OpcuaProxyModule
  ],
  providers: [
    // Temporarily disabled for development
    // { provide: APP_GUARD, useClass: JwtAuthGuard },
    // { provide: APP_GUARD, useClass: RolesGuard }
  ]
})
export class AppModule {}
