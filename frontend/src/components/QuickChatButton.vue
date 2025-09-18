<template>
  <div class="draggable-button-container">
    <div
      class="draggable-btn"
      :style="{ left: x + 'px', top: y + 'px' }"
      @mousedown="startDrag"
      @click="handleClick"
    :class="{ dragging: isDragging }"
    >
      <slot>
        <RemixIcon name="sparkling-2-fill" size="lg" />
      </slot>
    </div>
    
    <QuickChatPopup
      v-model:show="showQuickChat"
      :anchor-x="x"
      :anchor-y="y"
      @close="closeQuickChatDialog"
      @send="handleSendMessage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QuickChatPopup from './QuickChatPopup.vue'
import RemixIcon from './icons/RemixIcon.vue'

const x = ref(0)
const y = ref(0)
const isDragging = ref(false)
const showQuickChat = ref(false)

const emit = defineEmits<{
  click: [event: MouseEvent]
  'drag-end': [x: number, y: number]
  'quick-chat': [message: string]
}>()
const percentX = ref(0)
const percentY = ref(0)
let startX = 0
let startY = 0
let dragDistance = 0

const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  dragDistance = 0
  startX = e.clientX - x.value
  startY = e.clientY - y.value
  const startClientX = e.clientX
  const startClientY = e.clientY
  
  const onMouseMove = (e: MouseEvent) => {
    // 计算拖拽距离
    dragDistance = Math.sqrt(
      Math.pow(e.clientX - startClientX, 2) + Math.pow(e.clientY - startClientY, 2)
    )
    
    // 边界检测，只允许在底部90%高度处左右移动
    const btnSize = 50
    const maxX = window.innerWidth - btnSize
    // 计算屏幕底部90%的位置，允许在小范围内上下移动（±30像素）
    const targetY = window.innerHeight * 0.95 - btnSize / 2
    const minY = Math.max(0, targetY - 30)
    const maxY = Math.min(window.innerHeight - btnSize, targetY + 30)
    
    x.value = Math.max(0, Math.min(maxX, e.clientX - startX))
    y.value = Math.max(minY, Math.min(maxY, e.clientY - startY))
  }
  
  const onMouseUp = () => {
    isDragging.value = false
    // 保存百分比位置到 localStorage 和组件内部
    percentX.value = (x.value / (window.innerWidth - 50)) * 100
    percentY.value = (y.value / (window.innerHeight - 50)) * 100
    localStorage.setItem('draggableBtnPos', JSON.stringify({
      x: percentX.value,
      y: percentY.value
    }))
    // 发送拖拽结束事件
    emit('drag-end', x.value, y.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const handleClick = (e: MouseEvent) => {
  // 如果拖拽距离超过 5 像素，就认为是拖拽而不是点击
  if (dragDistance < 5) {
    emit('click', e)
    // 切换快速聊天对话框
    showQuickChat.value = !showQuickChat.value
  }
}

const closeQuickChatDialog = () => {
  showQuickChat.value = false
}

const handleSendMessage = (message: string) => {
  emit('quick-chat', message)
  // 显示成功消息
  console.log('💬 发送消息:', message)
  // 这里可以集成统一的通知系统
  // unifiedStore.showSuccess(`消息已发送: ${message}`)
}

const updatePositionFromPercent = () => {
  const btnSize = 50
  // 使用组件内部保存的百分比值，但Y坐标固定在底部90%位置
  x.value = (percentX.value / 100) * (window.innerWidth - btnSize)
  const targetY = window.innerHeight * 0.9 - btnSize / 2
  // 确保Y坐标在有效范围内
  y.value = Math.max(0, Math.min(window.innerHeight - btnSize, targetY))
}

const handleResize = () => {
  updatePositionFromPercent()
}

onMounted(() => {
  // 从 localStorage 读取保存的位置
  const saved = localStorage.getItem('draggableBtnPos')
  if (saved) {
    try {
      const pos = JSON.parse(saved)
      percentX.value = pos.x
      percentY.value = pos.y
      updatePositionFromPercent()
    } catch {
      // 如果 localStorage 数据损坏，使用默认位置（底部90%高度，右侧）
      const btnSize = 50
      x.value = window.innerWidth - 70
      const targetY = window.innerHeight * 0.9 - btnSize / 2
      y.value = Math.max(0, Math.min(window.innerHeight - btnSize, targetY))
      percentX.value = 90 // 90% 位置
      percentY.value = 90
    }
  } else {
    // 默认位置：底部90%高度，右侧
    const btnSize = 50
    x.value = window.innerWidth - 70
    const targetY = window.innerHeight * 0.9 - btnSize / 2
    y.value = Math.max(0, Math.min(window.innerHeight - btnSize, targetY))
    percentX.value = 90
    percentY.value = 90
  }
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})
</script>

<style scoped>
.draggable-button-container {
  position: relative;
}

.draggable-btn {
  position: fixed;
  z-index: 8888;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  cursor: move;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  user-select: none;
  color: var(--color-text-primary);
}

.draggable-btn.dragging {
  cursor: grabbing;
}

.draggable-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.draggable-btn:active {
  transform: scale(0.95);
}
</style>