import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataService } from './data.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('data')
@ApiBearerAuth()
@Controller('loops/:id/data')
export class DataController {
  constructor(private readonly service: DataService) {}

  @Get()
  getData(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('fields') fields?: string,
    @Query('interval') interval?: string,
    @Query('limit') limit?: string
  ) {
    const f = fields ? fields.split(',') : ['pv','op','sp','mode'];
    const limitNum = limit ? parseInt(limit) : undefined;
    return this.service.queryRaw(id, start, end, f, interval, limitNum);
  }

  @Get('range')
  getDataRange(@Param('id') id: string) {
    return this.service.getDataRange(id); 
  }
}
