import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { DataService } from './data.service';

@Controller('data')
export class DataController {
  constructor(private dataService: DataService) {}

  @Get('raw')
  async getRawData(
    @Query('loopId') loopId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('fields') fields: string,
    @Query('interval') interval?: string,
    @Query('limit') limit?: string
  ) {
    if (!loopId) throw new BadRequestException('loopId required');
    
    const fieldArray = fields ? fields.split(',') : ['pv', 'op', 'sp'];
    const limitNum = limit ? parseInt(limit) : undefined;
    
    return await this.dataService.queryRaw(loopId, start, end, fieldArray, interval, limitNum);
  }

  @Get('aggregated')
  async getAggregatedData(
    @Query('loopId') loopId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('interval') interval: string = '1m'
  ) {
    if (!loopId) throw new BadRequestException('loopId required');
    if (!start || !end) throw new BadRequestException('start/end required');
    
    return await this.dataService.queryAggregated(loopId, start, end, interval);
  }

  @Get('realtime')
  async getRealTimeData(
    @Query('loopId') loopId: string,
    @Query('fields') fields: string
  ) {
    if (!loopId) throw new BadRequestException('loopId required');
    
    const fieldArray = fields ? fields.split(',') : ['pv', 'op', 'sp'];
    
    return await this.dataService.getRealTimeData(loopId, fieldArray);
  }

  @Get('range')
  async getDataRange(@Query('loopId') loopId: string) {
    if (!loopId) throw new BadRequestException('loopId required');
    
    return await this.dataService.getDataRange(loopId);
  }
}
