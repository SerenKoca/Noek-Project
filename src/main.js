import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'
import './css/editor-colors.css'
import './css/editor-theme.css'

createApp(App).use(router).mount('#app')
