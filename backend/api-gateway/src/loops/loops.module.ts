import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { LoopsController } from './loops.controller';
import { LoopsService } from './loops.service';
import { LoopConfigService } from './loop-config.service';
import { OpcuaService } from './opcua.service';
import { Loop } from './entities/loop.entity';
import { LoopConfig } from './entities/loop-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Loop, LoopConfig]),
    HttpModule
  ],
  controllers: [LoopsController],
  providers: [LoopsService, LoopConfigService, OpcuaService],
  exports: [LoopsService, LoopConfigService, OpcuaService],
})
export class LoopsModule {}
