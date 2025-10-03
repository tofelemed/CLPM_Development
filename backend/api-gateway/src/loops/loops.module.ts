import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { LoopsController } from './loops.controller';
import { LoopsService } from './loops.service';
import { LoopConfigService } from './loop-config.service';
import { Loop } from './entities/loop.entity';
import { LoopConfig } from './entities/loop-config.entity';
import { DataModule } from '../data/data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loop, LoopConfig]),
    HttpModule,
    DataModule
  ],
  controllers: [LoopsController],
  providers: [LoopsService, LoopConfigService],
  exports: [LoopsService, LoopConfigService],
})
export class LoopsModule {}
