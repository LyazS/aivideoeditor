/**
 * 关键帧命令模块入口文件
 * 统一导出所有关键帧命令类和相关工具
 * 适配新架构的统一类型系统
 */

// 导出所有命令类
export { CreateKeyframeCommand } from './CreateKeyframeCommand'
export { DeleteKeyframeCommand } from './DeleteKeyframeCommand'
export { UpdatePropertyCommand } from './UpdatePropertyCommand'
export { ClearAllKeyframesCommand } from './ClearAllKeyframesCommand'
export { ToggleKeyframeCommand } from './ToggleKeyframeCommand'

// 导出共享的类型和工具函数
export type {
  KeyframeSnapshot,
  TimelineModule,
  WebAVAnimationManager,
  PlaybackControls,
} from './shared'

export {
  generateCommandId,
  createSnapshot,
  applyKeyframeSnapshot,
  isPlayheadInTimelineItem,
  showUserWarning,
} from './shared'