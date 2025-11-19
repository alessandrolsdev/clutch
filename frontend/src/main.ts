import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router' // <--- Tem que ter essa importação

const app = createApp(App)

app.use(router) // <--- Tem que ter essa linha ativando o router
app.mount('#app')