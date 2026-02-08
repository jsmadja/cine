import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Movie, Channel } from '@/types'
import { moviesApi } from '@/api'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

export const useMoviesStore = defineStore('movies', () => {
  const movies = ref<Movie[]>([])
  const channels = ref<Channel[]>([])
  const selectedChannels = ref<string[]>([])
  const lastUpdated = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Grouper les films par jour
  const moviesByDay = computed(() => {
    const grouped = new Map<string, Movie[]>()

    for (const movie of movies.value) {
      const day = dayjs(movie.startDate).format('dddd D MMMM YYYY')
      if (!grouped.has(day)) {
        grouped.set(day, [])
      }
      grouped.get(day)!.push(movie)
    }

    return grouped
  })

  // Grouper par jour puis par chaîne
  const moviesByDayAndChannel = computed(() => {
    const result = new Map<string, Map<string, Movie[]>>()

    for (const [day, dayMovies] of moviesByDay.value) {
      const byChannel = new Map<string, Movie[]>()

      for (const movie of dayMovies) {
        if (!byChannel.has(movie.channel)) {
          byChannel.set(movie.channel, [])
        }
        byChannel.get(movie.channel)!.push(movie)
      }

      // Trier par nombre de films
      const sorted = new Map(
        [...byChannel.entries()].sort((a, b) => b[1].length - a[1].length)
      )

      result.set(day, sorted)
    }

    return result
  })

  const totalMovies = computed(() => movies.value.length)
  const totalDays = computed(() => moviesByDay.value.size)

  async function fetchMovies() {
    loading.value = true
    error.value = null

    try {
      const response = await moviesApi.getMovies(
        selectedChannels.value.length > 0 ? selectedChannels.value : undefined
      )
      movies.value = response.movies
      channels.value = response.channels
      lastUpdated.value = new Date(response.lastUpdated)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement'
      console.error('Erreur:', e)
    } finally {
      loading.value = false
    }
  }

  async function refreshMovies() {
    loading.value = true
    error.value = null

    try {
      await moviesApi.refreshMovies()
      await fetchMovies()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de rafraîchissement'
    } finally {
      loading.value = false
    }
  }

  async function loadFilter() {
    try {
      selectedChannels.value = await moviesApi.getFilter()
    } catch (e) {
      console.error('Erreur chargement filtre:', e)
    }
  }

  async function setFilter(channels: string[]) {
    selectedChannels.value = channels
    await moviesApi.setFilter(channels)
    await fetchMovies()
  }

  return {
    movies,
    channels,
    selectedChannels,
    lastUpdated,
    loading,
    error,
    moviesByDay,
    moviesByDayAndChannel,
    totalMovies,
    totalDays,
    fetchMovies,
    refreshMovies,
    loadFilter,
    setFilter,
  }
})

