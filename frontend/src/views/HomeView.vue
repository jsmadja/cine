<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useMoviesStore } from '@/stores/movies'
import { useFreeboxStore } from '@/stores/freebox'
import MovieCard from '@/components/MovieCard.vue'
import FreeboxModal from '@/components/FreeboxModal.vue'
import ChannelFilter from '@/components/ChannelFilter.vue'
import CategoryFilter from '@/components/CategoryFilter.vue'
import RecordingsPanel from '@/components/RecordingsPanel.vue'
import FilterExportImport from '@/components/FilterExportImport.vue'
import dayjs from 'dayjs'

const moviesStore = useMoviesStore()
const freeboxStore = useFreeboxStore()

const showFreeboxModal = ref(false)
const refreshing = ref(false)
const viewMode = ref<'cards' | 'table'>('cards')

let statusInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  // Charger le mode d'affichage sauvegardé
  const savedViewMode = localStorage.getItem('cine_view_mode')
  if (savedViewMode === 'table' || savedViewMode === 'cards') {
    viewMode.value = savedViewMode
  }

  await moviesStore.fetchMovies()
  await freeboxStore.checkStatus()

  statusInterval = setInterval(() => {
    freeboxStore.checkStatus()
  }, 30000)
})

onUnmounted(() => {
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})

async function handleRefresh() {
  refreshing.value = true
  await moviesStore.refreshMovies()
  refreshing.value = false
}

function toggleViewMode() {
  viewMode.value = viewMode.value === 'cards' ? 'table' : 'cards'
  localStorage.setItem('cine_view_mode', viewMode.value)
}

function formatLastUpdated(date: Date | null) {
  if (!date) return 'Jamais'
  return dayjs(date).format('DD/MM/YYYY HH:mm')
}

function formatTime(date: string) {
  return dayjs(date).format('HH:mm')
}

function formatDate(date: string) {
  return dayjs(date).format('DD/MM')
}

