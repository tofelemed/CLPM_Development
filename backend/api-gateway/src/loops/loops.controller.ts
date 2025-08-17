import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LoopsService } from './loops.service';
import { CreateLoopDto } from './dto/create-loop.dto';
import { UpdateLoopDto } from './dto/update-loop.dto';
import { Roles } from '../auth/roles.decorator';

@ApiTags('loops')
@ApiBearerAuth()
@Controller('loops')
export class LoopsController {
  constructor(private readonly service: LoopsService) {}

  @Get()
  list() { return this.service.findAll(); }

  @Post()
  create(@Body() dto: CreateLoopDto) { return this.service.create(dto); }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.findOne(id); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLoopDto) { return this.service.update(id, dto); }

  @Delete(':id')
  async remove(@Param('id') id: string) { await this.service.softDelete(id); return { status: 'ok' }; }
}
