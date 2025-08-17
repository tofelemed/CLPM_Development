import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateLoopDto {
  @ApiProperty() @IsString() @IsNotEmpty() name!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;
  @ApiProperty() @IsString() pv_tag!: string;
  @ApiProperty() @IsString() op_tag!: string;
  @ApiProperty() @IsString() sp_tag!: string;
  @ApiProperty() @IsString() mode_tag!: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() valve_tag?: string;
  @ApiProperty({ default: 5 }) @IsInt() @Min(1) @Max(10) importance: number = 5;
}
