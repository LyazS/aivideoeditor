<template>
  <div class="dropdown" ref="dropdownRef">
    <!-- 触发内容插槽 - 完全由用户自定义 -->
    <slot
      name="trigger"
      :is-open="isOpen"
      :toggle="toggleDropdown"
      :open="openDropdown"
      :close="closeDropdown"
    />

    <!-- 使用 Portal 渲染下拉菜单到 body -->
    <Teleport to="body" v-if="isOpen">
      <div
        class="dropdown-menu"
        :class="menuClass"
        :style="[menuPositionStyle, menuCustomStyle]"
        ref="menuRef"
      >
        <!-- 默认插槽提供统一的状态和方法 -->
        <slot
          :is-open="isOpen"
          :toggle="toggleDropdown"
          :open="openDropdown"
          :close="closeDropdown"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch, computed, nextTick } from 'vue'
import type { CSSProperties } from 'vue'

interface Props {
  /** 是否默认打开 */
  defaultOpen?: boolean
  /** 菜单位置 */
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'top' | 'bottom'
  /** 菜单自定义类名 */
  menuClass?: string
  /** 点击外部是否关闭 */
  closeOnClickOutside?: boolean
  /** 菜单宽度 */
  menuWidth?: string | number
  /** 菜单最大高度 */
  menuMaxHeight?: string | number
  /** 水平偏移量 */
  offsetX?: number
  /** 垂直偏移量 */
  offsetY?: number
  /** 是否禁用 */
  disabled?: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'open'): void
  (e: 'close'): void
  (e: 'click-outside', event: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  defaultOpen: false,
  placement: 'bottom-end',
  closeOnClickOutside: true,
  offsetX: 0,
  offsetY: 0,
  disabled: false,
})

const emit = defineEmits<Emits>()

const isOpen = ref(props.defaultOpen)
const dropdownRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()

// 计算自定义样式
const menuCustomStyle = computed<CSSProperties>(() => {
  const style: CSSProperties = {}
  
  if (props.menuWidth) {
    style.width = typeof props.menuWidth === 'number'
      ? `${props.menuWidth}px`
      : props.menuWidth
  }
  
  if (props.menuMaxHeight) {
    style.maxHeight = typeof props.menuMaxHeight === 'number'
      ? `${props.menuMaxHeight}px`
      : props.menuMaxHeight
    style.overflowY = 'auto'
  }
  
  return style
})

// 菜单位置样式（使用ref而不是computed，支持按需更新）
const menuPositionStyle = ref<Record<string, string>>({})

// 更新菜单位置函数
const updateMenuPosition = () => {
  if (!dropdownRef.value) return
  
  const rect = dropdownRef.value.getBoundingClientRect()
  const styles: Record<string, string> = {
    position: 'fixed',
    zIndex: '9999',
    minWidth: 'max-content'
  }
  
  const xOffset = props.offsetX
  const yOffset = props.offsetY
  
  switch (props.placement) {
    case 'bottom-start':
      styles.top = `${rect.bottom + window.scrollY + yOffset}px`
      styles.left = `${rect.left + window.scrollX + xOffset}px`
      break
    case 'bottom-end':
      styles.top = `${rect.bottom + window.scrollY + yOffset}px`
      styles.left = `${rect.right + window.scrollX + xOffset}px`
      styles.transform = 'translateX(-100%)'
      break
    case 'top-start':
      styles.top = `${rect.top + window.scrollY - 10 + yOffset}px`
      styles.left = `${rect.left + window.scrollX + xOffset}px`
      styles.transform = 'translateY(-100%)'
      break
    case 'top-end':
      styles.top = `${rect.top + window.scrollY - 10 + yOffset}px`
      styles.left = `${rect.right + window.scrollX + xOffset}px`
      styles.transform = 'translate(-100%, -100%)'
      break
    case 'top':
      styles.top = `${rect.top + window.scrollY - 10 + yOffset}px`
      styles.left = `${rect.left + window.scrollX + xOffset}px`
      styles.transform = 'translateY(-100%)'
      break
    case 'bottom':
      styles.top = `${rect.bottom + window.scrollY + yOffset}px`
      styles.left = `${rect.left + window.scrollX + xOffset}px`
      break
  }

  menuPositionStyle.value = styles
}

// 切换下拉菜单状态
const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value ? closeDropdown() : openDropdown()
}

// 打开下拉菜单
const openDropdown = async () => {
  if (props.disabled) return
  isOpen.value = true
  await nextTick()
  updateMenuPosition()  // 在打开时立即获取最新位置
  emit('update:open', true)
  emit('open')
}

// 关闭下拉菜单
const closeDropdown = () => {
  isOpen.value = false
  emit('update:open', false)
  emit('close')
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
  if (!props.closeOnClickOutside || !dropdownRef.value) return
  
  const target = event.target as Element
  if (!dropdownRef.value.contains(target)) {
    emit('click-outside', event)
    closeDropdown()
  }
}

// 添加全局点击事件监听
if (props.closeOnClickOutside) {
  window.addEventListener('click', handleClickOutside)
}

// 监听 open 状态变化
watch(isOpen, (newValue) => {
  emit('update:open', newValue)
})

// 组件卸载时清理事件监听
onUnmounted(() => {
  if (props.closeOnClickOutside) {
    window.removeEventListener('click', handleClickOutside)
  }
})

// 监听菜单打开状态，调整位置
watch(isOpen, async (newValue) => {
  if (newValue) {
    await nextTick()
    updateMenuPosition()  // 确保在菜单打开时更新位置
  }
})

// 暴露方法给父组件
defineExpose({
  open: openDropdown,
  close: closeDropdown,
  toggle: toggleDropdown,
  isOpen,
})
</script>

<style scoped>
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown-menu {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-medium);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: auto;
}

/* 滚动条样式 */
.dropdown-menu::-webkit-scrollbar {
  width: 6px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: var(--color-bg-tertiary);
  border-radius: 3px;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.dropdown-menu::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}

/* 确保下拉菜单可以超出父容器 */
.dropdown-menu :deep(*) {
  overflow: visible;
}
</style>