<template>
  <div class="timecode-input-container">
    <div class="timecode-input" :class="{ 'timecode-input--error': hasError }">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        class="timecode-input__field"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
        @keydown="handleKeydown"
      />
    </div>

    <!-- 提示信息放在右侧 - 只在有错误时显示 -->
    <div v-if="hasError" class="timecode-input__message">
      <div class="timecode-input__error">
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { TimecodeUtils } from '@/utils/TimecodeUtils'

interface Props {
  /** 当前值（微秒） */
  modelValue: number
  /** 帧率 */
  frameRate?: number
  /** 占位符 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否显示提示 */
  showHint?: boolean
  /** 自定义提示文本 */
  customHint?: string
  /** 是否自动格式化 */
  autoFormat?: boolean
  /** 最大值（微秒） */
  maxValue?: number
  /** 最小值（微秒） */
  minValue?: number
}

interface Emits {
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number, timecode: string): void
  (e: 'focus'): void
  (e: 'blur'): void
  (e: 'error', error: string): void
}

const props = withDefaults(defineProps<Props>(), {
  frameRate: 30,
  placeholder: '00:00.00',
  disabled: false,
  showHint: false,
  autoFormat: true,
  maxValue: undefined,
  minValue: 0
})

const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement>()
const inputValue = ref('')
const hasError = ref(false)
const errorMessage = ref('')
const isFocused = ref(false)

// 计算提示文本
const hint = computed(() => {
  if (props.customHint) return props.customHint
  return `格式: MM:SS.FF 或 HH:MM:SS.FF (${props.frameRate}fps)`
})

// 监听外部值变化，更新输入框
watch(() => props.modelValue, (newValue) => {
  if (!isFocused.value) {
    updateInputFromValue(newValue)
  }
}, { immediate: true })

// 从微秒值更新输入框
function updateInputFromValue(microseconds: number) {
  try {
    const timecode = TimecodeUtils.webAVToTimecode(microseconds, props.frameRate)
    inputValue.value = timecode
    clearError()
  } catch (error) {
    console.error('更新输入框失败:', error)
  }
}

// 处理输入事件
function handleInput() {
  clearError()
  
  if (props.autoFormat) {
    // 实时验证但不立即格式化，避免干扰用户输入
    validateInput(inputValue.value, false)
  }
}

// 处理失焦事件
function handleBlur() {
  isFocused.value = false
  emit('blur')
  
  // 失焦时进行完整验证和格式化
  if (validateInput(inputValue.value, true)) {
    formatAndEmit()
  }
}

// 处理聚焦事件
function handleFocus() {
  isFocused.value = true
  emit('focus')
}

// 处理键盘事件
function handleKeydown(event: KeyboardEvent) {
  // Enter键确认输入
  if (event.key === 'Enter') {
    inputRef.value?.blur()
    return
  }
  
  // Escape键取消编辑
  if (event.key === 'Escape') {
    updateInputFromValue(props.modelValue)
    inputRef.value?.blur()
    return
  }
  
  // 数字键和导航键允许通过
  const allowedKeys = [
    'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 
    'Home', 'End', ':', '.', 'Enter', 'Escape'
  ]
  
  if (allowedKeys.includes(event.key) || 
      (event.key >= '0' && event.key <= '9') ||
      event.ctrlKey || event.metaKey) {
    return
  }
  
  // 阻止其他按键
  event.preventDefault()
}

// 验证输入
function validateInput(value: string, showError: boolean = true): boolean {
  if (!value.trim()) {
    if (showError) {
      setError('请输入时间码')
    }
    return false
  }
  
  // 验证格式
  if (!TimecodeUtils.validateTimecode(value)) {
    if (showError) {
      setError('时间码格式无效')
    }
    return false
  }
  
  // 验证范围
  try {
    const microseconds = TimecodeUtils.timecodeToWebAV(value, props.frameRate)
    
    if (props.minValue !== undefined && microseconds < props.minValue) {
      if (showError) {
        const minTimecode = TimecodeUtils.webAVToTimecode(props.minValue, props.frameRate)
        setError(`时间码不能小于 ${minTimecode}`)
      }
      return false
    }
    
    if (props.maxValue !== undefined && microseconds > props.maxValue) {
      if (showError) {
        const maxTimecode = TimecodeUtils.webAVToTimecode(props.maxValue, props.frameRate)
        setError(`时间码不能大于 ${maxTimecode}`)
      }
      return false
    }
    
    return true
  } catch (error) {
    if (showError) {
      setError('时间码值无效')
    }
    return false
  }
}

// 格式化并发送事件
function formatAndEmit() {
  try {
    const microseconds = TimecodeUtils.timecodeToWebAV(inputValue.value, props.frameRate)
    const formattedTimecode = TimecodeUtils.webAVToTimecode(microseconds, props.frameRate)
    
    // 更新输入框为格式化后的值
    inputValue.value = formattedTimecode
    
    // 发送更新事件
    emit('update:modelValue', microseconds)
    emit('change', microseconds, formattedTimecode)
    
    clearError()
  } catch (error) {
    setError('时间码转换失败')
    console.error('时间码转换失败:', error)
  }
}

// 设置错误
function setError(message: string) {
  hasError.value = true
  errorMessage.value = message
  emit('error', message)
}

// 清除错误
function clearError() {
  hasError.value = false
  errorMessage.value = ''
}

// 公开方法：聚焦输入框
function focus() {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 公开方法：选中所有文本
function selectAll() {
  nextTick(() => {
    inputRef.value?.select()
  })
}

// 暴露给父组件的方法
defineExpose({
  focus,
  selectAll
})
</script>

<style scoped>
.timecode-input-container {
  display: flex;
  align-items: center; /* 垂直居中对齐 */
  gap: 8px;
  width: 100%;
}

.timecode-input {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  width: 120px; /* 固定宽度，为右侧提示留出空间 */
}

.timecode-input__field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  font-family: 'Courier New', 'Monaco', monospace;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  background: var(--color-background, #fff);
  color: var(--color-text-primary, #333);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.timecode-input__field:focus {
  outline: none;
  border-color: var(--color-primary, #007bff);
  box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(0, 123, 255, 0.25));
}

.timecode-input__field:disabled {
  background: var(--color-background-disabled, #f5f5f5);
  color: var(--color-text-disabled, #999);
  cursor: not-allowed;
}

.timecode-input--error .timecode-input__field {
  border-color: var(--color-error, #dc3545);
}

.timecode-input--error .timecode-input__field:focus {
  border-color: var(--color-error, #dc3545);
  box-shadow: 0 0 0 2px var(--color-error-alpha, rgba(220, 53, 69, 0.25));
}

.timecode-input__message {
  flex: 1;
  min-width: 0; /* 允许文本换行 */
}

.timecode-input__error {
  padding: 4px 8px;
  background: var(--color-error-background, #f8d7da);
  color: var(--color-error, #721c24);
  border: 1px solid var(--color-error-border, #f5c6cb);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap; /* 防止错误信息换行 */
}

/* 深色主题支持 */
@media (prefers-color-scheme: dark) {
  .timecode-input__field {
    background: var(--color-background, #2d2d2d);
    color: var(--color-text-primary, #fff);
    border-color: var(--color-border, #555);
  }
  
  .timecode-input__field:disabled {
    background: var(--color-background-disabled, #1a1a1a);
    color: var(--color-text-disabled, #666);
  }
}

/* 减少动画支持 */
@media (prefers-reduced-motion: reduce) {
  .timecode-input__field {
    transition: none;
  }
}
</style>
