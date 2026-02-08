export interface Movie {
  id: string;
  name: string;
  subtitle?: string;
  channel: string;
  channelId: string;
  startDate: Date;
  endDate: Date;
  categories: string[];
  description?: string;
  rating?: string;
  icon?: string;
  year?: string;
  country?: string;
  directors?: string[];
  actors?: string[];
  isScheduled?: boolean; // true si déjà programmé sur Freebox
}

export interface Channel {
  id: string;
  name: string;
}

export interface MoviesResponse {
  movies: Movie[];
  totalCount: number;
  lastUpdated: Date;
  channels: Channel[];
}

