/**
 * 时间码组件导出文件
 *
 * 提供统一的时间码组件和工具导入入口
 */

// 导出时间码组件
export { default as TimecodeInput } from './TimecodeInput.vue'

// 导出时间码工具类
export { Timecode, type TimecodeInput as TimecodeInputType, type TimecodeComponents } from '@/utils/Timecode'
export { TimecodeUtils } from '@/utils/TimecodeUtils'

// 导出便捷的时间转换函数
export { 
  secondsToTimecodeString, 
  timecodeStringToSeconds 
} from '@/stores/utils/timeUtils'

// 类型定义
export interface TimecodeInputProps {
  modelValue: number
  frameRate?: number
  placeholder?: string
  disabled?: boolean
  showHint?: boolean
  customHint?: string
  autoFormat?: boolean
  maxValue?: number
  minValue?: number
}

// 常用的时间码格式常量
export const TIMECODE_FORMATS = {
  STANDARD: 'HH:MM:SS.FF',
  SHORT: 'MM:SS.FF',
  FRAMES_ONLY: 'FF',
  SECONDS_ONLY: 'SS'
} as const

// 常用帧率常量
export const FRAME_RATES = {
  FILM: 24,
  PAL: 25,
  NTSC: 30,
  HIGH_FPS: 60
} as const

// 时间码验证正则表达式
export const TIMECODE_PATTERNS = {
  FULL: /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{2})$/,
  SHORT: /^(\d{1,2}):(\d{2})\.(\d{2})$/
} as const
