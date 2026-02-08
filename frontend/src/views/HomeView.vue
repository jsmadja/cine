<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useMoviesStore } from '@/stores/movies'
import { useFreeboxStore } from '@/stores/freebox'
import MovieCard from '@/components/MovieCard.vue'
import FreeboxModal from '@/components/FreeboxModal.vue'
import dayjs from 'dayjs'

const moviesStore = useMoviesStore()
const freeboxStore = useFreeboxStore()

const showFreeboxModal = ref(false)
const refreshing = ref(false)

let statusInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
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

function formatLastUpdated(date: Date | null) {
  if (!date) return 'Jamais'
  return dayjs(date).format('DD/MM/YYYY HH:mm')
}
</script>

<template>
  <div class="home-view">
    <header>
      <div class="stats">
        <span class="stat">📺 {{ moviesStore.totalMovies }} film(s)</span>
        <span class="stat">📅 {{ moviesStore.totalDays }} jour(s)</span>
        <span class="stat">🔄 {{ formatLastUpdated(moviesStore.lastUpdated) }}</span>
        <button class="refresh-btn" :disabled="refreshing" @click="handleRefresh">
          {{ refreshing ? '⏳' : '🔄' }} Rafraîchir
        </button>
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

      <template v-else>
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

.freebox-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0;
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
</style>

