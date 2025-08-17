import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PgService implements OnModuleInit, OnModuleDestroy {
  pool!: Pool;
  async onModuleInit() { this.pool = new Pool({ connectionString: process.env.DATABASE_URL }); }
  async onModuleDestroy() { await this.pool?.end(); }
  async query(text: string, params?: any[]) { const c = await this.pool.connect(); try { return await c.query(text, params); } finally { c.release(); } }
}
