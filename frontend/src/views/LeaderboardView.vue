<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';

const ranking = ref<any[]>([]);
const isLoading = ref(true);

onMounted(async () => {
  try {
    const response = await api.get('/leaderboard');
    ranking.value = response.data;
  } catch (err) {
    console.error("Erro ao carregar arena", err);
  } finally {
    isLoading.value = false;
  }
});

// Função para cor do Rank
function getRankColor(rank: number) {
  if (rank === 1) return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10'; // Ouro
  if (rank === 2) return 'text-gray-300 border-gray-400/50 bg-gray-400/10';       // Prata
  if (rank === 3) return 'text-orange-400 border-orange-500/50 bg-orange-500/10'; // Bronze
  return 'text-gray-500 border-gray-800 bg-[#0A0A0A]';                            // Resto
}
</script>

<template>
  <div class="min-h-screen bg-[#050505] text-white font-sans p-6 flex flex-col items-center">
    
    <div class="text-center mb-12 mt-8">
      <h1 class="text-5xl font-black italic tracking-tighter mb-2">
        ARENA <span class="text-[#00FF94]">GLOBAL</span>
      </h1>
      <p class="text-gray-500 uppercase tracking-widest text-sm">Os maiores jogadores da história</p>
    </div>

    <div class="w-full max-w-3xl space-y-4">
      
      <div v-if="isLoading" class="text-center text-[#00FF94] animate-pulse">
        CALCULANDO ELO...
      </div>

      <div 
        v-for="player in ranking" 
        :key="player.username"
        class="flex items-center p-4 rounded-xl border-2 transition-all hover:scale-105 cursor-pointer relative overflow-hidden group"
        :class="getRankColor(player.rank)"
        @click="$router.push(`/profile/${player.username}`)"
      >
        <div class="font-black text-4xl italic w-16 text-center opacity-80">
          #{{ player.rank }}
        </div>

        <div class="w-14 h-14 rounded-full border-2 border-white/10 overflow-hidden mx-4">
          <img 
            :src="player.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${player.username}`" 
            class="w-full h-full object-cover"
          />
        </div>

        <div class="flex-1">
          <h3 class="font-bold text-lg flex items-center gap-2">
            {{ player.displayName }}
            <span v-if="player.rank === 1" class="text-xs bg-yellow-500 text-black px-2 rounded">KING</span>
          </h3>
          <p class="text-xs opacity-60 font-mono">@{{ player.username }}</p>
        </div>

        <div class="text-right px-4">
          <p class="text-xs uppercase font-bold opacity-50">XP Total</p>
          <p class="text-2xl font-black tracking-tighter">{{ player.xp }}</p>
        </div>

        <div class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      </div>

    </div>

    <button 
      @click="$router.back()" 
      class="mt-12 text-gray-500 hover:text-white transition-colors uppercase text-xs font-bold"
    >
      ← Voltar para o Perfil
    </button>

  </div>
</template>