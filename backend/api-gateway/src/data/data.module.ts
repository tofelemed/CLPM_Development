import { Module } from '@nestjs/common';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { PgService } from '../shared/pg.service';
import { InfluxDBService } from '../shared/influxdb.service';

@Module({
  controllers: [DataController],
  providers: [DataService, PgService, InfluxDBService],
  exports: [DataService]
})
export class DataModule {}
