import axios from 'axios'
import type { MoviesResponse, FreeboxStatus, RecordResponse, Channel } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
})

export const moviesApi = {
  getMovies: async (
    channels?: string[],
    hiddenChannels?: string[],
    hiddenCategories?: string[],
  ): Promise<MoviesResponse> => {
    const params: Record<string, string> = {}
    if (channels?.length) {
      params.channels = channels.join(',')
    }
    if (hiddenChannels?.length) {
      params.hiddenChannels = hiddenChannels.join(',')
    }
    if (hiddenCategories?.length) {
      params.hiddenCategories = hiddenCategories.join(',')
    }
    const response = await api.get<MoviesResponse>('/movies', { params })
    return response.data
  },

  refreshMovies: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.get('/movies/refresh')
    return response.data
  },

  getChannels: async (): Promise<Channel[]> => {
    const response = await api.get<Channel[]>('/movies/channels')
    return response.data
  },

  getFilter: async (): Promise<string[]> => {
    const response = await api.get<string[]>('/movies/filter')
    return response.data
  },

  setFilter: async (channels: string[]): Promise<void> => {
    await api.post('/movies/filter', { channels })
  },
}

export const freeboxApi = {
  getStatus: async (): Promise<FreeboxStatus> => {
    const response = await api.get<FreeboxStatus>('/freebox/status')
    return response.data
  },

  authorize: async (): Promise<{ success: boolean; message?: string; trackId?: number }> => {
    const response = await api.post('/freebox/authorize')
    return response.data
  },

  checkAuthorizationStatus: async (): Promise<{ success: boolean; status?: string; message?: string }> => {
    const response = await api.get('/freebox/authorize/status')
    return response.data
  },

  record: async (data: {
    movieId: string
    channelId: string
    channelName: string
    start: number
    end: number
    name: string
  }): Promise<RecordResponse> => {
    const response = await api.post<RecordResponse>('/freebox/record', data)
    return response.data
  },

  getRecordings: async (): Promise<{ success: boolean; recordings?: any[] }> => {
    const response = await api.get('/freebox/recordings')
    return response.data
  },
}

