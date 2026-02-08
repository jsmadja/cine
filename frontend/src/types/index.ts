export interface Movie {
  id: string
  name: string
  subtitle?: string
  channel: string
  channelId: string
  startDate: string
  endDate: string
  categories: string[]
  description?: string
  rating?: string
  icon?: string
  year?: string
  country?: string
  directors?: string[]
  actors?: string[]
  isScheduled?: boolean
}

export interface Channel {
  id: string
  name: string
}

export interface MoviesResponse {
  movies: Movie[]
  totalCount: number
  lastUpdated: string
  channels: Channel[]
}

export interface FreeboxStatus {
  success: boolean
  connected: boolean
  message?: string
}

export interface RecordResponse {
  success: boolean
  message?: string
  error?: string
  recordId?: number
}

