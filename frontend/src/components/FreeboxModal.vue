<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFreeboxStore } from '@/stores/freebox'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const freeboxStore = useFreeboxStore()
const statusMessage = ref('Vérification...')
const showButton = ref(false)
const buttonText = ref('Autoriser')

onMounted(async () => {
  await checkStatus()
})

async function checkStatus() {
  statusMessage.value = 'Vérification...'
  showButton.value = false

  const status = await freeboxStore.checkStatus()

  if (status.connected) {
    statusMessage.value = '✅ Connecté! Vous pouvez programmer des enregistrements.'
  } else {
    statusMessage.value = '⚠️ Non connecté.\n\nCliquez sur "Autoriser" puis validez sur votre Freebox.'
    showButton.value = true
    buttonText.value = 'Autoriser'
  }
}

async function handleAction() {
  if (!freeboxStore.authPending) {
    statusMessage.value = 'Demande en cours...'
    const response = await freeboxStore.authorize()

    if (response.success) {
      statusMessage.value = '📺 Regardez votre Freebox!\n\nAppuyez sur ➡️ pour autoriser, puis cliquez "Vérifier".'
      buttonText.value = 'Vérifier'
    } else {
      statusMessage.value = `❌ ${response.message || 'Erreur'}`
    }
  } else {
    statusMessage.value = 'Vérification...'
    const response = await freeboxStore.checkAuthorizationStatus()

    if (response.status === 'granted') {
      statusMessage.value = '✅ Autorisé! Vous pouvez enregistrer.'
      showButton.value = false
      await checkStatus()
    } else if (response.status === 'pending') {
      statusMessage.value = '⏳ En attente...\nValidez sur la Freebox.'
    } else {
      statusMessage.value = `❌ ${response.message}`
      buttonText.value = 'Réessayer'
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <h2>📡 Connexion Freebox</h2>
        <p class="status-message">{{ statusMessage }}</p>
        <div class="modal-buttons">
          <button class="btn-secondary" @click="emit('close')">Fermer</button>
          <button v-if="showButton" class="btn-primary" @click="handleAction">
            {{ buttonText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: var(--color-background-soft);
  padding: 2rem;
  border-radius: 16px;
  max-width: 500px;
  width: 90%;
  text-align: center;
}

.modal-content h2 {
  margin-bottom: 1rem;
}

.status-message {
  color: var(--color-text-mute);
  margin-bottom: 1.5rem;
  line-height: 1.8;
  white-space: pre-line;
}

.modal-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.modal-buttons button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.btn-primary {
  background: var(--color-accent);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-secondary {
  background: var(--color-background-mute);
  color: var(--color-text);
}
</style>

