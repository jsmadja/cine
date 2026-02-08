import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { freeboxApi } from '@/api'

export interface Recording {
  id: number
  name: string
  start: number
  end: number
  channel_name?: string
  channel_uuid?: string
  state?: string
}

export const useFreeboxStore = defineStore('freebox', () => {
  const connected = ref(false)
  const loading = ref(false)
  const authPending = ref(false)
  const recordingStates = ref<Map<string, 'idle' | 'loading' | 'success' | 'error'>>(new Map())
  const recordings = ref<Recording[]>([])
  const recordingsLoading = ref(false)

  // Titres à exclure de la liste des enregistrements
  const EXCLUDED_RECORDINGS = ['Affaire conclue, tout le monde a quelque chose à vendre']

  // Enregistrements triés par date croissante (avec exclusions)
  const sortedRecordings = computed(() => {
    return [...recordings.value]
      .filter(r => !EXCLUDED_RECORDINGS.some(excluded =>
        r.name.toLowerCase().includes(excluded.toLowerCase())
      ))
      .sort((a, b) => a.start - b.start)
  })

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

  async function fetchRecordings() {
    if (!connected.value) return

    recordingsLoading.value = true
    try {
      const response = await freeboxApi.getRecordings()
      if (response.success && response.recordings) {
        recordings.value = Array.isArray(response.recordings)
          ? response.recordings
          : Object.values(response.recordings)
      }
    } catch (e) {
      console.error('Erreur récupération enregistrements:', e)
    } finally {
      recordingsLoading.value = false
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
    recordings,
    recordingsLoading,
    sortedRecordings,
    checkStatus,
    authorize,
    checkAuthorizationStatus,
    recordMovie,
    getRecordingState,
    fetchRecordings,
  }
})

