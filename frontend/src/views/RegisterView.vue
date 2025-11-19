<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ref } from 'vue';
import { api } from '../api';

const router = useRouter();
const username = ref('');
const email = ref('');
const password = ref('');
const isLoading = ref(false);
const feedbackMessage = ref('');

async function handleRegister() {
    isLoading.value = true;
    feedbackMessage.value = '';

    try {
        const response = await api.post('/users', {
            username: username.value,
            email: email.value,
            password: password.value
        });

        feedbackMessage.value = `Bem-vindo, ${response.data.username}! Identidade forjada.`;

        // Aguarda 1 segundo para o usuário ler a mensagem e redireciona
        setTimeout(() => {
            router.push(`/profile/${response.data.username}`);
        }, 1500);
    } catch (error: any) {
        feedbackMessage.value = error.response?.data?.message || 'Erro ao conectar com o servidor.';
    } finally {
        isLoading.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-[#050505] flex items-center justify-center text-white font-sans">

        <div class="w-full max-w-md p-8">
            <h1 class="text-4xl font-bold mb-2 tracking-tighter italic">
                CLUTCH<span class="text-[#00FF94]">/</span>
            </h1>
            <p class="text-gray-500 mb-8">Reveal Your True Self.</p>

            <form @submit.prevent="handleRegister" class="space-y-6">

                <div>
                    <label class="block text-sm text-gray-400 mb-2">Codename (Usuário)</label>
                    <input v-model="username" type="text"
                        class="w-full bg-[#1A1A1A] border border-gray-800 rounded p-3 text-white focus:border-[#00FF94] focus:outline-none transition-colors"
                        placeholder="Ex: FakerGod" />
                </div>

                <div>
                    <label class="block text-sm text-gray-400 mb-2">Canal Seguro (Email)</label>
                    <input v-model="email" type="email"
                        class="w-full bg-[#1A1A1A] border border-gray-800 rounded p-3 text-white focus:border-[#00FF94] focus:outline-none transition-colors"
                        placeholder="voce@exemplo.com" />
                </div>

                <div>
                    <label class="block text-sm text-gray-400 mb-2">Chave de Acesso</label>
                    <input v-model="password" type="password"
                        class="w-full bg-[#1A1A1A] border border-gray-800 rounded p-3 text-white focus:border-[#00FF94] focus:outline-none transition-colors"
                        placeholder="••••••••" />
                </div>

                <button type="submit" :disabled="isLoading"
                    class="w-full bg-[#00FF94] text-black font-bold py-3 rounded hover:bg-[#00cc7a] transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    {{ isLoading ? 'FORJANDO...' : 'INICIAR SESSÃO' }}
                </button>

                <p v-if="feedbackMessage" class="text-center text-sm mt-4 font-mono"
                    :class="feedbackMessage.includes('Erro') ? 'text-red-500' : 'text-[#00FF94]'">
                    {{ feedbackMessage }}
                </p>

            </form>
        </div>
    </div>
</template>