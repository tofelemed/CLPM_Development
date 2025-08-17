import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoopsController } from './loops.controller';
import { LoopsService } from './loops.service';
import { Loop } from './entities/loop.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Loop])],
  controllers: [LoopsController],
  providers: [LoopsService],
  exports: [LoopsService],
})
export class LoopsModule {}
