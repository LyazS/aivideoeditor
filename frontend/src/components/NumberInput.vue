<template>
  <div class="number-input-container" :class="{ 'with-controls': showControls }">
    <input
      :value="displayValue"
      @blur="handleConfirm"
      @keyup.enter="handleConfirm"
      @input="handleInput"
      type="number"
      :step="step"
      :min="min"
      :max="max"
      :placeholder="placeholder"
      :style="inputStyle"
      class="number-input"
    />
    <div v-if="showControls" class="number-controls">
      <button @click="handleIncrement" class="number-btn number-btn-up">▲</button>
      <button @click="handleDecrement" class="number-btn number-btn-down">▼</button>
    </div>
    <span v-if="unit" class="number-unit">{{ unit }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  /** 当前值 */
  modelValue: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步长 */
  step?: number
  /** 小数位数 */
  precision?: number
  /** 是否显示上下控制按钮 */
  showControls?: boolean
  /** 占位符 */
  placeholder?: string
  /** 单位文本 */
  unit?: string
  /** 输入框自定义样式 */
  inputStyle?: Record<string, any>
  /** 是否实时更新（input事件），否则只在确认时更新 */
  realtime?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  min: undefined,
  max: undefined,
  step: 1,
  precision: undefined,
  showControls: true,
  placeholder: '',
  unit: '',
  inputStyle: () => ({}),
  realtime: false
})

const emit = defineEmits<Emits>()

// 临时输入值（用于非实时模式）
const tempValue = ref<string>('')
const isEditing = ref(false)

// 显示值
const displayValue = computed(() => {
  if (isEditing.value) {
    return tempValue.value
  }
  
  if (props.precision !== undefined) {
    return props.modelValue.toFixed(props.precision)
  }
  
  return props.modelValue.toString()
})

// 格式化数值
const formatValue = (value: number): number => {
  let formatted = value
  
  // 应用范围限制
  if (props.min !== undefined) {
    formatted = Math.max(props.min, formatted)
  }
  if (props.max !== undefined) {
    formatted = Math.min(props.max, formatted)
  }
  
  // 应用精度
  if (props.precision !== undefined) {
    formatted = parseFloat(formatted.toFixed(props.precision))
  }
  
  return formatted
}

// 处理输入
const handleInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  tempValue.value = input.value
  isEditing.value = true
  
  if (props.realtime) {
    const value = parseFloat(input.value)
    if (!isNaN(value)) {
      const formatted = formatValue(value)
      emit('update:modelValue', formatted)
      emit('change', formatted)
    }
  }
}

// 处理确认（失焦或回车）
const handleConfirm = (event: Event) => {
  const input = event.target as HTMLInputElement
  const value = parseFloat(input.value)
  
  isEditing.value = false
  tempValue.value = ''
  
  if (!isNaN(value)) {
    const formatted = formatValue(value)
    emit('update:modelValue', formatted)
    emit('change', formatted)
  }
}

// 处理增加
const handleIncrement = () => {
  const newValue = formatValue(props.modelValue + props.step)
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

// 处理减少
const handleDecrement = () => {
  const newValue = formatValue(props.modelValue - props.step)
  emit('update:modelValue', newValue)
  emit('change', newValue)
}
</script>

<style scoped>
.number-input-container {
  display: flex;
  align-items: stretch;
  position: relative;
  border-radius: 3px;
  overflow: hidden;
}

.number-input {
  background: #444;
  border: 1px solid #666;
  color: #fff;
  font-size: 12px;
  padding: 4px 6px;
  flex: 1;
  min-width: 0;
  border-radius: 3px;
}

.with-controls .number-input {
  border-radius: 3px 0 0 3px;
  border-right: none;
}

.number-input:focus {
  outline: none;
  border-color: #4caf50;
}

/* 隐藏默认的数字输入框箭头 */
.number-input::-webkit-outer-spin-button,
.number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input[type='number'] {
  -moz-appearance: textfield;
}

/* 控制按钮 */
.number-controls {
  display: flex;
  flex-direction: column;
  width: 18px;
  flex-shrink: 0;
}

.number-btn {
  background: #555;
  border: 1px solid #666;
  border-left: none;
  color: #fff;
  cursor: pointer;
  font-size: 8px;
  line-height: 1;
  padding: 0;
  width: 100%;
  height: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  flex: 1;
}

.number-btn:hover {
  background: #666;
}

.number-btn:active {
  background: #777;
}

.number-btn-up {
  border-radius: 0 3px 0 0;
  border-bottom: 0.5px solid #444;
}

.number-btn-down {
  border-radius: 0 0 3px 0;
  border-top: 0.5px solid #444;
}

/* 单位文本 */
.number-unit {
  font-size: 12px;
  color: #999;
  margin-left: 6px;
  white-space: nowrap;
  align-self: center;
}
</style>
