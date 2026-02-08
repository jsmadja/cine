<script setup lang="ts">
import { computed } from 'vue'
import type { Movie } from '@/types'
import { useFreeboxStore } from '@/stores/freebox'
import dayjs from 'dayjs'

const props = defineProps<{
  movie: Movie
}>()

const freeboxStore = useFreeboxStore()

function formatTime(date: string) {
  return dayjs(date).format('HH:mm')
}

function formatDuration(start: string, end: string) {
  const minutes = dayjs(end).diff(dayjs(start), 'minute')
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins} min`
}

async function handleRecord() {
  const start = Math.floor(new Date(props.movie.startDate).getTime() / 1000)
  const end = Math.floor(new Date(props.movie.endDate).getTime() / 1000)

  await freeboxStore.recordMovie(
    props.movie.id,
    props.movie.channelId,
    props.movie.channel,
    start,
    end,
    props.movie.name,
  )
}

const recordingState = computed(() => freeboxStore.getRecordingState(props.movie.id))
</script>

<template>
  <article class="movie-card" :class="{ 'is-scheduled': movie.isScheduled }">
    <div class="poster-container">
      <img
        v-if="movie.icon"
        :src="movie.icon"
        :alt="movie.name"
        class="movie-poster"
        loading="lazy"
        @error="($event.target as HTMLImageElement).outerHTML = '<div class=\'movie-poster placeholder\'>🎬</div>'"
      />
      <div v-else class="movie-poster placeholder">🎬</div>
      <div v-if="movie.isScheduled" class="scheduled-badge">
        ✅ Programmé
      </div>
    </div>

    <div class="movie-content">
      <h4 class="movie-title">
        {{ movie.name }}
        <span v-if="movie.year" class="movie-year">({{ movie.year }})</span>
      </h4>

      <p v-if="movie.subtitle" class="movie-subtitle">{{ movie.subtitle }}</p>

      <div class="movie-meta">
        <span class="movie-time">🕐 {{ formatTime(movie.startDate) }}</span>
        <span class="movie-duration">{{ formatDuration(movie.startDate, movie.endDate) }}</span>
        <span v-if="movie.rating" class="movie-rating">👥 {{ movie.rating }}</span>
      </div>

      <div class="movie-categories">
        <span v-for="cat in movie.categories" :key="cat" class="category-tag">
          {{ cat }}
        </span>
      </div>

      <p v-if="movie.country" class="movie-info">🌍 {{ movie.country }}</p>

      <p v-if="movie.directors?.length" class="movie-info">
        <strong>Réalisateur:</strong> {{ movie.directors.join(', ') }}
      </p>

      <p v-if="movie.actors?.length" class="movie-info">
        <strong>Avec:</strong> {{ movie.actors.slice(0, 4).join(', ') }}
        <span v-if="movie.actors.length > 4">...</span>
      </p>

      <p v-if="movie.description" class="movie-description">
        {{ movie.description }}
      </p>

      <button
        v-if="!movie.isScheduled"
        class="btn-record"
        :class="{
          recording: recordingState === 'success',
          error: recordingState === 'error',
        }"
        :disabled="recordingState === 'loading' || recordingState === 'success'"
        @click="handleRecord"
      >
        <span v-if="recordingState === 'idle'">⏺️ Enregistrer sur Freebox</span>
        <span v-else-if="recordingState === 'loading'">⏳ Programmation...</span>
        <span v-else-if="recordingState === 'success'">✅ Programmé!</span>
        <span v-else-if="recordingState === 'error'">❌ Erreur</span>
      </button>
      <div v-else class="already-scheduled">
        ✅ Déjà programmé sur Freebox
      </div>
    </div>
  </article>
</template>

<style scoped>
.movie-card {
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #333;
  position: relative;
}

.movie-card.is-scheduled {
  border-color: #27ae60;
}

.movie-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  border-color: #e50914;
}

.movie-card.is-scheduled:hover {
  border-color: #27ae60;
}

.poster-container {
  position: relative;
}

.scheduled-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: linear-gradient(135deg, #27ae60, #1e8449);
  color: white;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.movie-poster {
  width: 100%;
  height: 200px;
  object-fit: cover;
  background: #252525;
}

.movie-poster.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  color: #666;
}

.movie-content {
  padding: 1.25rem;
}

.movie-title {
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: #ffffff;
  line-height: 1.3;
}

.movie-year {
  color: #e50914;
  font-weight: 500;
}

.movie-subtitle {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 0.75rem;
  font-style: italic;
}

.movie-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.movie-time {
  background: #e50914;
  color: white;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.movie-duration,
.movie-rating {
  background: #333;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #aaa;
}

.movie-rating {
  background: #2d5a27;
  color: white;
}

.movie-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.category-tag {
  background: #333;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #999;
}

.movie-info {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 0.5rem;
  line-height: 1.4;
}

.movie-info strong {
  color: #ccc;
}

.movie-description {
  font-size: 0.9rem;
  color: #777;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
  margin-top: 0.75rem;
}

.btn-record {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-record:hover:not(:disabled) {
  background: linear-gradient(135deg, #2980b9, #1f6dad);
  transform: scale(1.02);
}

.btn-record:disabled {
  cursor: not-allowed;
  transform: none;
  opacity: 0.7;
}

.btn-record.recording {
  background: linear-gradient(135deg, #27ae60, #1e8449);
}

.btn-record.error {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

.already-scheduled {
  width: 100%;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #27ae60, #1e8449);
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: center;
}

/* Responsive adjustments */
@media (min-width: 1400px) {
  .movie-poster {
    height: 220px;
  }

  .movie-content {
    padding: 1.5rem;
  }

  .movie-title {
    font-size: 1.25rem;
  }
}

@media (max-width: 767px) {
  .movie-poster {
    height: 180px;
  }

  .movie-content {
    padding: 1rem;
  }

  .movie-title {
    font-size: 1.05rem;
  }

  .btn-record {
    padding: 0.65rem 1rem;
    font-size: 0.85rem;
  }
}
</style>


