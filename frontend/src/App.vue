<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <button class="bg-red-500 text-white p-4 rounded-xl hover:bg-red-700">
    TESTE CLUTCH v4
  </button>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
