import { Module } from '@nestjs/common';
import { DataService } from './data.service';
import { DataController } from './data.controller';
import { PgService } from '../shared/pg.service';

@Module({
  providers: [DataService, PgService],
  controllers: [DataController]
})
export class DataModule {}
