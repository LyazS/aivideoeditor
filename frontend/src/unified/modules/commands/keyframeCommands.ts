/**
 * 统一关键帧命令模块（兼容性导出）
 * 为了保持向后兼容性，重新导出所有关键帧命令
 * 适配新架构的统一类型系统
 */

// 从拆分的模块中重新导出所有命令
export {
  CreateKeyframeCommand,
  DeleteKeyframeCommand,
  UpdatePropertyCommand,
  ClearAllKeyframesCommand,
  ToggleKeyframeCommand,
  type KeyframeSnapshot,
  type TimelineModule,
  type WebAVAnimationManager,
  type PlaybackControls,
  generateCommandId,
  createSnapshot,
  applyKeyframeSnapshot,
  isPlayheadInTimelineItem,
  showUserWarning,
} from './keyframes'

// 导出便捷工具函数
export * from '@/unified/utils/keyframeCommandUtils'