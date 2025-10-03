import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoopConfig } from './entities/loop-config.entity';
import { CreateLoopConfigDto } from './dto/create-loop-config.dto';
import { UpdateLoopConfigDto } from './dto/update-loop-config.dto';
import { LoopsService } from './loops.service';

@Injectable()
export class LoopConfigService {
  constructor(
    @InjectRepository(LoopConfig) private repo: Repository<LoopConfig>,
    private loopsService: LoopsService
  ) {}

  async create(loopId: string, dto: CreateLoopConfigDto): Promise<LoopConfig> {
    // Verify loop exists
    const loop = await this.loopsService.findOne(loopId);
    
    // Check if config already exists
    const existingConfig = await this.repo.findOne({ where: { loopId } });
    if (existingConfig) {
      return this.update(loopId, dto);
    }

    const config = this.repo.create({
      loopId,
      sfLow: dto.sf_low || 0.8,
      sfHigh: dto.sf_high || 0.95,
      satHigh: dto.sat_high || 0.2,
      rpiLow: dto.rpi_low || 0.7,
      rpiHigh: dto.rpi_high || 0.9,
      oscLimit: dto.osc_limit || 0.3,
      kpiWindow: dto.kpi_window || 1440,
      importance: 5,
      samplingInterval: dto.sampling_interval || 200,
      serviceFacorLowAlarm: dto.alarm_thresholds?.service_factor_low || 0.75,
      piLowAlarm: dto.alarm_thresholds?.pi_low || 0.65,
      oscillationHighAlarm: dto.alarm_thresholds?.oscillation_high || 0.4,
      stictionHighAlarm: dto.alarm_thresholds?.stiction_high || 0.5,
      connectionId: null,
      monitoredItems: []
    });

    return this.repo.save(config);
  }

  async findByLoopId(loopId: string): Promise<LoopConfig | null> {
    return this.repo.findOne({ where: { loopId } });
  }

  async findAll(): Promise<LoopConfig[]> {
    return this.repo.find({ relations: ['loop'] });
  }

  async update(loopId: string, dto: UpdateLoopConfigDto): Promise<LoopConfig> {
    const config = await this.repo.findOne({ where: { loopId } });
    if (!config) {
      throw new NotFoundException('Loop configuration not found');
    }

    // Update configuration values
    Object.assign(config, {
      sfLow: dto.sf_low ?? config.sfLow ?? 0.8,
      sfHigh: dto.sf_high ?? config.sfHigh ?? 0.95,
      satHigh: dto.sat_high ?? config.satHigh ?? 0.2,
      rpiLow: dto.rpi_low ?? config.rpiLow ?? 0.7,
      rpiHigh: dto.rpi_high ?? config.rpiHigh ?? 0.9,
      oscLimit: dto.osc_limit ?? config.oscLimit ?? 0.3,
      kpiWindow: dto.kpi_window ?? config.kpiWindow ?? 1440,
      samplingInterval: dto.sampling_interval ?? config.samplingInterval ?? 200,
      serviceFacorLowAlarm: dto.alarm_thresholds?.service_factor_low ?? config.serviceFacorLowAlarm ?? 0.75,
      piLowAlarm: dto.alarm_thresholds?.pi_low ?? config.piLowAlarm ?? 0.65,
      oscillationHighAlarm: dto.alarm_thresholds?.oscillation_high ?? config.oscillationHighAlarm ?? 0.4,
      stictionHighAlarm: dto.alarm_thresholds?.stiction_high ?? config.stictionHighAlarm ?? 0.5
    });

    return this.repo.save(config);
  }

  async delete(loopId: string): Promise<void> {
    const config = await this.repo.findOne({ where: { loopId } });
    if (!config) {
      return; // Already deleted
    }

    await this.repo.delete({ loopId });
  }

  async validateLoopTags(loopId: string): Promise<{ [tag: string]: boolean }> {
    const loop = await this.loopsService.findOne(loopId);
    
    const results: { [tag: string]: boolean } = {};
    
    // Basic validation - check if tags are not empty
    results.pv = !!loop.pvTag;
    results.op = !!loop.opTag;
    results.sp = !!loop.spTag;
    results.mode = !!loop.modeTag;
    
    if (loop.valveTag) {
      results.valve = !!loop.valveTag;
    }

    return results;
  }
}