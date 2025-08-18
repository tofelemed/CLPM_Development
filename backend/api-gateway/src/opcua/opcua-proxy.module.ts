import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OpcuaProxyController } from './opcua-proxy.controller';

@Module({
  imports: [HttpModule],
  controllers: [OpcuaProxyController],
})
export class OpcuaProxyModule {}
