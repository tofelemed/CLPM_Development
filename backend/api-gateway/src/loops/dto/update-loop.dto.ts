import { PartialType } from '@nestjs/swagger';
import { CreateLoopDto } from './create-loop.dto';
export class UpdateLoopDto extends PartialType(CreateLoopDto) {}
