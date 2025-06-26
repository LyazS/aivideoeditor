import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import ContextMenu from '@imengyu/vue3-context-menu'

const app = createApp(App)

app.use(createPinia())
app.use(ContextMenu)

app.mount('#app')
