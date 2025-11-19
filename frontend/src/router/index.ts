import { createRouter, createWebHistory } from 'vue-router';
import RegisterView from '../views/RegisterView.vue';
import LoginView from '../views/LoginView.vue'; // <--- Importe
import ProfileView from '../views/ProfileView.vue';
import LeaderboardView from '../views/LeaderboardView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: LoginView }, // Login é a Home agora
    { path: '/register', name: 'register', component: RegisterView }, // Registro mudou para /register
    { path: '/profile/:username', name: 'profile', component: ProfileView },
    { path: '/arena', name: 'arena', component: LeaderboardView }
  ]
});

export default router;