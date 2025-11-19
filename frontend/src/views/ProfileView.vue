<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const usernameParam = route.params.username;

// --- ESTADOS ---
const isLoading = ref(true);
const profile = ref<any>(null);

// Feed
const posts = ref<any[]>([]);
const newPostContent = ref('');
const isPosting = ref(false);

// Edição
const isEditing = ref(false);
const isSaving = ref(false);
const editForm = reactive({ displayName: '', bio: '', avatarUrl: '', bannerUrl: '' });

// --- INICIALIZAÇÃO ---
onMounted(async () => {
  await fetchProfile();
  await fetchPosts();
});

// 1. PERFIL
async function fetchProfile() {
  try {
    const response = await api.get(`/profiles/${usernameParam}`);
    profile.value = response.data;
    
    editForm.displayName = response.data.displayName || '';
    editForm.bio = response.data.bio || '';
    editForm.avatarUrl = response.data.avatarUrl || '';
    editForm.bannerUrl = response.data.bannerUrl || '';
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }
}

// 2. FEED
async function fetchPosts() {
  try {
    const response = await api.get('/posts');
    posts.value = response.data.map((p: any) => ({
      ...p,
      likesCount: p._count?.interactions || 0,
      hasLiked: p.interactions?.some((i: any) => i.userId === profile.value.id) || false
    }));
  } catch (err) {
    console.error("Erro ao carregar feed:", err);
  }
}

// 3. PUBLICAR
async function handlePublish() {
  if (!newPostContent.value.trim()) return; 
  isPosting.value = true;
  try {
    await api.post('/posts', {
      userId: profile.value.id,
      content: newPostContent.value,
      type: 'TEXT'
    });
    newPostContent.value = '';
    await fetchPosts();
    await fetchProfile(); // Atualiza XP
  } catch (err) {
    alert('Erro ao publicar post.');
  } finally {
    isPosting.value = false;
  }
}

// 4. DAR RESPECT (LIKE)
async function handleRespect(post: any) {
  const wasLiked = post.hasLiked;
  post.hasLiked = !wasLiked;
  post.likesCount += wasLiked ? -1 : 1;

  try {
    await api.post(`/posts/${post.id}/respect`, { userId: profile.value.id });
  } catch (err) {
    post.hasLiked = wasLiked;
    post.likesCount += wasLiked ? 1 : -1;
  }
}

// 5. SALVAR PERFIL
async function handleSave() {
  isSaving.value = true;
  try {
    await api.patch(`/profiles/${usernameParam}`, { ...editForm });
    isEditing.value = false;
    await fetchProfile();
  } catch (err: any) {
    alert('Erro ao salvar.');
  } finally {
    isSaving.value = false;
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', { 
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
  }).format(date);
}
</script>

