import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loop } from './entities/loop.entity';
import { CreateLoopDto } from './dto/create-loop.dto';
import { UpdateLoopDto } from './dto/update-loop.dto';

@Injectable()
export class LoopsService {
  constructor(@InjectRepository(Loop) private repo: Repository<Loop>) {}

  async create(dto: CreateLoopDto): Promise<Loop> {
    const loop = this.repo.create({
      name: dto.name,
      description: dto.description,
      pvTag: dto.pv_tag,
      opTag: dto.op_tag,
      spTag: dto.sp_tag,
      modeTag: dto.mode_tag,
      valveTag: dto.valve_tag,
      importance: dto.importance
    });
    return this.repo.save(loop);
  }

  findAll(): Promise<Loop[]> {
    return this.repo.find({ where: { deletedAt: null }, order: { updatedAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Loop> {
    const loop = await this.repo.findOne({ where: { loop_id: id } });
    if (!loop || loop.deletedAt) throw new NotFoundException('Loop not found');
    return loop;
  }

  async update(id: string, dto: UpdateLoopDto): Promise<Loop> {
    const loop = await this.findOne(id);
    Object.assign(loop, {
      name: dto.name ?? loop.name,
      description: dto.description ?? loop.description,
      pvTag: dto.pv_tag ?? loop.pvTag,
      opTag: dto.op_tag ?? loop.opTag,
      spTag: dto.sp_tag ?? loop.spTag,
      modeTag: dto.mode_tag ?? loop.modeTag,
      valveTag: dto.valve_tag ?? loop.valveTag,
      importance: dto.importance ?? loop.importance
    });
    return this.repo.save(loop);
  }

  async softDelete(id: string): Promise<void> {
    const loop = await this.findOne(id);
    loop.deletedAt = new Date();
    await this.repo.save(loop);
  }
}
