import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 导入测试工具（仅在开发环境）
if (import.meta.env.DEV) {
  import('./test-operation-system')
  import('./operation-system-status')
}

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
