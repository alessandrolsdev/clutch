<script setup lang="ts">
// =============================================================================
// 1. IMPORTAÇÕES
// =============================================================================
import { ref, onMounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';

const route = useRoute();
const router = useRouter();

// =============================================================================
// 2. ESTADO (VARIÁVEIS REATIVAS)
// =============================================================================

// --- DADOS GERAIS ---
const isLoading = ref(true);
const usernameParam = ref(route.params.username as string);
const profile = ref<any>(null);
const currentUser = ref<any>(null);
const integrations = ref<any[]>([]); 
const steamStats = ref<any>(null);

// --- FEED & POSTS ---
const posts = ref<any[]>([]);
const newPostContent = ref('');
const isPosting = ref(false);
// Controle de comentários
const openComments = reactive<Record<string, boolean>>({});
const postComments = reactive<Record<string, any[]>>({});
const commentInputs = reactive<Record<string, string>>({});

// --- DIÁRIO (QUEST LOG) ---
const showDiary = ref(false); // Toggle: Feed vs Diário
const gameLogs = ref<any[]>([]);
const isLoggingGame = ref(false); // Modal Diário
const gameForm = reactive({ gameTitle: '', platform: 'PC', hoursPlayed: 0, rating: 5, emotion: 'EPIC', review: '' });

// --- EDIÇÃO DE PERFIL ---
const isEditing = ref(false); // Modal Edição
const isSaving = ref(false);
const editTab = ref('IDENTITY'); 
const editForm = reactive({ displayName: '', bio: '', avatarUrl: '', bannerUrl: '' });
const integrationForm = reactive({ steamId: '', psnId: '', xboxId: '', epicId: '' }); 

// --- DETALHES DE JOGO (STEAM) ---
const isViewingGame = ref(false); // Modal Conquistas
const selectedGameDetails = ref<any>(null);
const isLoadingDetails = ref(false);

// --- UPLOAD DE CONQUISTA (IA/OCR) ---
const showAchievementUpload = ref(false); // Modal Upload
const selectedImage = ref<File | null>(null);
const previewImageUrl = ref<string | null>(null);
const uploadGameTitle = ref('');
const isUploadingAchievement = ref(false);

// =============================================================================
// 3. CICLO DE VIDA & WATCHERS
// =============================================================================

// Detecta mudança de rota (Navegação entre perfis)
watch(() => route.params.username, async (newUsername) => {
  if (newUsername) {
    usernameParam.value = newUsername as string;
    isLoading.value = true;
    await initData();
    isLoading.value = false;
  }
});

// Inicialização
onMounted(async () => {
  const stored = localStorage.getItem('clutch_user');
  if (stored) currentUser.value = JSON.parse(stored);
  else router.push('/');
  
  await initData();
  isLoading.value = false;
});

async function initData() {
  await fetchProfile();
  await fetchPosts();
  await fetchDiary();
}

// =============================================================================
// 4. BUSCA DE DADOS (API GET)
// =============================================================================

async function fetchProfile() {
  try {
    const response = await api.get(`/profiles/${usernameParam.value}`);
    profile.value = response.data;
    integrations.value = response.data.integrations || [];

    // Extrai Metadata Steam se existir
    const steamLink = integrations.value.find((i: any) => i.provider === 'STEAM');
    if (steamLink && steamLink.metadata) {
        steamStats.value = steamLink.metadata;
    } else {
        steamStats.value = null;
    }

    // Se for o dono do perfil, preenche os forms de edição
    if (currentUser.value?.id === profile.value.id) {
      editForm.displayName = response.data.displayName || '';
      editForm.bio = response.data.bio || '';
      editForm.avatarUrl = response.data.avatarUrl || '';
      editForm.bannerUrl = response.data.bannerUrl || '';
      
      const steam = integrations.value.find((i: any) => i.provider === 'STEAM');
      const psn = integrations.value.find((i: any) => i.provider === 'PSN');
      const xbox = integrations.value.find((i: any) => i.provider === 'XBOX');
      const epic = integrations.value.find((i: any) => i.provider === 'EPIC');
      
      integrationForm.steamId = steam ? steam.externalId : '';
      integrationForm.psnId = psn ? psn.externalId : '';
      integrationForm.xboxId = xbox ? xbox.externalId : '';
      integrationForm.epicId = epic ? epic.externalId : '';
    }
  } catch (err) { console.error(err); }
}

async function fetchPosts() {
  try {
    const response = await api.get('/posts');
    posts.value = response.data.map((p: any) => ({
      ...p,
      likesCount: p._count?.interactions || 0,
      hasLiked: p.interactions?.some((i: any) => i.userId === currentUser.value?.id) || false
    }));
  } catch (err) { console.error(err); }
}

async function fetchDiary() {
  try {
    const response = await api.get(`/diary/${usernameParam.value}`);
    gameLogs.value = response.data;
  } catch (err) { console.error(err); }
}

// =============================================================================
// 5. AÇÕES E INTERAÇÕES
// =============================================================================

// --- FEED ---
async function handlePublish() {
  if (!newPostContent.value.trim()) return; 
  isPosting.value = true;
  try {
    await api.post('/posts', { userId: currentUser.value.id, content: newPostContent.value, type: 'TEXT' });
    newPostContent.value = '';
    await fetchPosts();
    if (usernameParam.value === currentUser.value.username) await fetchProfile(); 
  } catch (err) { alert('Erro ao publicar.'); } 
  finally { isPosting.value = false; }
}

async function handleRespect(post: any) {
  const wasLiked = post.hasLiked;
  post.hasLiked = !wasLiked;
  post.likesCount += wasLiked ? -1 : 1;
  try { await api.post(`/posts/${post.id}/respect`, { userId: currentUser.value.id }); } 
  catch (err) { post.hasLiked = wasLiked; post.likesCount += wasLiked ? 1 : -1; }
}

async function toggleComments(post: any) {
  const postId = post.id;
  if (openComments[postId]) { openComments[postId] = false; return; }
  openComments[postId] = true;
  if (!postComments[postId]) {
      try { const res = await api.get(`/posts/${postId}/comments`); postComments[postId] = res.data; } 
      catch (e) { console.error(e); }
  }
}

async function sendComment(post: any) {
    const postId = post.id;
    const text = commentInputs[postId];
    if (!text?.trim()) return;
    try {
        const res = await api.post(`/posts/${postId}/comments`, { userId: currentUser.value.id, content: text });
        if (!postComments[postId]) postComments[postId] = [];
        postComments[postId].push(res.data);
        commentInputs[postId] = '';
    } catch (e) { alert("Erro ao comentar."); }
}

// --- DIÁRIO ---
async function handleLogGame() {
  try {
    await api.post('/diary', { userId: currentUser.value.id, ...gameForm });
    isLoggingGame.value = false;
    gameForm.gameTitle = ''; gameForm.review = ''; gameForm.hoursPlayed = 0;
    await initData();
    alert("Jornada registrada! +50 XP");
  } catch (e) { alert("Erro ao registrar jogo."); }
}

// --- UPLOAD DE CONQUISTA (OCR) ---
function handleImageSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    selectedImage.value = input.files[0];
    previewImageUrl.value = URL.createObjectURL(input.files[0]);
  } else {
    selectedImage.value = null;
    previewImageUrl.value = null;
  }
}

