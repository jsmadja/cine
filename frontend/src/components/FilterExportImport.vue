<script setup lang="ts">
import { ref } from 'vue'
import { useMoviesStore } from '@/stores/movies'

const moviesStore = useMoviesStore()
const fileInput = ref<HTMLInputElement | null>(null)
const importMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

function exportFilters() {
  const json = moviesStore.exportFilters()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `cine-filters-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function triggerImport() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    const result = moviesStore.importFilters(content)

    importMessage.value = {
      type: result.success ? 'success' : 'error',
      text: result.message
    }

    // Effacer le message après 3 secondes
    setTimeout(() => {
      importMessage.value = null
    }, 3000)
  }

  reader.readAsText(file)

  // Reset input pour permettre de réimporter le même fichier
  input.value = ''
}
</script>

<template>
  <div class="filter-export-import">
    <button class="btn-action" @click="exportFilters" title="Exporter les filtres">
      📤 Exporter
    </button>
    <button class="btn-action" @click="triggerImport" title="Importer les filtres">
      📥 Importer
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileSelect"
    />
    <div v-if="importMessage" class="import-message" :class="importMessage.type">
      {{ importMessage.text }}
    </div>
  </div>
</template>

<style scoped>
.filter-export-import {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  padding: 0.5rem 0.75rem;
  border-radius: 20px;
  color: white;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.btn-action:hover {
  background: rgba(255, 255, 255, 0.25);
}

.import-message {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  white-space: nowrap;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.import-message.success {
  background: #27ae60;
  color: white;
}

.import-message.error {
  background: #e74c3c;
  color: white;
}
</style>

