import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 懒加载组件
const ProjectManagement = () => import('../views/ProjectManagement.vue')
const VideoEditor = () => import('../views/VideoEditor.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'ProjectManagement',
    component: ProjectManagement,
    meta: {
      title: '项目管理 - 光影绘梦',
    },
  },
  {
    path: '/editor/:projectId?',
    name: 'VideoEditor',
    component: VideoEditor,
    meta: {
      title: '视频编辑器 - 光影绘梦',
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
    document.title = to.meta.title as string
  }
})

export default router