<template>
  <div class="min-h-screen bg-[#050505] text-white font-sans pb-20 relative">
    
    <div class="h-[300px] w-full bg-[#0A0A0A] relative overflow-hidden group">
      <img v-if="profile?.bannerUrl" :src="profile.bannerUrl" class="w-full h-full object-cover opacity-60 transition-opacity duration-500" @error="profile.bannerUrl = null" />
      <div v-else class="w-full h-full absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-green-900/40 opacity-80">
        <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(#ffffff 1px, transparent 1px); background-size: 20px 20px;"></div>
      </div>
      
      <div class="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent"></div>
      
      <div class="absolute top-6 right-6 flex gap-3">
        <button 
          @click="$router.push('/arena')"
          class="bg-black/50 hover:bg-yellow-500 hover:text-black text-yellow-400 px-4 py-2 rounded-full text-sm font-bold border border-yellow-500/20 backdrop-blur transition-all flex items-center gap-2"
        >
          <span>🏆</span> ARENA
        </button>

        <button 
          @click="isEditing = true"
          class="bg-black/50 hover:bg-[#00FF94] hover:text-black text-white px-4 py-2 rounded-full text-sm font-bold border border-white/20 backdrop-blur transition-all"
        >
          ✎ EDITAR PERFIL
        </button>
      </div>
    </div>

    <div v-if="!isLoading" class="max-w-7xl mx-auto px-6 -mt-24 relative flex flex-col md:flex-row items-end gap-6">
      <div class="w-40 h-40 bg-[#1A1A1A] rounded-2xl border-4 border-[#050505] shadow-2xl overflow-hidden relative flex-shrink-0">
         <img :src="profile?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${usernameParam}`" class="w-full h-full object-cover bg-gray-800" />
      </div>
      
      <div class="flex-1 mb-2">
        <h1 class="text-4xl font-bold italic tracking-tighter text-white">{{ profile?.displayName || usernameParam }}</h1>
        <p class="text-gray-400 text-lg mt-1 max-w-2xl">{{ profile?.bio || 'Gamer sem descrição.' }}</p>
      </div>
      
      <div class="mb-4 flex gap-4">
         <div class="bg-[#1A1A1A] px-4 py-2 rounded border border-gray-800 text-center min-w-[80px]">
            <span class="text-[#00FF94] font-bold text-xl">{{ profile?.energy }}%</span>
            <span class="text-[10px] text-gray-500 block uppercase tracking-wider">Energia</span>
         </div>
         <div class="bg-[#1A1A1A] px-4 py-2 rounded border border-gray-800 text-center min-w-[80px]">
            <span class="text-white font-bold text-xl">{{ profile?.xp }}</span>
            <span class="text-[10px] text-gray-500 block uppercase tracking-wider">XP Total</span>
         </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      <div class="lg:col-span-4 space-y-6">
        <div class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-6">
          <h3 class="text-gray-500 uppercase text-xs font-bold tracking-widest mb-4">Main Character</h3>
          <div class="aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden relative group cursor-pointer">
             <img src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yone_0.jpg" class="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"/>
             <div class="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black to-transparent">
                <p class="font-bold text-white">Yone</p>
             </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-8 space-y-6">
         <div class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-4 flex gap-4 items-center shadow-lg">
            <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
              <img :src="profile?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${usernameParam}`" class="w-full h-full object-cover"/>
            </div>
            <input v-model="newPostContent" @keyup.enter="handlePublish" type="text" placeholder="O que você jogou hoje?" class="bg-transparent flex-1 outline-none text-white placeholder-gray-600 h-full" :disabled="isPosting"/>
            <button @click="handlePublish" class="text-[#00FF94] hover:text-white transition-colors px-2">➤</button>
         </div>

         <div v-if="posts.length === 0" class="text-center py-10 border border-dashed border-gray-800 rounded-xl">
           <p class="text-gray-500 text-sm">Timeline vazia.</p>
         </div>

         <div v-for="post in posts" :key="post.id" class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all">
            <div class="flex items-center gap-3 mb-4">
               <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border border-gray-700">
                 <img :src="post.user.profile?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${post.user.username}`" class="w-full h-full object-cover"/>
               </div>
               <div>
                  <p class="font-bold text-sm text-white flex items-center gap-2">
                    {{ post.user.profile?.displayName || post.user.username }}
                    <span class="text-gray-500 font-normal text-xs">@{{ post.user.username }}</span>
                  </p>
                  <p class="text-xs text-gray-600">{{ formatDate(post.createdAt) }}</p>
               </div>
            </div>
            <p class="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">{{ post.contentText }}</p>
            
            <div class="mt-4 pt-4 border-t border-gray-900 flex gap-6 text-gray-500 text-xs font-bold uppercase tracking-wider">
               <button @click="handleRespect(post)" class="flex items-center gap-2 transition-all active:scale-95" :class="post.hasLiked ? 'text-[#00FF94]' : 'hover:text-gray-300'">
                 <span class="text-lg">⚡</span> <span>Respect {{ post.likesCount > 0 ? `(${post.likesCount})` : '' }}</span>
               </button>
               <button class="hover:text-white transition-colors flex items-center gap-2"><span class="text-lg">💬</span> Comentar</button>
            </div>
         </div>
      </div>
    </div>

    <div v-if="isEditing" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div class="bg-[#0A0A0A] border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
        <h2 class="text-2xl font-bold mb-6 italic">EDITAR <span class="text-[#00FF94]">IDENTIDADE</span></h2>
        <form @submit.prevent="handleSave" class="space-y-4">
          <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Nome</label><input v-model="editForm.displayName" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none"/></div>
          <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Bio</label><textarea v-model="editForm.bio" rows="3" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none resize-none"></textarea></div>
          <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Avatar</label><input v-model="editForm.avatarUrl" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none"/></div>
          <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Banner</label><input v-model="editForm.bannerUrl" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none"/></div>
          <div class="flex gap-3 mt-6 pt-4 border-t border-gray-800">
            <button type="button" @click="isEditing = false" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded">CANCELAR</button>
            <button type="submit" :disabled="isSaving" class="flex-1 bg-[#00FF94] hover:bg-[#00cc7a] text-black font-bold py-3 rounded">{{ isSaving ? 'SALVANDO...' : 'SALVAR' }}</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>