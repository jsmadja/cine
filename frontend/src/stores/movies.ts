import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Movie, Channel } from '@/types'
import { moviesApi } from '@/api'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

const HIDDEN_CHANNELS_KEY = 'cine_hidden_channels'

export const useMoviesStore = defineStore('movies', () => {
  const movies = ref<Movie[]>([])
  const channels = ref<Channel[]>([])
  const selectedChannels = ref<string[]>([])
  const hiddenChannels = ref<Set<string>>(new Set())
  const lastUpdated = ref<Date | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Charger les chaînes masquées depuis le localStorage
  function loadHiddenChannels() {
    try {
      const saved = localStorage.getItem(HIDDEN_CHANNELS_KEY)
      if (saved) {
        hiddenChannels.value = new Set(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Erreur chargement chaînes masquées:', e)
    }
  }

  // Sauvegarder les chaînes masquées
  function saveHiddenChannels() {
    try {
      localStorage.setItem(HIDDEN_CHANNELS_KEY, JSON.stringify([...hiddenChannels.value]))
    } catch (e) {
      console.error('Erreur sauvegarde chaînes masquées:', e)
    }
  }

  // Masquer/afficher une chaîne
  function toggleChannelVisibility(channelName: string) {
    if (hiddenChannels.value.has(channelName)) {
      hiddenChannels.value.delete(channelName)
    } else {
      hiddenChannels.value.add(channelName)
    }
    hiddenChannels.value = new Set(hiddenChannels.value) // Force reactivity
    saveHiddenChannels()
  }

  // Vérifier si une chaîne est visible
  function isChannelVisible(channelName: string): boolean {
    return !hiddenChannels.value.has(channelName)
  }

  // Afficher toutes les chaînes
  function showAllChannels() {
    hiddenChannels.value = new Set()
    saveHiddenChannels()
  }

  // Masquer toutes les chaînes
  function hideAllChannels() {
    const allChannelNames = new Set(movies.value.map(m => m.channel))
    hiddenChannels.value = allChannelNames
    saveHiddenChannels()
  }

  // Films filtrés (sans les chaînes masquées), triés par date desc puis heure desc
  const filteredMovies = computed(() => {
    return movies.value
      .filter(m => !hiddenChannels.value.has(m.channel))
      .sort((a, b) => {
        // Tri par date décroissante, puis heure décroissante
        const dateA = new Date(a.startDate).getTime()
        const dateB = new Date(b.startDate).getTime()
        return dateB - dateA
      })
  })

  // Liste des chaînes uniques présentes dans les films
  const availableChannels = computed(() => {
    const channelSet = new Map<string, number>()
    for (const movie of movies.value) {
      channelSet.set(movie.channel, (channelSet.get(movie.channel) || 0) + 1)
    }
    return [...channelSet.entries()]
      .sort((a, b) => b[1] - a[1]) // Trier par nombre de films
      .map(([name, count]) => ({ name, count }))
  })

  // Grouper les films par jour (avec filtrage)
  const moviesByDay = computed(() => {
    const grouped = new Map<string, Movie[]>()

    for (const movie of filteredMovies.value) {
      const day = dayjs(movie.startDate).format('dddd D MMMM YYYY')
      if (!grouped.has(day)) {
        grouped.set(day, [])
      }
      grouped.get(day)!.push(movie)
    }

    return grouped
  })

  // Grouper par jour puis par chaîne (avec filtrage)
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

  const totalMovies = computed(() => filteredMovies.value.length)
  const totalDays = computed(() => moviesByDay.value.size)
  const hiddenCount = computed(() => hiddenChannels.value.size)

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
      loadHiddenChannels() // Charger les préférences
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
    hiddenChannels,
    lastUpdated,
    loading,
    error,
    moviesByDay,
    moviesByDayAndChannel,
    totalMovies,
    totalDays,
    hiddenCount,
    filteredMovies,
    availableChannels,
    fetchMovies,
    refreshMovies,
    loadFilter,
    setFilter,
    toggleChannelVisibility,
    isChannelVisible,
    showAllChannels,
    hideAllChannels,
  }
})

