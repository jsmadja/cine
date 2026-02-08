import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MoviesModule } from './movies/movies.module';
import { FreeboxModule } from './freebox/freebox.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MoviesModule,
    FreeboxModule,
  ],
})
export class AppModule {}

