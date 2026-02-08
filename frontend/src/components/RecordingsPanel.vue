<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useFreeboxStore } from '@/stores/freebox'
import dayjs from 'dayjs'

const freeboxStore = useFreeboxStore()
const isOpen = ref(false)

function togglePanel() {
  isOpen.value = !isOpen.value
  if (isOpen.value && freeboxStore.connected) {
    freeboxStore.fetchRecordings()
  }
}

function formatDateTime(timestamp: number) {
  return dayjs.unix(timestamp).format('DD/MM/YYYY HH:mm')
}

function formatDuration(start: number, end: number) {
  const minutes = Math.round((end - start) / 60)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins}min`
}

// Rafraîchir les enregistrements quand la connexion change
watch(() => freeboxStore.connected, (connected) => {
  if (connected && isOpen.value) {
    freeboxStore.fetchRecordings()
  }
})

onMounted(() => {
  if (freeboxStore.connected) {
    freeboxStore.fetchRecordings()
  }
})
</script>

<template>
  <div class="recordings-panel">
    <button class="panel-toggle" @click="togglePanel">
      📼 Enregistrements
      <span v-if="freeboxStore.sortedRecordings.length > 0" class="recordings-count">
        {{ freeboxStore.sortedRecordings.length }}
      </span>
      <span class="arrow" :class="{ open: isOpen }">▼</span>
    </button>

    <div v-if="isOpen" class="panel-content">
      <div class="panel-header">
        <h3>📼 Enregistrements programmés</h3>
        <button class="btn-refresh" @click="freeboxStore.fetchRecordings()" :disabled="freeboxStore.recordingsLoading">
          {{ freeboxStore.recordingsLoading ? '⏳' : '🔄' }}
        </button>
      </div>

      <div v-if="!freeboxStore.connected" class="panel-message">
        <p>❌ Freebox non connectée</p>
      </div>

      <div v-else-if="freeboxStore.recordingsLoading" class="panel-message">
        <p>⏳ Chargement...</p>
      </div>

      <div v-else-if="freeboxStore.sortedRecordings.length === 0" class="panel-message">
        <p>📭 Aucun enregistrement programmé</p>
      </div>

      <div v-else class="recordings-list">
        <div
          v-for="recording in freeboxStore.sortedRecordings"
          :key="recording.id"
          class="recording-item"
        >
          <div class="recording-info">
            <span class="recording-name">{{ recording.name }}</span>
            <div class="recording-details">
              <span class="recording-date">📅 {{ formatDateTime(recording.start) }}</span>
              <span class="recording-duration">⏱️ {{ formatDuration(recording.start, recording.end) }}</span>
              <span v-if="recording.channel_name" class="recording-channel">📺 {{ recording.channel_name }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recordings-panel {
  position: relative;
}

.panel-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  color: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.panel-toggle:hover {
  background: rgba(255, 255, 255, 0.25);
}

.recordings-count {
  background: #27ae60;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}

.arrow {
  font-size: 0.7rem;
  transition: transform 0.2s;
}

.arrow.open {
  transform: rotate(180deg);
}

.panel-content {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1rem;
  min-width: 380px;
  max-width: 450px;
  max-height: 500px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #333;
}

.panel-header h3 {
  font-size: 1rem;
  color: #fff;
  margin: 0;
}

.btn-refresh {
  background: #333;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: #444;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.panel-message {
  text-align: center;
  padding: 2rem 1rem;
  color: #888;
}

.recordings-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recording-item {
  background: #252525;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  border-left: 3px solid #27ae60;
}

.recording-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recording-name {
  color: #fff;
  font-weight: 500;
  font-size: 0.95rem;
}

.recording-details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: #888;
}

.recording-date {
  color: #e50914;
}

.recording-duration {
  color: #888;
}

.recording-channel {
  color: #888;
}

/* Responsive */
@media (max-width: 767px) {
  .panel-content {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 12px 12px 0 0;
    max-height: 60vh;
    min-width: auto;
    max-width: none;
  }

  .recording-details {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>

