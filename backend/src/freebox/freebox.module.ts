import { Module } from '@nestjs/common';
import { FreeboxController } from './freebox.controller';
import { FreeboxService } from './freebox.service';

@Module({
  controllers: [FreeboxController],
  providers: [FreeboxService],
  exports: [FreeboxService],
})
export class FreeboxModule {}

