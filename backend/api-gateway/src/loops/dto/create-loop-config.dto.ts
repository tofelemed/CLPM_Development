import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateLoopConfigDto {
  @ApiProperty({ default: 0.8 }) @IsNumber() @Min(0) @Max(1) sf_low: number = 0.8;
  @ApiProperty({ default: 0.95 }) @IsNumber() @Min(0) @Max(1) sf_high: number = 0.95;
  @ApiProperty({ default: 0.2 }) @IsNumber() @Min(0) @Max(1) sat_high: number = 0.2;
  @ApiProperty({ default: 0.7 }) @IsNumber() @Min(0) @Max(1) rpi_low: number = 0.7;
  @ApiProperty({ default: 0.9 }) @IsNumber() @Min(0) @Max(1) rpi_high: number = 0.9;
  @ApiProperty({ default: 0.3 }) @IsNumber() @Min(0) @Max(1) osc_limit: number = 0.3;
  @ApiProperty({ default: 1440 }) @IsNumber() @Min(1) kpi_window: number = 1440;
  @ApiProperty({ default: 200 }) @IsNumber() @Min(50) @Max(10000) sampling_interval: number = 200;
  
  @ApiProperty({ required: false }) @IsOptional() 
  alarm_thresholds?: {
    service_factor_low: number;
    pi_low: number;
    oscillation_high: number;
    stiction_high: number;
  };

  @ApiProperty({ required: false }) @IsString() @IsOptional() connection_id?: string;
}