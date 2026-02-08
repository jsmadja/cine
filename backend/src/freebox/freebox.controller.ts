import { Controller, Get, Post, Body } from '@nestjs/common';
import { FreeboxService } from './freebox.service';
import { RecordRequest } from './freebox.interface';

@Controller('freebox')
export class FreeboxController {
  constructor(private readonly freeboxService: FreeboxService) {}

  @Get('status')
  getStatus() {
    return this.freeboxService.getStatus();
  }

  @Post('authorize')
  authorize() {
    return this.freeboxService.authorize();
  }

  @Get('authorize/status')
  getAuthorizationStatus() {
    return this.freeboxService.checkAuthorizationStatus();
  }

  @Get('channels')
  getChannels() {
    return this.freeboxService.getChannels();
  }

  @Post('record')
  record(@Body() request: RecordRequest) {
    return this.freeboxService.record(request);
  }

  @Get('recordings')
  getRecordings() {
    return this.freeboxService.getRecordings();
  }
}

