import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Movie, Channel } from '@/types'
import { moviesApi } from '@/api'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'

dayjs.locale('fr')

const HIDDEN_CHANNELS_KEY = 'cine_hidden_channels'
const HIDDEN_CATEGORIES_KEY = 'cine_hidden_categories'

export const useMoviesStore = defineStore('movies', () => {
  const movies = ref<Movie[]>([])
  const channels = ref<Channel[]>([])
  const selectedChannels = ref<string[]>([])
  const hiddenChannels = ref<Set<string>>(new Set())
  const hiddenCategories = ref<Set<string>>(new Set())
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

  // Charger les catégories masquées depuis le localStorage
  function loadHiddenCategories() {
    try {
      const saved = localStorage.getItem(HIDDEN_CATEGORIES_KEY)
      if (saved) {
        hiddenCategories.value = new Set(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Erreur chargement catégories masquées:', e)
    }
  }

  // Sauvegarder les catégories masquées
  function saveHiddenCategories() {
    try {
      localStorage.setItem(HIDDEN_CATEGORIES_KEY, JSON.stringify([...hiddenCategories.value]))
    } catch (e) {
      console.error('Erreur sauvegarde catégories masquées:', e)
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

  // Masquer/afficher une catégorie
  function toggleCategoryVisibility(category: string) {
    if (hiddenCategories.value.has(category)) {
      hiddenCategories.value.delete(category)
    } else {
      hiddenCategories.value.add(category)
    }
    hiddenCategories.value = new Set(hiddenCategories.value) // Force reactivity
    saveHiddenCategories()
  }

  // Vérifier si une catégorie est visible
  function isCategoryVisible(category: string): boolean {
    return !hiddenCategories.value.has(category)
  }

  // Afficher toutes les catégories
  function showAllCategories() {
    hiddenCategories.value = new Set()
    saveHiddenCategories()
  }

  // Masquer toutes les catégories
  function hideAllCategories() {
    const allCategories = new Set(movies.value.flatMap(m => m.categories))
    hiddenCategories.value = allCategories
    saveHiddenCategories()
  }

  // Exporter les filtres (chaînes et catégories masquées)
  function exportFilters(): string {
    const filters = {
      version: 1,
      hiddenChannels: [...hiddenChannels.value],
      hiddenCategories: [...hiddenCategories.value],
      exportDate: new Date().toISOString()
    }
    return JSON.stringify(filters, null, 2)
  }

  // Importer les filtres
  function importFilters(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString)

      if (!data.version || !Array.isArray(data.hiddenChannels) || !Array.isArray(data.hiddenCategories)) {
        return { success: false, message: 'Format de fichier invalide' }
      }

      hiddenChannels.value = new Set(data.hiddenChannels)
      hiddenCategories.value = new Set(data.hiddenCategories)

      saveHiddenChannels()
      saveHiddenCategories()

      return {
        success: true,
        message: `Importé: ${data.hiddenChannels.length} chaînes masquées, ${data.hiddenCategories.length} catégories masquées`
      }
    } catch (e) {
      return { success: false, message: 'Erreur de parsing JSON' }
    }
  }

  // Films filtrés (sans les chaînes et catégories masquées, et sans année de sortie), triés par date desc puis heure desc
  const filteredMovies = computed(() => {
    return movies.value
      .filter(m => !hiddenChannels.value.has(m.channel))
      .filter(m => {
        // Exclure les films sans année de sortie
        if (!m.year) return false
        // Si le film n'a pas de catégorie, on l'affiche
        if (!m.categories || m.categories.length === 0) return true
        // Sinon, on vérifie qu'au moins une catégorie est visible
        return m.categories.some(cat => !hiddenCategories.value.has(cat))
      })
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
      .sort((a, b) => {
        // D'abord trier par visibilité (cochés en haut)
        const aVisible = !hiddenChannels.value.has(a[0])
        const bVisible = !hiddenChannels.value.has(b[0])
        if (aVisible !== bVisible) return aVisible ? -1 : 1
        // Puis par ordre alphabétique
        return a[0].localeCompare(b[0])
      })
      .map(([name, count]) => ({ name, count }))
  })

  // Liste des catégories uniques présentes dans les films
  const availableCategories = computed(() => {
    const categorySet = new Map<string, number>()
    for (const movie of movies.value) {
      for (const category of movie.categories || []) {
        categorySet.set(category, (categorySet.get(category) || 0) + 1)
      }
    }
    return [...categorySet.entries()]
      .sort((a, b) => {
        // D'abord trier par visibilité (cochés en haut)
        const aVisible = !hiddenCategories.value.has(a[0])
        const bVisible = !hiddenCategories.value.has(b[0])
        if (aVisible !== bVisible) return aVisible ? -1 : 1
        // Puis par ordre alphabétique
        return a[0].localeCompare(b[0])
      })
      .map(([name, count]) => ({ name, count }))
  })

  // Grouper les films par jour (avec filtrage), jours triés desc, films triés par heure asc
  const moviesByDay = computed(() => {
    const grouped = new Map<string, Movie[]>()

    for (const movie of filteredMovies.value) {
      const day = dayjs(movie.startDate).format('dddd D MMMM YYYY')
      if (!grouped.has(day)) {
        grouped.set(day, [])
      }
      grouped.get(day)!.push(movie)
    }

    // Trier les films par heure croissante dans chaque jour
    for (const [day, dayMovies] of grouped) {
      dayMovies.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    }

    // Trier les jours par ordre décroissant
    const sortedEntries = [...grouped.entries()].sort((a, b) => {
      const dateA = dayjs(a[1][0]?.startDate).startOf('day').valueOf()
      const dateB = dayjs(b[1][0]?.startDate).startOf('day').valueOf()
      return dateB - dateA
    })

    return new Map(sortedEntries)
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

      // Trier les films par heure dans chaque chaîne
      for (const [, channelMovies] of byChannel) {
        channelMovies.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
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
  const hiddenChannelsCount = computed(() => hiddenChannels.value.size)
  const hiddenCategoriesCount = computed(() => hiddenCategories.value.size)

  async function fetchMovies() {
    loading.value = true
    error.value = null

    try {
      // Charger les préférences d'abord si pas encore fait
      if (hiddenChannels.value.size === 0 && hiddenCategories.value.size === 0) {
        loadHiddenChannels()
        loadHiddenCategories()
      }

      // Envoyer les filtres à l'API pour optimiser la récupération des notes IMDB
      const response = await moviesApi.getMovies(
        selectedChannels.value.length > 0 ? selectedChannels.value : undefined,
        [...hiddenChannels.value],
        [...hiddenCategories.value],
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
    hiddenChannels,
    hiddenCategories,
    lastUpdated,
    loading,
    error,
    moviesByDay,
    moviesByDayAndChannel,
    totalMovies,
    totalDays,
    hiddenChannelsCount,
    hiddenCategoriesCount,
    filteredMovies,
    availableChannels,
    availableCategories,
    fetchMovies,
    refreshMovies,
    loadFilter,
    setFilter,
    toggleChannelVisibility,
    isChannelVisible,
    showAllChannels,
    hideAllChannels,
    toggleCategoryVisibility,
    isCategoryVisible,
    showAllCategories,
    hideAllCategories,
    exportFilters,
    importFilters,
  }
})

