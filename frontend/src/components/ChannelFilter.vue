<script setup lang="ts">
import { ref } from 'vue'
import { useMoviesStore } from '@/stores/movies'

const moviesStore = useMoviesStore()
const isOpen = ref(false)

function togglePanel() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="channel-filter">
    <button class="filter-toggle" @click="togglePanel">
      📺 Chaînes
      <span v-if="moviesStore.hiddenCount > 0" class="hidden-badge">
        {{ moviesStore.hiddenCount }} masquée(s)
      </span>
      <span class="arrow" :class="{ open: isOpen }">▼</span>
    </button>

    <div v-if="isOpen" class="filter-panel">
      <div class="filter-header">
        <h3>Filtrer par chaîne</h3>
        <div class="filter-actions">
          <button class="btn-small" @click="moviesStore.showAllChannels()">
            ✅ Tout afficher
          </button>
          <button class="btn-small" @click="moviesStore.hideAllChannels()">
            ❌ Tout masquer
          </button>
        </div>
      </div>

      <div class="channels-list">
        <label
          v-for="channel in moviesStore.availableChannels"
          :key="channel.name"
          class="channel-item"
          :class="{ hidden: !moviesStore.isChannelVisible(channel.name) }"
        >
          <input
            type="checkbox"
            :checked="moviesStore.isChannelVisible(channel.name)"
            @change="moviesStore.toggleChannelVisibility(channel.name)"
          />
          <span class="channel-name">{{ channel.name }}</span>
          <span class="channel-count">{{ channel.count }} film(s)</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.channel-filter {
  position: relative;
}

.filter-toggle {
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

.filter-toggle:hover {
  background: rgba(255, 255, 255, 0.25);
}

.hidden-badge {
  background: #e74c3c;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
}

.arrow {
  font-size: 0.7rem;
  transition: transform 0.2s;
}

.arrow.open {
  transform: rotate(180deg);
}

.filter-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1rem;
  min-width: 320px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #333;
}

.filter-header h3 {
  font-size: 1rem;
  color: #fff;
  margin: 0;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-small {
  background: #333;
  border: none;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  color: #fff;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-small:hover {
  background: #444;
}

.channels-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.channel-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.channel-item:hover {
  background: #252525;
}

.channel-item.hidden {
  opacity: 0.5;
}

.channel-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #e50914;
}

.channel-name {
  flex: 1;
  color: #fff;
  font-size: 0.9rem;
}

.channel-count {
  color: #888;
  font-size: 0.8rem;
  background: #333;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

/* Responsive */
@media (max-width: 767px) {
  .filter-panel {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 12px 12px 0 0;
    max-height: 60vh;
    min-width: auto;
  }
}
</style>

