import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { Movie, MoviesResponse, Channel } from './movie.interface';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get()
  async getMovies(@Query('channels') channels?: string): Promise<MoviesResponse> {
    const channelFilter = channels ? channels.split(',') : undefined;
    return this.moviesService.getMovies(channelFilter);
  }

  @Get('refresh')
  async refresh(): Promise<{ success: boolean; message: string }> {
    await this.moviesService.refreshMovies();
    return { success: true, message: 'Films rafraîchis avec succès' };
  }

  @Get('channels')
  getChannels(): Channel[] {
    return this.moviesService.getAllChannels();
  }

  @Get('filter')
  getFilter(): string[] {
    return this.moviesService.getChannelFilter();
  }

  @Post('filter')
  setFilter(@Body() body: { channels: string[] }): { success: boolean } {
    this.moviesService.setChannelFilter(body.channels);
    return { success: true };
  }

  @Get(':id')
  getMovie(@Param('id') id: string): Movie | undefined {
    return this.moviesService.getMovieById(id);
  }
}

