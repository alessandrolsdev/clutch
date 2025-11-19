import { createRouter, createWebHistory } from 'vue-router';
import RegisterView from '../views/RegisterView.vue';
import ProfileView from '../views/ProfileView.vue'; 
import LeaderboardView from '../views/LeaderboardView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'register', component: RegisterView },
    { path: '/profile/:username', name: 'profile', component: ProfileView },
    // Nova Rota:
    { 
      path: '/arena', 
      name: 'arena', 
      component: LeaderboardView 
    }
  ]
});

export default router;