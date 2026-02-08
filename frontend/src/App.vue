<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template>

<style>
:root {
  --color-background: #0f0f0f;
  --color-background-soft: #1a1a1a;
  --color-background-mute: #252525;
  --color-border: #333;
  --color-text: #ffffff;
  --color-text-mute: #a0a0a0;
  --color-accent: #e50914;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-background);
  color: var(--color-text);
  line-height: 1.6;
}
</style>
