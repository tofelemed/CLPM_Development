import { PartialType } from '@nestjs/swagger';
import { CreateLoopConfigDto } from './create-loop-config.dto';

export class UpdateLoopConfigDto extends PartialType(CreateLoopConfigDto) {}