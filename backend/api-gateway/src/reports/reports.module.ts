import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ExcelGeneratorService } from './generators/excel-generator.service';
import { PgService } from '../shared/pg.service';

@Module({
  imports: [HttpModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ExcelGeneratorService,
    PgService
  ],
  exports: [ReportsService]
})
export class ReportsModule {}
