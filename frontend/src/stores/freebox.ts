import { defineStore } from 'pinia'
import { ref } from 'vue'
import { freeboxApi } from '@/api'

export const useFreeboxStore = defineStore('freebox', () => {
  const connected = ref(false)
  const loading = ref(false)
  const authPending = ref(false)
  const recordingStates = ref<Map<string, 'idle' | 'loading' | 'success' | 'error'>>(new Map())

  async function checkStatus() {
    try {
      const response = await freeboxApi.getStatus()
      connected.value = response.connected
      return response
    } catch {
      connected.value = false
      return { success: false, connected: false }
    }
  }

  async function authorize() {
    loading.value = true
    try {
      const response = await freeboxApi.authorize()
      if (response.success) {
        authPending.value = true
      }
      return response
    } finally {
      loading.value = false
    }
  }

  async function checkAuthorizationStatus() {
    try {
      const response = await freeboxApi.checkAuthorizationStatus()
      if (response.status === 'granted') {
        connected.value = true
        authPending.value = false
      } else if (response.status !== 'pending') {
        authPending.value = false
      }
      return response
    } catch {
      return { success: false, status: 'error', message: 'Erreur de connexion' }
    }
  }

  async function recordMovie(
    movieId: string,
    channelId: string,
    channelName: string,
    start: number,
    end: number,
    name: string,
  ) {
    recordingStates.value.set(movieId, 'loading')

    try {
      const response = await freeboxApi.record({
        movieId,
        channelId,
        channelName,
        start,
        end,
        name,
      })

      if (response.success) {
        recordingStates.value.set(movieId, 'success')
        return response
      } else {
        recordingStates.value.set(movieId, 'error')
        setTimeout(() => recordingStates.value.set(movieId, 'idle'), 3000)
        return response
      }
    } catch (e) {
      recordingStates.value.set(movieId, 'error')
      setTimeout(() => recordingStates.value.set(movieId, 'idle'), 3000)
      return { success: false, error: e instanceof Error ? e.message : 'Erreur' }
    }
  }

  function getRecordingState(movieId: string) {
    return recordingStates.value.get(movieId) || 'idle'
  }

  return {
    connected,
    loading,
    authPending,
    checkStatus,
    authorize,
    checkAuthorizationStatus,
    recordMovie,
    getRecordingState,
  }
})

