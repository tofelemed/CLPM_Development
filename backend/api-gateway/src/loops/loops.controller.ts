import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LoopsService } from './loops.service';
import { LoopConfigService } from './loop-config.service';
import { OpcuaService } from './opcua.service';
import { CreateLoopDto } from './dto/create-loop.dto';
import { UpdateLoopDto } from './dto/update-loop.dto';
import { CreateLoopConfigDto } from './dto/create-loop-config.dto';
import { UpdateLoopConfigDto } from './dto/update-loop-config.dto';
import { Roles } from '../auth/roles.decorator';

@ApiTags('loops')
@ApiBearerAuth()
@Controller('loops')
export class LoopsController {
  constructor(
    private readonly service: LoopsService,
    private readonly configService: LoopConfigService,
    private readonly opcuaService: OpcuaService
  ) {}

  @Get()
  async list() { 
    const loops = await this.service.findAll();
    // Transform to match frontend expectations
    return { 
      loops: loops.map(loop => ({
        id: loop.id,
        name: loop.name,
        description: loop.description,
        importance: loop.importance,
        pv_tag: loop.pvTag,
        op_tag: loop.opTag,
        sp_tag: loop.spTag,
        mode_tag: loop.modeTag,
        valve_tag: loop.valveTag,
        created_at: loop.createdAt,
        updated_at: loop.updatedAt,
        status: 'active' // Default status
      }))
    };
  }

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateLoopDto) { 
    const loop = await this.service.create(dto);
    return {
      id: loop.id,
      name: loop.name,
      description: loop.description,
      importance: loop.importance,
      pv_tag: loop.pvTag,
      op_tag: loop.opTag,
      sp_tag: loop.spTag,
      mode_tag: loop.modeTag,
      valve_tag: loop.valveTag,
      created_at: loop.createdAt,
      updated_at: loop.updatedAt,
      status: 'active'
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) { 
    const loop = await this.service.findOne(id);
    return {
      id: loop.id,
      name: loop.name,
      description: loop.description,
      importance: loop.importance,
      pv_tag: loop.pvTag,
      op_tag: loop.opTag,
      sp_tag: loop.spTag,
      mode_tag: loop.modeTag,
      valve_tag: loop.valveTag,
      created_at: loop.createdAt,
      updated_at: loop.updatedAt,
      status: 'active'
    };
  }

  @Put(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateLoopDto) { 
    const loop = await this.service.update(id, dto);
    return {
      id: loop.id,
      name: loop.name,
      description: loop.description,
      importance: loop.importance,
      pv_tag: loop.pvTag,
      op_tag: loop.opTag,
      sp_tag: loop.spTag,
      mode_tag: loop.modeTag,
      valve_tag: loop.valveTag,
      created_at: loop.createdAt,
      updated_at: loop.updatedAt,
      status: 'active'
    };
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) { 
    // Delete configuration first (which removes OPC UA monitoring)
    await this.configService.delete(id);
    // Then delete the loop
    await this.service.softDelete(id); 
    return { status: 'ok' }; 
  }

  // Loop Configuration Endpoints
  @Get(':id/config')
  async getConfig(@Param('id') id: string) {
    const config = await this.configService.findByLoopId(id);
    if (!config) {
      return null;
    }
    
    return {
      loop_id: config.loopId,
      sf_low: config.sfLow,
      sf_high: config.sfHigh,
      sat_high: config.satHigh,
      rpi_low: config.rpiLow,
      rpi_high: config.rpiHigh,
      osc_limit: config.oscLimit,
      kpi_window: config.kpiWindow,
      importance: config.loop?.importance || 3,
      sampling_interval: config.samplingInterval,
      alarm_thresholds: {
        service_factor_low: config.serviceFacorLowAlarm,
        pi_low: config.piLowAlarm,
        oscillation_high: config.oscillationHighAlarm,
        stiction_high: config.stictionHighAlarm
      }
    };
  }

  @Post(':id/config')
  @Roles('admin')
  async createConfig(@Param('id') id: string, @Body() dto: CreateLoopConfigDto) {
    const config = await this.configService.create(id, dto);
    return {
      loop_id: config.loopId,
      sf_low: config.sfLow,
      sf_high: config.sfHigh,
      sat_high: config.satHigh,
      rpi_low: config.rpiLow,
      rpi_high: config.rpiHigh,
      osc_limit: config.oscLimit,
      kpi_window: config.kpiWindow,
      sampling_interval: config.samplingInterval,
      alarm_thresholds: {
        service_factor_low: config.serviceFacorLowAlarm,
        pi_low: config.piLowAlarm,
        oscillation_high: config.oscillationHighAlarm,
        stiction_high: config.stictionHighAlarm
      }
    };
  }

  @Put(':id/config')
  @Roles('admin')
  async updateConfig(@Param('id') id: string, @Body() dto: UpdateLoopConfigDto) {
    const config = await this.configService.update(id, dto);
    return {
      loop_id: config.loopId,
      sf_low: config.sfLow,
      sf_high: config.sfHigh,
      sat_high: config.satHigh,
      rpi_low: config.rpiLow,
      rpi_high: config.rpiHigh,
      osc_limit: config.oscLimit,
      kpi_window: config.kpiWindow,
      sampling_interval: config.samplingInterval,
      alarm_thresholds: {
        service_factor_low: config.serviceFacorLowAlarm,
        pi_low: config.piLowAlarm,
        oscillation_high: config.oscillationHighAlarm,
        stiction_high: config.stictionHighAlarm
      }
    };
  }

  @Delete(':id/config')
  @Roles('admin')
  async deleteConfig(@Param('id') id: string) {
    await this.configService.delete(id);
    return { status: 'ok' };
  }

  @Get(':id/validate-tags')
  async validateTags(@Param('id') id: string) {
    const results = await this.configService.validateLoopTags(id);
    return { validation: results };
  }

  // OPC UA Integration Endpoints
  @Get('opcua/connections')
  async getOpcuaConnections() {
    const connections = await this.opcuaService.getConnections();
    return { connections };
  }

  @Get('opcua/browse')
  async browseNodes(@Query('nodeId') nodeId?: string) {
    const results = await this.opcuaService.browseNodes(nodeId || 'RootFolder');
    return { results };
  }

  @Get('opcua/search')
  async searchNodes(@Query('q') searchTerm?: string) {
    if (!searchTerm) {
      return { results: [] };
    }
    const results = await this.opcuaService.searchNodes(searchTerm);
    return { results };
  }
}
