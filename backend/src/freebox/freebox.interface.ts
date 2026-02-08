export interface FreeboxConfig {
  appToken: string;
  trackId: number;
  sessionToken?: string;
}

export interface RecordRequest {
  movieId: string;
  channelId: string;
  channelName: string;
  start: number;
  end: number;
  name: string;
}

