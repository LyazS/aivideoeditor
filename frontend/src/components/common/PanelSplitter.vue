<template>
  <div
    class="splitter"
    :class="[direction, { dragging: isDragging }]"
    @mousedown="startResize"
  >
    <div class="splitter-handle"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

interface Props {
  direction: 'horizontal' | 'vertical'
  minSize?: number
  maxSize?: number
  reverse?: boolean // 用于右侧分割器的反向拖拽
}

interface Emits {
  (e: 'start-resize'): void
  (e: 'resize', delta: number): void
}

const props = withDefaults(defineProps<Props>(), {
  minSize: 100,
  maxSize: 800,
  reverse: false
})

const emit = defineEmits<Emits>()

const isDragging = ref(false)
let startPosition = 0

const startResize = (event: MouseEvent) => {
  isDragging.value = true
  startPosition = props.direction === 'horizontal' ? event.clientY : event.clientX

  // 触发开始拖拽事件
  emit('start-resize')

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)

  const cursor = props.direction === 'horizontal' ? 'ns-resize' : 'ew-resize'
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'
}

const handleResize = (event: MouseEvent) => {
  if (!isDragging.value) return

  const currentPosition = props.direction === 'horizontal' ? event.clientY : event.clientX
  let delta = currentPosition - startPosition
  
  // 如果是反向拖拽（右侧分割器），反转delta
  if (props.reverse) {
    delta = -delta
  }

  emit('resize', delta)
}

const stopResize = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.splitter {
  background-color: var(--color-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-fast);
  position: relative;
  z-index: 10;
}

.splitter.horizontal {
  height: 8px;
  cursor: ns-resize;
  flex-direction: row;
}

.splitter.vertical {
  width: 8px;
  cursor: ew-resize;
  flex-direction: column;
}

.splitter:hover {
  background-color: var(--color-bg-hover);
}

.splitter.dragging {
  background-color: var(--color-accent-primary);
}

.splitter-handle {
  background-color: var(--color-border-secondary);
  border-radius: 2px;
  transition: background-color var(--transition-fast);
}

.horizontal .splitter-handle {
  width: 40px;
  height: 2px;
}

.vertical .splitter-handle {
  width: 2px;
  height: 40px;
}

.splitter:hover .splitter-handle,
.splitter.dragging .splitter-handle {
  background-color: var(--color-accent-primary);
}
</style>
