/**
 * Vue组合式函数：时间码操作
 * 提供响应式的时间码状态管理和操作
 */

import { ref, computed, watch } from 'vue'
import { Timecode, type TimecodeInput } from '../types/Timecode'
import { timecode, formatTimecode, type TimecodeFormatOptions } from '../utils/TimecodeHelpers'

// ==================== 基础时间码组合函数 ====================

/**
 * 创建响应式时间码
 */
export function useTimecode(initialValue: TimecodeInput = 0, frameRate: number = 30) {
  const timecodeRef = ref(timecode(initialValue, frameRate))

  // 计算属性
  const totalFrames = computed(() => timecodeRef.value.totalFrames)
  const seconds = computed(() => timecodeRef.value.toSeconds())
  const microseconds = computed(() => timecodeRef.value.toMicroseconds())
  const components = computed(() => timecodeRef.value.components)
  const isZero = computed(() => timecodeRef.value.isZero())

  // 格式化方法
  const toString = (options?: TimecodeFormatOptions) => {
    return options ? formatTimecode(timecodeRef.value, options) : timecodeRef.value.toString()
  }

  // 设置方法
  const setValue = (value: TimecodeInput) => {
    timecodeRef.value = timecode(value, frameRate)
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
    const otherTimecode = timecode(other, frameRate)
    timecodeRef.value = timecodeRef.value.add(otherTimecode)
  }

  const subtract = (other: TimecodeInput) => {
    const otherTimecode = timecode(other, frameRate)
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
 * 时间码范围管理
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
    return end.timecode.value.subtract(start.timecode.value)
  })

  const isValid = computed(() => {
    return !start.timecode.value.greaterThan(end.timecode.value)
  })

  // 方法
  const contains = (tc: TimecodeInput): boolean => {
    const testTimecode = timecode(tc, frameRate)
    return testTimecode.greaterThan(start.timecode.value) && 
           testTimecode.lessThan(end.timecode.value)
  }

  const containsInclusive = (tc: TimecodeInput): boolean => {
    const testTimecode = timecode(tc, frameRate)
    return !testTimecode.lessThan(start.timecode.value) && 
           !testTimecode.greaterThan(end.timecode.value)
  }

  const clamp = (tc: TimecodeInput): Timecode => {
    const testTimecode = timecode(tc, frameRate)
    if (testTimecode.lessThan(start.timecode.value)) return start.timecode.value.clone()
    if (testTimecode.greaterThan(end.timecode.value)) return end.timecode.value.clone()
    return testTimecode.clone()
  }

  const setRange = (startValue: TimecodeInput, endValue: TimecodeInput) => {
    start.setValue(startValue)
    end.setValue(endValue)
  }

  return {
    start,
    end,
    duration,
    isValid,
    contains,
    containsInclusive,
    clamp,
    setRange
  }
}

// ==================== 时间码输入组合函数 ====================

/**
 * 时间码输入处理
 */
export function useTimecodeInput(
  initialValue: TimecodeInput = 0,
  frameRate: number = 30,
  options: {
    validateOnInput?: boolean
    autoFormat?: boolean
  } = {}
) {
  const { validateOnInput = true, autoFormat = true } = options

  const timecodeState = useTimecode(initialValue, frameRate)
  const inputValue = ref(timecodeState.toString())
  const isValid = ref(true)
  const errorMessage = ref('')

  // 监听时间码变化，更新输入值
  watch(
    () => timecodeState.timecode.value,
    (newTimecode) => {
      if (autoFormat) {
        inputValue.value = newTimecode.toString()
      }
    }
  )

  // 验证输入
  const validateInput = (value: string): boolean => {
    try {
      Timecode.fromString(value, frameRate)
      isValid.value = true
      errorMessage.value = ''
      return true
    } catch (error) {
      isValid.value = false
      errorMessage.value = (error as Error).message
      return false
    }
  }

  // 处理输入变化
  const handleInput = (value: string) => {
    inputValue.value = value

    if (validateOnInput) {
      if (validateInput(value)) {
        timecodeState.setFromString(value)
      }
    }
  }

  // 提交输入（用于失去焦点时）
  const commitInput = () => {
    if (validateInput(inputValue.value)) {
      timecodeState.setFromString(inputValue.value)
      if (autoFormat) {
        inputValue.value = timecodeState.toString()
      }
    } else {
      // 恢复到有效值
      inputValue.value = timecodeState.toString()
    }
  }

  return {
    ...timecodeState,
    inputValue,
    isValid,
    errorMessage,
    handleInput,
    commitInput,
    validateInput
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
    onTimeChange?.(currentTime.timecode.value)
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

// ==================== 时间码列表管理 ====================

/**
 * 时间码列表管理
 */
export function useTimecodeList(frameRate: number = 30) {
  const timecodes = ref<Timecode[]>([])

  const add = (tc: TimecodeInput) => {
    timecodes.value.push(timecode(tc, frameRate))
  }

  const remove = (index: number) => {
    if (index >= 0 && index < timecodes.value.length) {
      timecodes.value.splice(index, 1)
    }
  }

  const clear = () => {
    timecodes.value = []
  }

  const sort = () => {
    timecodes.value.sort((a, b) => a.compare(b))
  }

  const total = computed(() => {
    return timecodes.value.reduce(
      (sum, tc) => sum.add(tc),
      Timecode.zero(frameRate)
    )
  })

  const count = computed(() => timecodes.value.length)

  return {
    timecodes,
    add,
    remove,
    clear,
    sort,
    total,
    count
  }
}
