import { Module } from '@nestjs/common';
import { MoviesController } from './movies.controller';
import { MoviesService } from './movies.service';
import { ImdbService } from './imdb.service';
import { FreeboxModule } from '../freebox/freebox.module';

@Module({
  imports: [FreeboxModule],
  controllers: [MoviesController],
  providers: [MoviesService, ImdbService],
  exports: [MoviesService, ImdbService],
})
export class MoviesModule {}

