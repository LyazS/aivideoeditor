import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { i18n } from '@/locales'

// 懒加载组件
const ProjectManagement = () => import('../views/ProjectManagement.vue')
const VideoEditor = () => import('../views/VideoEditor.vue')
const ScriptTest = () => import('../views/ScriptTest.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'ProjectManagement',
    component: ProjectManagement,
    meta: {
      title: 'app.title',
      subtitle: 'editor.projectManagement',
    },
  },
  {
    path: '/editor/:projectId?',
    name: 'VideoEditor',
    component: VideoEditor,
    meta: {
      title: 'app.title',
      subtitle: 'editor.videoEditor',
    },
  },
  {
    path: '/script-test',
    name: 'ScriptTest',
    component: ScriptTest,
    meta: {
      title: 'app.title',
      subtitle: 'Script Executor Test',
    },
  },
  {
    // 重定向所有未匹配的路由到首页
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 路由守卫 - 更新页面标题
router.beforeEach((to) => {
  if (to.meta?.title) {
    const { t } = i18n.global
    const title = t(to.meta.title as string)
    const subtitle = to.meta.subtitle ? t(to.meta.subtitle as string) : ''
    document.title = subtitle ? `${subtitle} - ${title}` : title
  }
})

export default router