async function uploadAchievementImage() {
  if (!selectedImage.value || !currentUser.value) {
    alert("Selecione uma imagem.");
    return;
  }
  isUploadingAchievement.value = true;
  const formData = new FormData();
  formData.append('image', selectedImage.value);
  formData.append('userId', currentUser.value.id);
  if (uploadGameTitle.value) formData.append('gameTitle', uploadGameTitle.value);

  try {
    const response = await api.post('/posts/upload-achievement-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    alert(`Imagem processada! Jogo detectado: ${response.data.recognizedGame}`);
    selectedImage.value = null;
    previewImageUrl.value = null;
    uploadGameTitle.value = '';
    showAchievementUpload.value = false;
    await fetchPosts(); // Atualiza feed
  } catch (error) {
    console.error(error);
    alert("Erro ao processar a imagem.");
  } finally {
    isUploadingAchievement.value = false;
  }
}

// --- STEAM & INTEGRAÇÕES ---
async function openGameDetails(appId: number) {
    const steamLink = integrations.value.find((i: any) => i.provider === 'STEAM');
    if (!steamLink || !steamLink.externalId) return;
    isViewingGame.value = true;
    isLoadingDetails.value = true;
    selectedGameDetails.value = null;
    try {
        const res = await api.post('/integrations/steam/game-details', {
            steamId: steamLink.externalId, appId: appId
        });
        selectedGameDetails.value = res.data;
    } catch (e) {
        isViewingGame.value = false;
        alert("Erro ao carregar conquistas (Perfil Privado?).");
    } finally { isLoadingDetails.value = false; }
}

async function handleSave() {
  isSaving.value = true;
  try {
    await api.patch(`/profiles/${usernameParam.value}`, { ...editForm });
    // Salva todos os IDs
    if (integrationForm.steamId) await api.post('/integrations', { userId: currentUser.value.id, provider: 'STEAM', externalId: integrationForm.steamId });
    if (integrationForm.psnId) await api.post('/integrations', { userId: currentUser.value.id, provider: 'PSN', externalId: integrationForm.psnId });
    if (integrationForm.xboxId) await api.post('/integrations', { userId: currentUser.value.id, provider: 'XBOX', externalId: integrationForm.xboxId });
    if (integrationForm.epicId) await api.post('/integrations', { userId: currentUser.value.id, provider: 'EPIC', externalId: integrationForm.epicId });
    
    isEditing.value = false;
    await fetchProfile(); 
  } catch (err) { alert('Erro ao salvar.'); } 
  finally { isSaving.value = false; }
}

async function syncSteam() {
  if (!integrationForm.steamId) return alert("Digite o ID Steam.");
  try {
    await api.post('/integrations', { userId: currentUser.value.id, provider: 'STEAM', externalId: integrationForm.steamId });
    const res = await api.post('/integrations/steam/sync', { userId: currentUser.value.id, steamId: integrationForm.steamId });
    alert(`Sync Completo! ${res.data.stats.gameCount} jogos.`);
    await fetchProfile();
  } catch (e) { alert("Erro no Sync. Verifique API Key e Privacidade."); }
}

// --- UTILITÁRIOS ---
function handleLogout() {
  if(confirm('Sair do sistema?')) { localStorage.removeItem('clutch_user'); router.push('/'); }
}
function goToProfile(username: string) { router.push(`/profile/${username}`); }
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}
function getProviderIcon(provider: string) {
    if (provider === 'STEAM') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png';
    if (provider === 'EPIC') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/512px-Epic_Games_logo.svg.png';
    if (provider === 'PSN') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/PlayStation_logo.svg/2560px-PlayStation_logo.svg.png';
    if (provider === 'XBOX') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Xbox_one_logo.svg/1024px-Xbox_one_logo.svg.png';
    if (provider === 'NINTENDO') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Nintendo.svg/1024px-Nintendo.svg.png';
    return '';
}
function getSteamStatusColor(status: number) {
    if (status === 0) return 'bg-gray-500'; // Offline
    if (status === 1) return 'bg-blue-500'; // Online
    return 'bg-[#00FF94]'; // In-Game
}
</script>

