import { createApp } from 'vue'
import App from './App.vue'
import router from './router/index.js'
import './index.css'
import './css/editor-colors.css'
import './css/editor-theme.css'

createApp(App).use(router).mount('#app')