function formatDuration(start: string, end: string) {
  const minutes = dayjs(end).diff(dayjs(start), 'minute')
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`
}

async function recordMovie(movie: any) {
  const start = Math.floor(new Date(movie.startDate).getTime() / 1000)
  const end = Math.floor(new Date(movie.endDate).getTime() / 1000)

  await freeboxStore.recordMovie(
    movie.id,
    movie.channelId,
    movie.channel,
    start,
    end,
    movie.name,
  )

  // Rafraîchir pour mettre à jour le statut isScheduled
  setTimeout(() => moviesStore.fetchMovies(), 2000)
}
</script>

<template>
  <div class="home-view">
    <header>
      <div class="stats">
        <button class="refresh-btn" :disabled="refreshing" @click="handleRefresh">
          {{ refreshing ? '⏳' : '🔄' }} Rafraîchir
        </button>
        <button class="view-toggle" @click="toggleViewMode">
          {{ viewMode === 'cards' ? '📋 Tableau' : '🎴 Cartes' }}
        </button>
        <ChannelFilter />
        <CategoryFilter />
        <FilterExportImport />
        <RecordingsPanel />
        <div
          class="freebox-status"
          :class="{ connected: freeboxStore.connected, error: !freeboxStore.connected }"
          @click="showFreeboxModal = true"
        >
          <span class="indicator"></span>
          <span class="status-text">
            {{ freeboxStore.connected ? 'Freebox ✓' : 'Freebox' }}
          </span>
        </div>
      </div>
    </header>

    <main>
      <div v-if="moviesStore.loading" class="loading">
        <p>⏳ Chargement des films...</p>
      </div>

      <div v-else-if="moviesStore.error" class="error">
        <p>❌ {{ moviesStore.error }}</p>
        <button @click="moviesStore.fetchMovies()">Réessayer</button>
      </div>

      <div v-else-if="moviesStore.totalMovies === 0" class="empty">
        <p>📭 Aucun film trouvé</p>
      </div>

      <!-- Vue Cartes -->
      <template v-else-if="viewMode === 'cards'">
        <section
          v-for="[day, channelMovies] in moviesStore.moviesByDayAndChannel"
          :key="day"
          class="day-section"
        >
          <div class="day-header">
            <h2>📅 {{ day }}</h2>
            <span class="day-count">
              {{ [...channelMovies.values()].reduce((sum, m) => sum + m.length, 0) }} film(s)
            </span>
          </div>

          <div
            v-for="[channel, movies] in channelMovies"
            :key="channel"
            class="channel-section"
          >
            <div class="channel-header">
              <h3>📺 {{ channel }}</h3>
              <span class="channel-count">{{ movies.length }} film(s)</span>
            </div>

            <div class="movies-grid">
              <MovieCard v-for="movie in movies" :key="movie.id" :movie="movie" />
            </div>
          </div>
        </section>
      </template>

      <!-- Vue Tableau -->
      <template v-else>
        <section
          v-for="[day, dayMovies] in moviesStore.moviesByDay"
          :key="day"
          class="day-section"
        >
          <div class="day-header">
            <h2>📅 {{ day }}</h2>
            <span class="day-count">
              {{ dayMovies.length }} film(s)
            </span>
          </div>

          <div class="table-container">
            <table class="movies-table">
              <thead>
                <tr>
                  <th class="th-status">⏺️</th>
                  <th class="th-time">Heure</th>
                  <th class="th-channel">Chaîne</th>
                  <th class="th-title">Titre</th>
                  <th class="th-categories">Catégories</th>
                  <th class="th-year">Année</th>
                  <th class="th-duration">Durée</th>
                  <th class="th-rating">Note</th>
                  <th class="th-action">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="movie in dayMovies"
                  :key="movie.id"
                  :class="{ 'is-scheduled': movie.isScheduled }"
                >
                  <td class="td-status">
                    <span v-if="movie.isScheduled" class="status-badge scheduled" title="Programmé">✅</span>
                    <span v-else class="status-badge not-scheduled" title="Non programmé">⚪</span>
                  </td>
                  <td class="td-time">{{ formatTime(movie.startDate) }}</td>
                  <td class="td-channel">{{ movie.channel }}</td>
                  <td class="td-title">
                    <div class="title-cell">
                      <span class="movie-name">{{ movie.name }}</span>
                      <span v-if="movie.subtitle" class="movie-subtitle">{{ movie.subtitle }}</span>
                    </div>
                  </td>
                  <td class="td-categories">
                    <div class="categories-cell">
                      <span v-for="cat in movie.categories" :key="cat" class="category-tag-small">{{ cat }}</span>
                    </div>
                  </td>
                  <td class="td-year">{{ movie.year || '-' }}</td>
                  <td class="td-duration">{{ formatDuration(movie.startDate, movie.endDate) }}</td>
                  <td class="td-rating">{{ movie.rating || '-' }}</td>
                  <td class="td-action">
                    <button
                      v-if="!movie.isScheduled"
                      class="btn-record-small"
                      :class="{
                        loading: freeboxStore.getRecordingState(movie.id) === 'loading',
                        success: freeboxStore.getRecordingState(movie.id) === 'success',
                        error: freeboxStore.getRecordingState(movie.id) === 'error'
                      }"
                      :disabled="freeboxStore.getRecordingState(movie.id) === 'loading' || freeboxStore.getRecordingState(movie.id) === 'success'"
                      @click="recordMovie(movie)"
                      title="Enregistrer sur Freebox"
                    >
                      <span v-if="freeboxStore.getRecordingState(movie.id) === 'loading'">⏳</span>
                      <span v-else-if="freeboxStore.getRecordingState(movie.id) === 'success'">✅</span>
                      <span v-else-if="freeboxStore.getRecordingState(movie.id) === 'error'">❌</span>
                      <span v-else>⏺️</span>
                    </button>
                    <span v-else class="already-scheduled-badge">✅</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </main>

    <footer>
      <p>Données XMLTV • Dernière mise à jour: {{ formatLastUpdated(moviesStore.lastUpdated) }}</p>
    </footer>

    <FreeboxModal :visible="showFreeboxModal" @close="showFreeboxModal = false" />
  </div>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  background: #0f0f0f;
  color: #ffffff;
}

header {
  background: linear-gradient(135deg, #e50914, #b20710);
  padding: 1.5rem 2rem;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

header h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: white;
}

.stats {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}

.stat {
  background: rgba(255, 255, 255, 0.15);
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  font-size: 0.95rem;
  color: white;
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  color: white;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.view-toggle {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  color: white;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s;
}

.view-toggle:hover {
  background: rgba(255, 255, 255, 0.3);
}

.freebox-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5rem 1.25rem;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.2s;
  color: white;
}

.freebox-status:hover {
  background: rgba(0, 0, 0, 0.5);
}

.freebox-status .indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f39c12;
}

.freebox-status.connected .indicator {
  background: #27ae60;
}

.freebox-status.error .indicator {
  background: #e74c3c;
}

main {
  width: 100%;
  max-width: 100%;
  margin: 0 auto;
  padding: 2rem 4rem;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 0.5rem;
  font-size: 1rem;
  color: #a0a0a0;
}

.error button {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: #e50914;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}

.error button:hover {
  background: #f40612;
}

.day-section {
  margin-bottom: 3rem;
}

.day-header {
  background: #1a1a1a;
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border-left: 4px solid #e50914;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.day-header h2 {
  font-size: 1.6rem;
  text-transform: capitalize;
  color: #ffffff;
}

.day-count {
  background: #e50914;
  padding: 0.4rem 1rem;
  border-radius: 15px;
  font-size: 0.9rem;
  color: white;
  font-weight: 500;
}

.channel-section {
  margin-bottom: 2.5rem;
  margin-left: 1.5rem;
}

.channel-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #333;
}

.channel-header h3 {
  font-size: 1.3rem;
  color: #a0a0a0;
}

.channel-count {
  background: #252525;
  padding: 0.3rem 0.75rem;
  border-radius: 10px;
  font-size: 0.8rem;
  color: #a0a0a0;
}

.movies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  width: 100%;
}

footer {
  text-align: center;
  padding: 2.5rem;
  color: #a0a0a0;
  font-size: 0.9rem;
  border-top: 1px solid #333;
  background: #0a0a0a;
}

/* Desktop large screens */
@media (min-width: 1400px) {
  main {
    padding: 2.5rem 5rem;
  }

  .movies-grid {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 2rem;
  }

  header h1 {
    font-size: 3rem;
  }

  .stats {
    gap: 1.5rem;
  }
}

/* Desktop medium screens */
@media (min-width: 1024px) and (max-width: 1399px) {
  main {
    padding: 2rem 3rem;
  }

  .movies-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  main {
    padding: 1.5rem 2rem;
  }

  header h1 {
    font-size: 2rem;
  }

  .movies-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }

  .channel-section {
    margin-left: 1rem;
  }
}

/* Mobile */
@media (max-width: 767px) {
  header {
    padding: 1rem;
  }

  header h1 {
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .stats {
    gap: 0.5rem;
  }

  .stat {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
  }

  .refresh-btn,
  .freebox-status {
    padding: 0.4rem 0.75rem;
    font-size: 0.8rem;
  }

  main {
    padding: 1rem;
  }

  .day-header {
    padding: 1rem;
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .day-header h2 {
    font-size: 1.2rem;
  }

  .channel-section {
    margin-left: 0;
  }

  .channel-header h3 {
    font-size: 1.1rem;
  }

  .movies-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  footer {
    padding: 1.5rem 1rem;
  }
}

/* Styles pour la vue tableau */
.table-container {
  overflow-x: auto;
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #333;
}

.movies-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.movies-table thead {
  background: #252525;
  position: sticky;
  top: 0;
}

.movies-table th {
  padding: 1rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #fff;
  border-bottom: 2px solid #333;
  white-space: nowrap;
}

.movies-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #2a2a2a;
  vertical-align: middle;
}

.movies-table tbody tr {
  transition: background 0.2s;
}

.movies-table tbody tr:hover {
  background: #252525;
}

.movies-table tbody tr.is-scheduled {
  background: rgba(39, 174, 96, 0.1);
}

.movies-table tbody tr.is-scheduled:hover {
  background: rgba(39, 174, 96, 0.2);
}

.th-status { width: 50px; text-align: center; }
.th-time { width: 60px; }
.th-channel { width: 120px; }
.th-title { min-width: 200px; }
.th-categories { min-width: 150px; }
.th-year { width: 60px; }
.th-duration { width: 70px; }
.th-rating { width: 60px; }
.th-action { width: 70px; text-align: center; }

.td-status { text-align: center; }
.td-time { color: #e50914; font-weight: 600; }
.td-channel { color: #888; }
.td-categories { }
.td-year { color: #888; }
.td-duration { color: #888; }
.td-rating { color: #27ae60; font-weight: 500; }
.td-action { text-align: center; }

.categories-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.category-tag-small {
  background: #333;
  color: #aaa;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.7rem;
  white-space: nowrap;
}

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.movie-name {
  color: #fff;
  font-weight: 500;
}

.movie-subtitle {
  color: #666;
  font-size: 0.8rem;
  font-style: italic;
}

.status-badge {
  font-size: 1rem;
}

.status-badge.scheduled {
  color: #27ae60;
}

.status-badge.not-scheduled {
  color: #555;
}

.btn-record-small {
  background: linear-gradient(135deg, #3498db, #2980b9);
  border: none;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-record-small:hover:not(:disabled) {
  background: linear-gradient(135deg, #2980b9, #1f6dad);
  transform: scale(1.1);
}

.btn-record-small:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-record-small.loading {
  background: #f39c12;
}

.btn-record-small.success {
  background: #27ae60;
}

.btn-record-small.error {
  background: #e74c3c;
}

.already-scheduled-badge {
  color: #27ae60;
  font-size: 1rem;
}

/* Responsive tableau */
@media (max-width: 1024px) {
  .movies-table {
    font-size: 0.8rem;
  }

  .movies-table th,
  .movies-table td {
    padding: 0.5rem;
  }

  .th-rating,
  .td-rating,
  .th-categories,
  .td-categories {
    display: none;
  }
}

@media (max-width: 767px) {
  .table-container {
    margin: 0 -1rem;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .movies-table {
    font-size: 0.75rem;
  }

  .th-year,
  .td-year,
  .th-duration,
  .td-duration {
    display: none;
  }

  .movie-subtitle {
    display: none;
  }
}
</style>

