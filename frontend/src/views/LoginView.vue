<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const email = ref('');
const password = ref('');
const isLoading = ref(false);
const error = ref('');

async function handleLogin() {
  isLoading.value = true;
  error.value = '';

  try {
    const response = await api.post('/login', {
      email: email.value,
      password: password.value
    });

    // SUCESSO!
    // Guardamos o ID no "bolso" do navegador para usar depois (em likes, etc)
    localStorage.setItem('clutch_user', JSON.stringify(response.data));

    // Redireciona para o perfil
    router.push(`/profile/${response.data.username}`);

  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao conectar.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#050505] flex items-center justify-center text-white font-sans relative overflow-hidden">
    
    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00FF94] to-transparent opacity-50"></div>

    <div class="w-full max-w-md p-8 z-10">
      <h1 class="text-5xl font-black mb-2 tracking-tighter italic text-center">
        CLUTCH<span class="text-[#00FF94]">/</span>
      </h1>
      <p class="text-gray-500 mb-10 text-center uppercase tracking-widest text-xs font-bold">Login do Sistema</p>

      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label class="block text-xs text-gray-500 font-bold mb-2 uppercase">Email</label>
          <input v-model="email" type="email" class="w-full bg-[#1A1A1A] border border-gray-800 rounded p-4 text-white focus:border-[#00FF94] outline-none transition-colors placeholder-gray-700" placeholder="seu@email.com" />
        </div>

        <div>
          <label class="block text-xs text-gray-500 font-bold mb-2 uppercase">Senha</label>
          <input v-model="password" type="password" class="w-full bg-[#1A1A1A] border border-gray-800 rounded p-4 text-white focus:border-[#00FF94] outline-none transition-colors placeholder-gray-700" placeholder="••••••" />
        </div>

        <button type="submit" :disabled="isLoading" class="w-full bg-[#00FF94] text-black font-bold py-4 rounded hover:bg-[#00cc7a] transition-all active:scale-95 disabled:opacity-50 uppercase tracking-wider text-sm">
          {{ isLoading ? 'Acessando Mainframe...' : 'Entrar' }}
        </button>

        <p v-if="error" class="text-red-500 text-center text-sm bg-red-500/10 py-2 rounded border border-red-500/20">{{ error }}</p>
      </form>

      <div class="mt-8 text-center text-sm text-gray-500">
        Ainda não tem identidade? 
        <router-link to="/" class="text-[#00FF94] hover:underline font-bold cursor-pointer">Criar Conta</router-link>
      </div>
    </div>
  </div>
</template>