import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
import ContextMenu from '@imengyu/vue3-context-menu'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ContextMenu)

app.mount('#app')

// 在开发模式下加载调试工具
if (import.meta.env.DEV) {
  import('./utils/keyframeDebugger')
  console.log('🔧 关键帧调试工具已加载')
}