<template>
  <div class="min-h-screen bg-[#050505] text-white font-sans pb-20 relative">
    
    <div class="h-[300px] w-full bg-[#0A0A0A] relative overflow-hidden group">
      <img v-if="profile?.bannerUrl" :src="profile.bannerUrl" class="w-full h-full object-cover opacity-60" @error="profile.bannerUrl = null" />
      <div v-else class="w-full h-full absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-green-900/40 opacity-80">
         <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(#ffffff 1px, transparent 1px); background-size: 20px 20px;"></div>
      </div>
      <div class="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent"></div>
      
      <div class="absolute top-6 right-6 flex gap-3 z-20">
        <button @click="router.push('/arena')" class="bg-black/50 hover:bg-yellow-500 hover:text-black text-yellow-400 px-4 py-2 rounded-full text-sm font-bold border border-yellow-500/20 backdrop-blur transition-all flex items-center gap-2"><span>🏆</span> ARENA</button>
        <button v-if="currentUser?.id === profile?.id" @click="isEditing = true" class="bg-black/50 hover:bg-[#00FF94] hover:text-black text-white px-4 py-2 rounded-full text-sm font-bold border border-white/20 backdrop-blur transition-all">✎ EDITAR</button>
        <button @click="handleLogout" class="bg-red-500/20 hover:bg-red-600 text-red-200 hover:text-white px-4 py-2 rounded-full text-sm font-bold border border-red-500/20 backdrop-blur transition-all">SAIR</button>
      </div>
      <button v-if="currentUser?.username !== usernameParam" @click="goToProfile(currentUser.username)" class="absolute top-6 left-6 bg-black/50 hover:bg-white hover:text-black text-white px-4 py-2 rounded-full text-sm font-bold border border-white/20 backdrop-blur transition-all z-20">← VOLTAR</button>
    </div>

    <div v-if="!isLoading" class="max-w-7xl mx-auto px-6 -mt-24 relative flex flex-col md:flex-row items-end gap-6 animate-fadeIn">
      <div class="w-40 h-40 bg-[#1A1A1A] rounded-2xl border-4 border-[#050505] shadow-2xl overflow-hidden relative flex-shrink-0 group">
         <img :src="profile?.avatarUrl || steamStats?.avatarFull || `https://api.dicebear.com/9.x/avataaars/svg?seed=${usernameParam}`" class="w-full h-full object-cover bg-gray-800" />
         <div v-if="steamStats" class="absolute bottom-3 right-3 w-5 h-5 rounded-full border-2 border-[#1A1A1A]" :class="getSteamStatusColor(steamStats.status)"></div>
      </div>
      <div class="flex-1 mb-2">
        <div class="flex items-center gap-3">
            <h1 class="text-4xl font-bold italic tracking-tighter text-white">{{ profile?.displayName || usernameParam }}</h1>
            <div v-if="steamStats?.country" class="text-2xl" :title="steamStats.country">🌍</div>
            <div class="flex gap-2 mt-1">
                <div v-for="link in integrations" :key="link.id" class="w-6 h-6 bg-white/10 rounded p-1 cursor-help" :title="link.externalId">
                    <img :src="getProviderIcon(link.provider)" class="w-full h-full object-contain brightness-200 grayscale hover:grayscale-0 transition-all">
                </div>
            </div>
        </div>
        <p v-if="steamStats?.gameExtraInfo" class="text-[#00FF94] font-bold text-sm mt-1 animate-pulse">🎮 Jogando agora: {{ steamStats.gameExtraInfo }}</p>
        <p v-else class="text-gray-400 text-lg mt-1 max-w-2xl">{{ profile?.bio || 'Gamer sem descrição.' }}</p>
      </div>
      <div class="mb-4 flex gap-4">
         <div class="bg-[#1A1A1A] px-4 py-2 rounded border border-gray-800 text-center min-w-[80px]"><span class="text-[#00FF94] font-bold text-xl">{{ profile?.energy }}%</span><span class="text-[10px] text-gray-500 block uppercase tracking-wider">Energia</span></div>
         <div v-if="steamStats" class="bg-[#1A1A1A] px-4 py-2 rounded border border-gray-800 text-center min-w-[80px] animate-fadeIn"><span class="text-blue-400 font-bold text-xl">{{ steamStats.totalHours }}h</span><span class="text-[10px] text-gray-500 block uppercase tracking-wider">Playtime</span></div>
         <div class="bg-[#1A1A1A] px-4 py-2 rounded border border-gray-800 text-center min-w-[80px]"><span class="text-white font-bold text-xl">{{ profile?.xp }}</span><span class="text-[10px] text-gray-500 block uppercase tracking-wider">XP Total</span></div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      <div class="lg:col-span-4 space-y-6">
        <div class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-6">
          <h3 class="text-gray-500 uppercase text-xs font-bold tracking-widest mb-4">Main Character</h3>
          <div class="aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden relative"><img src="https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yone_0.jpg" class="w-full h-full object-cover opacity-80"/><div class="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black to-transparent"><p class="font-bold text-white">Yone</p></div></div>
        </div>

        <div v-if="steamStats && steamStats.topGames" class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-6 animate-fadeIn">
            <h3 class="text-gray-500 uppercase text-xs font-bold tracking-widest mb-4 flex items-center gap-2"><img :src="getProviderIcon('STEAM')" class="w-4 h-4"> Mais Jogados</h3>
            <div class="space-y-6">
                <div v-for="game in steamStats.topGames" :key="game.appid" class="group cursor-pointer" @click="openGameDetails(game.appid)">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-12 h-12 bg-gray-800 rounded overflow-hidden border border-gray-700 group-hover:border-[#00FF94] transition-colors flex-shrink-0"><img :src="game.icon" class="w-full h-full object-cover"></div>
                        <div class="flex-1 overflow-hidden">
                            <p class="text-sm font-bold text-white truncate group-hover:text-[#00FF94] transition-colors">{{ game.name }}</p>
                            <p class="text-xs text-gray-500">{{ game.hours }} horas registradas</p>
                        </div>
                        <div class="text-gray-600 group-hover:text-white transition-colors">➔</div>
                    </div>
                    <div v-if="game.achievements && game.achievements.total > 0">
                        <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden relative"><div class="bg-[#00FF94] h-full transition-all duration-1000" :style="`width: ${game.achievements.percent}%`"></div></div>
                        <div class="flex justify-between text-[10px] text-gray-500 mt-1 font-mono uppercase"><span>Progresso</span><span class="text-[#00FF94]">{{ game.achievements.achieved }} / {{ game.achievements.total }} ({{ game.achievements.percent }}%)</span></div>
                    </div>
                    <div v-else-if="game.achievements && game.achievements.total === 0" class="text-[10px] text-gray-600 italic mt-1 border-t border-gray-800 pt-1">Sem conquistas.</div>
                    <div v-else class="text-[10px] text-red-400/60 italic mt-1 border-t border-gray-800 pt-1 flex items-center gap-1"><span>🔒</span> Dados restritos.</div>
                </div>
            </div>
        </div>
      </div>

      <div class="lg:col-span-8 space-y-6">
         <div class="flex gap-4 border-b border-gray-800 pb-2 mb-4">
           <button @click="showDiary = false" class="pb-2 px-2 font-bold text-sm uppercase tracking-widest transition-colors" :class="!showDiary ? 'text-[#00FF94] border-b-2 border-[#00FF94]' : 'text-gray-500 hover:text-white'">Feed Global</button>
           <button @click="showDiary = true" class="pb-2 px-2 font-bold text-sm uppercase tracking-widest transition-colors" :class="showDiary ? 'text-[#00FF94] border-b-2 border-[#00FF94]' : 'text-gray-500 hover:text-white'">Diário de Gamer</button>
         </div>

         <div v-if="!showDiary" class="space-y-6">
             <div v-if="currentUser?.id === profile?.id" class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
                <div class="flex gap-4 items-center">
                    <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex-shrink-0"><img :src="profile?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${usernameParam}`" class="w-full h-full object-cover"/></div>
                    <input v-model="newPostContent" @keyup.enter="handlePublish" type="text" placeholder="O que você jogou hoje?" class="bg-transparent flex-1 outline-none text-white placeholder-gray-600 h-full" :disabled="isPosting"/>
                    <button @click="handlePublish" class="text-[#00FF94] hover:text-white transition-colors px-2">➤</button>
                </div>
                <button @click="showAchievementUpload = true" class="w-full text-center text-gray-500 hover:text-[#00FF94] text-xs font-bold uppercase tracking-wider py-2 rounded-lg border border-dashed border-gray-700 hover:border-[#00FF94] transition-all flex items-center justify-center gap-2">
                    <span class="text-xl">📸</span> UPLOAD DE PRINT DE CONQUISTA
                </button>
             </div>

             <div v-for="post in posts" :key="post.id" class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all">
                <div class="flex items-center gap-3 mb-4">
                   <div @click="goToProfile(post.user.username)" class="w-10 h-10 rounded-full overflow-hidden bg-gray-800 border border-gray-700 cursor-pointer hover:scale-110 transition-transform"><img :src="post.user.profile?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${post.user.username}`" class="w-full h-full object-cover"/></div>
                   <div>
                      <p @click="goToProfile(post.user.username)" class="font-bold text-sm text-white flex items-center gap-2 cursor-pointer hover:underline decoration-[#00FF94]">{{ post.user.profile?.displayName || post.user.username }}<span class="text-gray-500 font-normal text-xs no-underline">@{{ post.user.username }}</span></p>
                      <p class="text-xs text-gray-600">{{ formatDate(post.createdAt) }}</p>
                   </div>
                </div>
                
                <div v-if="post.type === 'IMAGE'" class="mb-4 bg-black rounded-lg overflow-hidden border border-gray-800">
                    <div class="p-10 text-center text-gray-500 text-xs">IMAGEM PROCESSADA (Mock)</div>
                </div>
                
                <p class="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">{{ post.contentText }}</p>
                
                <div class="mt-4 pt-4 border-t border-gray-900 flex gap-6 text-gray-500 text-xs font-bold uppercase tracking-wider">
                   <button @click="handleRespect(post)" class="flex items-center gap-2 transition-all active:scale-95" :class="post.hasLiked ? 'text-[#00FF94]' : 'hover:text-gray-300'"><span class="text-lg">⚡</span> <span>Respect {{ post.likesCount > 0 ? `(${post.likesCount})` : '' }}</span></button>
                   <button @click="toggleComments(post)" class="hover:text-white transition-colors flex items-center gap-2" :class="openComments[post.id] ? 'text-white' : ''"><span class="text-lg">💬</span> Comentar</button>
                </div>
                <div v-if="openComments[post.id]" class="mt-4 pt-4 border-t border-gray-800/50 animate-fadeIn">
                    <div class="space-y-3 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                        <div v-if="!postComments[post.id] || postComments[post.id].length === 0" class="text-gray-600 text-xs italic">Seja o primeiro a comentar...</div>
                        <div v-for="comment in postComments[post.id]" :key="comment.id" class="flex gap-3 text-sm">
                            <div @click="goToProfile(comment.user.username)" class="w-6 h-6 rounded-full bg-gray-700 overflow-hidden flex-shrink-0 cursor-pointer"><img :src="comment.user.profile?.avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${comment.user.username}`" class="w-full h-full object-cover"></div>
                            <div><span @click="goToProfile(comment.user.username)" class="font-bold text-white text-xs mr-2 cursor-pointer hover:text-[#00FF94]">{{ comment.user.profile?.displayName }}</span><span class="text-gray-400">{{ comment.content }}</span></div>
                        </div>
                    </div>
                    <div class="flex gap-2"><input v-model="commentInputs[post.id]" @keyup.enter="sendComment(post)" type="text" class="flex-1 bg-[#151515] border border-gray-800 rounded p-2 text-xs text-white focus:border-[#00FF94] outline-none" placeholder="Escreva uma resposta..."/><button @click="sendComment(post)" class="text-[#00FF94] hover:text-white text-xs font-bold uppercase">Enviar</button></div>
                </div>
             </div>
         </div>

         <div v-else class="space-y-6">
            <button v-if="currentUser?.id === profile?.id" @click="isLoggingGame = true" class="w-full bg-[#0A0A0A] border border-dashed border-gray-700 hover:border-[#00FF94] text-gray-400 hover:text-[#00FF94] py-6 rounded-xl transition-all font-bold uppercase tracking-widest flex flex-col items-center gap-2"><span class="text-2xl">📜</span> Registrar Zeramento (+50 XP)</button>
            <div v-if="gameLogs.length === 0" class="text-center py-10 text-gray-600 italic">Nenhum jogo registrado nesta jornada...</div>
            <div class="relative border-l-2 border-gray-800 ml-4 space-y-8 py-4">
              <div v-for="log in gameLogs" :key="log.id" class="relative pl-8 animate-fadeIn">
                <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-[#00FF94] shadow-[0_0_10px_#00FF94]"></div>
                <div class="bg-[#0A0A0A] border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-all">
                  <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-black italic text-white">{{ log.gameTitle }}</h3>
                    <span class="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">{{ log.platform }}</span>
                  </div>
                  <div class="flex gap-4 text-sm text-gray-400 mb-4"><span>⏳ {{ log.hoursPlayed }}h jogadas</span><span class="text-yellow-500">⭐ {{ log.rating }}/5</span><span class="text-[#00FF94] font-bold uppercase">{{ log.emotion }}</span></div>
                  <p class="text-gray-300 italic border-l-2 border-gray-700 pl-3">"{{ log.review }}"</p>
                  <p class="text-xs text-gray-600 mt-4 text-right">Zalvado em {{ formatDate(log.finishedAt) }}</p>
                </div>
              </div>
            </div>
         </div>
      </div>
    </div>

    <div v-if="isEditing" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div class="bg-[#0A0A0A] border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
        <h2 class="text-2xl font-bold mb-6 italic">EDITAR <span class="text-[#00FF94]">IDENTIDADE</span></h2>
        <div class="flex gap-4 mb-6 border-b border-gray-800 pb-2">
            <button @click="editTab = 'IDENTITY'" :class="editTab === 'IDENTITY' ? 'text-white border-b border-[#00FF94]' : 'text-gray-500'">PERFIL</button>
            <button @click="editTab = 'CONNECTIONS'" :class="editTab === 'CONNECTIONS' ? 'text-white border-b border-[#00FF94]' : 'text-gray-500'">CONEXÕES</button>
        </div>
        <form @submit.prevent="handleSave" class="space-y-4">
          <div v-if="editTab === 'IDENTITY'" class="space-y-4">
            <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Nome</label><input v-model="editForm.displayName" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none"/></div>
            <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Bio</label><textarea v-model="editForm.bio" rows="3" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none resize-none"></textarea></div>
            <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Avatar</label><input v-model="editForm.avatarUrl" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none"/></div>
            <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Banner</label><input v-model="editForm.bannerUrl" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none"/></div>
          </div>
          <div v-if="editTab === 'CONNECTIONS'" class="space-y-4">
             <div class="bg-gray-900 p-3 rounded text-xs text-gray-400 mb-2">Cole seu ID público.</div>
             <div>
                 <label class="block text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2"><img :src="getProviderIcon('STEAM')" class="w-4 h-4"> STEAM ID</label>
                 <div class="flex gap-2"><input v-model="integrationForm.steamId" type="text" class="flex-1 bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none" placeholder="Ex: 765..."/><button type="button" @click="syncSteam" class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/50 px-4 rounded font-bold text-xs transition-all">↻ SYNC</button></div>
             </div>
             <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2"><img :src="getProviderIcon('PSN')" class="w-4 h-4"> PSN ID</label><input v-model="integrationForm.psnId" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none" placeholder="Ex: KratosGod"/></div>
             <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2"><img :src="getProviderIcon('XBOX')" class="w-4 h-4"> XBOX ID</label><input v-model="integrationForm.xboxId" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none" placeholder="Ex: MasterChief"/></div>
             <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1 flex items-center gap-2"><img :src="getProviderIcon('EPIC')" class="w-4 h-4"> EPIC ID</label><input v-model="integrationForm.epicId" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none" placeholder="Ex: Ninja"/></div>
          </div>
          <div class="flex gap-3 mt-6 pt-4 border-t border-gray-800">
            <button type="button" @click="isEditing = false" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded">CANCELAR</button>
            <button type="submit" :disabled="isSaving" class="flex-1 bg-[#00FF94] hover:bg-[#00cc7a] text-black font-bold py-3 rounded">{{ isSaving ? 'SALVANDO...' : 'SALVAR TUDO' }}</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="isLoggingGame" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
        <div class="bg-[#0A0A0A] border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
        <h2 class="text-2xl font-bold mb-6 italic">DIÁRIO DE <span class="text-[#00FF94]">CONQUISTAS</span></h2>
        <form @submit.prevent="handleLogGame" class="space-y-4">
          <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Jogo</label><input v-model="gameForm.gameTitle" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none" required/></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Plataforma</label><select v-model="gameForm.platform" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white outline-none"><option>PC</option><option>PS5</option><option>XBOX</option><option>SWITCH</option></select></div>
            <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Horas</label><input v-model.number="gameForm.hoursPlayed" type="number" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white outline-none"/></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
             <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Nota (1-5)</label><input v-model.number="gameForm.rating" type="number" min="1" max="5" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white outline-none"/></div>
             <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Sentimento</label><select v-model="gameForm.emotion" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white outline-none"><option value="EPIC">🔥 ÉPICO</option><option value="SAD">😭 TRISTE</option><option value="RAGE">😡 RAGE</option><option value="SCARY">💀 ASSUSTADOR</option><option value="CHILL">☕ RELAX</option></select></div>
          </div>
          <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Review</label><textarea v-model="gameForm.review" rows="3" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none resize-none"></textarea></div>
          <div class="flex gap-3 mt-6 pt-4 border-t border-gray-800">
            <button type="button" @click="isLoggingGame = false" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded">CANCELAR</button>
            <button type="submit" class="flex-1 bg-[#00FF94] hover:bg-[#00cc7a] text-black font-bold py-3 rounded">SALVAR NA HISTÓRIA</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="isViewingGame" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" @click.self="isViewingGame = false">
        <div class="bg-[#0A0A0A] border border-gray-800 w-full max-w-2xl max-h-[90vh] rounded-2xl p-6 shadow-2xl relative flex flex-col overflow-hidden">
            <div class="flex justify-between items-center mb-4 border-b border-gray-800 pb-4">
                <h2 class="text-xl font-bold text-white flex items-center gap-2"><img :src="getProviderIcon('STEAM')" class="w-5 h-5"> {{ selectedGameDetails?.gameName || 'Carregando...' }}</h2>
                <button @click="isViewingGame = false" class="text-gray-500 hover:text-white font-bold">✕</button>
            </div>
            <div v-if="isLoadingDetails" class="flex-1 flex items-center justify-center text-[#00FF94] animate-pulse py-20">BUSCANDO DADOS NA STEAM...</div>
            <div v-else-if="selectedGameDetails?.achievements" class="overflow-y-auto custom-scrollbar flex-1 pr-2">
                <div class="grid grid-cols-1 gap-3">
                    <div v-for="ach in selectedGameDetails.achievements" :key="ach.name" class="flex items-center gap-4 p-3 rounded-lg border border-gray-800/50 transition-colors" :class="ach.achieved ? 'bg-[#00FF94]/5 border-[#00FF94]/20' : 'bg-[#151515] opacity-60'">
                        <img :src="ach.achieved ? ach.icon : ach.iconGray" class="w-16 h-16 rounded object-cover shadow-lg">
                        <div class="flex-1">
                            <h4 class="font-bold text-sm" :class="ach.achieved ? 'text-white' : 'text-gray-400'">{{ ach.name }}</h4>
                            <p class="text-xs text-gray-500 mt-1">{{ ach.description || 'Conquista secreta ou sem descrição.' }}</p>
                        </div>
                        <div v-if="ach.achieved" class="text-[#00FF94] text-xs font-bold uppercase tracking-widest">Desbloqueado</div>
                        <div v-else class="text-gray-600 text-xs font-bold uppercase tracking-widest">Bloqueado</div>
                    </div>
                </div>
            </div>
            <div v-else class="text-center text-gray-500 py-10">Nenhum detalhe encontrado.</div>
        </div>
    </div>

    <div v-if="showAchievementUpload" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" @click.self="showAchievementUpload = false">
        <div class="bg-[#0A0A0A] border border-gray-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <h2 class="text-2xl font-bold mb-6 italic">UPLOAD DE <span class="text-[#00FF94]">CONQUISTA</span></h2>
            <form @submit.prevent="uploadAchievementImage" class="space-y-4">
                <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Título do Jogo (Opcional)</label><input v-model="uploadGameTitle" type="text" class="w-full bg-[#151515] border border-gray-700 rounded p-3 text-white focus:border-[#00FF94] outline-none" placeholder="Ex: Elden Ring" /></div>
                <div><label class="block text-xs text-gray-500 uppercase font-bold mb-1">Selecione o Print</label><input type="file" @change="handleImageSelect" accept="image/*" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-[#00FF94] hover:file:bg-gray-700 hover:file:cursor-pointer"/></div>
                <div v-if="previewImageUrl" class="mt-4 flex justify-center"><img :src="previewImageUrl" alt="Preview da Imagem" class="max-w-full max-h-60 object-contain border border-gray-700 rounded-lg"/></div>
                <div class="flex gap-3 mt-6 pt-4 border-t border-gray-800">
                    <button type="button" @click="showAchievementUpload = false" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded">CANCELAR</button>
                    <button type="submit" :disabled="isUploadingAchievement || !selectedImage" class="flex-1 bg-[#00FF94] hover:bg-[#00cc7a] text-black font-bold py-3 rounded">{{ isUploadingAchievement ? 'PROCESSANDO...' : 'PROCESSAR IMAGEM' }}</button>
                </div>
            </form>
        </div>
    </div>

  </div>
</template>