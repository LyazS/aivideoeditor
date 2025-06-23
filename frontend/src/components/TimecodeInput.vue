<template>
  <div class="timecode-input">
    <input
      ref="inputRef"
      v-model="displayValue"
      type="text"
      :placeholder="placeholder"
      :class="{ 'error': hasError }"
      @input="handleInput"
      @blur="handleBlur"
      @focus="handleFocus"
      @keydown="handleKeydown"
    />
    <div v-if="hasError" class="error-message">{{ errorMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { 
  timecodeStringToMicroseconds, 
  microsecondsToTimecodeString,
  parseTimecode 
} from '../stores/utils/storeUtils'

interface Props {
  /** 当前时间值（微秒） */
  modelValue: number
  /** 占位符文本 */
  placeholder?: string
  /** 帧率 */
  frameRate?: number
  /** 是否禁用 */
  disabled?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '00:00.00',
  frameRate: 30,
  disabled: false
})

const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement>()
const displayValue = ref('')
const hasError = ref(false)
const errorMessage = ref('')
const isFocused = ref(false)

// 将微秒值转换为时间码字符串显示
const updateDisplayValue = () => {
  if (!isFocused.value) {
    displayValue.value = microsecondsToTimecodeString(props.modelValue, props.frameRate)
  }
}

// 监听外部值变化
watch(() => props.modelValue, updateDisplayValue, { immediate: true })

// 处理输入
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  displayValue.value = target.value
  
  // 清除之前的错误状态
  hasError.value = false
  errorMessage.value = ''
}

// 处理失去焦点
const handleBlur = () => {
  isFocused.value = false
  validateAndEmit()
}

// 处理获得焦点
const handleFocus = () => {
  isFocused.value = true
}

// 处理键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    inputRef.value?.blur()
  } else if (event.key === 'Escape') {
    // 恢复原值
    updateDisplayValue()
    inputRef.value?.blur()
  }
}

// 验证并发送值
const validateAndEmit = () => {
  try {
    // 如果输入为空，设置为0
    if (!displayValue.value.trim()) {
      const newValue = 0
      emit('update:modelValue', newValue)
      emit('change', newValue)
      updateDisplayValue()
      return
    }

    // 尝试解析时间码
    const microseconds = timecodeStringToMicroseconds(displayValue.value, props.frameRate)
    
    // 验证成功，发送新值
    emit('update:modelValue', microseconds)
    emit('change', microseconds)
    
    // 更新显示值为标准格式
    updateDisplayValue()
    
  } catch (error) {
    // 解析失败，显示错误
    hasError.value = true
    errorMessage.value = (error as Error).message
    
    // 延迟恢复原值
    setTimeout(() => {
      updateDisplayValue()
      hasError.value = false
      errorMessage.value = ''
    }, 2000)
  }
}

// 暴露方法给父组件
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select()
})
</script>

<style scoped>
.timecode-input {
  position: relative;
  display: inline-block;
}

.timecode-input input {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  text-align: center;
  min-width: 80px;
  background: #fff;
  transition: border-color 0.2s;
}

.timecode-input input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.timecode-input input.error {
  border-color: #e74c3c;
  background-color: #fdf2f2;
}

.timecode-input input:disabled {
  background-color: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.error-message {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #e74c3c;
  color: white;
  padding: 4px 8px;
  border-radius: 0 0 4px 4px;
  font-size: 12px;
  z-index: 10;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 深色主题支持 */
@media (prefers-color-scheme: dark) {
  .timecode-input input {
    background: #2d2d2d;
    border-color: #555;
    color: #fff;
  }
  
  .timecode-input input:focus {
    border-color: #007acc;
  }
  
  .timecode-input input.error {
    border-color: #e74c3c;
    background-color: #3d2d2d;
  }
  
  .timecode-input input:disabled {
    background-color: #1a1a1a;
    color: #666;
  }
}
</style>
