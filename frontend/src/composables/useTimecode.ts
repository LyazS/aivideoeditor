/**
 * Vue组合式函数：时间码操作
 * 提供响应式的时间码状态管理和操作
 */

import { ref, computed } from 'vue'
import { Timecode } from '../utils/Timecode'

// 定义TimecodeInput类型
type TimecodeInput = number | string | Timecode

// 简化的时间码创建函数
function createTimecode(value: TimecodeInput, frameRate: number): Timecode {
  if (typeof value === 'number') {
    return Timecode.fromSeconds(value, frameRate)
  } else if (typeof value === 'string') {
    return Timecode.fromString(value, frameRate)
  } else {
    return value
  }
}

// ==================== 基础时间码组合函数 ====================

/**
 * 创建响应式时间码
 */
export function useTimecode(initialValue: TimecodeInput = 0, frameRate: number = 30) {
  const timecodeRef = ref(createTimecode(initialValue, frameRate))

  // 计算属性
  const totalFrames = computed(() => timecodeRef.value.totalFrames)
  const seconds = computed(() => timecodeRef.value.toSeconds())
  const microseconds = computed(() => timecodeRef.value.toMicroseconds())
  const components = computed(() => timecodeRef.value.components)
  const isZero = computed(() => timecodeRef.value.isZero())

  // 格式化方法
  const toString = () => {
    return timecodeRef.value.toString()
  }

  // 设置方法
  const setValue = (value: TimecodeInput) => {
    timecodeRef.value = createTimecode(value, frameRate)
  }

  const setFromSeconds = (seconds: number) => {
    timecodeRef.value = Timecode.fromSeconds(seconds, frameRate)
  }

  const setFromMicroseconds = (microseconds: number) => {
    timecodeRef.value = Timecode.fromMicroseconds(microseconds, frameRate)
  }

  const setFromString = (timecodeString: string) => {
    timecodeRef.value = Timecode.fromString(timecodeString, frameRate)
  }

  // 运算方法
  const add = (other: TimecodeInput) => {
    const otherTimecode = createTimecode(other, frameRate)
    timecodeRef.value = timecodeRef.value.add(otherTimecode)
  }

  const subtract = (other: TimecodeInput) => {
    const otherTimecode = createTimecode(other, frameRate)
    timecodeRef.value = timecodeRef.value.subtract(otherTimecode)
  }

  const multiply = (factor: number) => {
    timecodeRef.value = timecodeRef.value.multiply(factor)
  }

  const divide = (divisor: number) => {
    timecodeRef.value = timecodeRef.value.divide(divisor)
  }

  // 重置方法
  const reset = () => {
    timecodeRef.value = Timecode.zero(frameRate)
  }

  return {
    // 响应式状态
    timecode: timecodeRef,
    totalFrames,
    seconds,
    microseconds,
    components,
    isZero,

    // 格式化
    toString,

    // 设置方法
    setValue,
    setFromSeconds,
    setFromMicroseconds,
    setFromString,

    // 运算方法
    add,
    subtract,
    multiply,
    divide,
    reset
  }
}

// ==================== 时间码范围组合函数 ====================

/**
 * 简化的时间码范围管理
 */
export function useTimecodeRange(
  startValue: TimecodeInput = 0,
  endValue: TimecodeInput = 0,
  frameRate: number = 30
) {
  const start = useTimecode(startValue, frameRate)
  const end = useTimecode(endValue, frameRate)

  // 计算属性
  const duration = computed(() => {
    const endSeconds = end.timecode.value.toSeconds()
    const startSeconds = start.timecode.value.toSeconds()
    return Timecode.fromSeconds(Math.max(0, endSeconds - startSeconds), frameRate)
  })

  const isValid = computed(() => {
    return start.timecode.value.toSeconds() <= end.timecode.value.toSeconds()
  })

  const setRange = (startValue: TimecodeInput, endValue: TimecodeInput) => {
    start.setValue(startValue)
    end.setValue(endValue)
  }

  return {
    start,
    end,
    duration,
    isValid,
    setRange
  }
}

// ==================== WebAV集成组合函数 ====================

/**
 * WebAV时间同步
 */
export function useWebAVTimecode(
  frameRate: number = 30,
  onTimeChange?: (timecode: Timecode) => void
) {
  const currentTime = useTimecode(0, frameRate)

  // 从WebAV更新时间
  const updateFromWebAV = (microseconds: number) => {
    currentTime.setFromMicroseconds(microseconds)
    if (onTimeChange) {
      // 创建一个新的Timecode实例传递给回调
      const timecodeInstance = Timecode.fromMicroseconds(microseconds, frameRate)
      onTimeChange(timecodeInstance)
    }
  }

  // 转换为WebAV格式
  const toWebAVSeconds = () => {
    return currentTime.seconds.value
  }

  const toWebAVMicroseconds = () => {
    return currentTime.microseconds.value
  }

  return {
    currentTime,
    updateFromWebAV,
    toWebAVSeconds,
    toWebAVMicroseconds
  }
}




