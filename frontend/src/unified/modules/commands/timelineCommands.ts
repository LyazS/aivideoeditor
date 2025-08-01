/**
 * 统一架构下的时间轴命令实现
 * 基于"核心数据与行为分离"的响应式重构版本
 *
 * 主要变化：
 * 1. 使用 UnifiedTimelineItemData 替代原有的 LocalTimelineItem 和 AsyncProcessingTimelineItem
 * 2. 使用 UnifiedMediaItemData 替代原有的 LocalMediaItem 和 AsyncProcessingMediaItem
 * 3. 使用 UnifiedTrackData 替代原有的 Track 类型
 * 4. 使用统一的状态管理系统（3状态：ready|loading|error）
 * 5. 保持与原有命令相同的API接口，便于迁移
 * 6. 将所有命令类拆分为独立文件，提高代码可维护性
 */

// 导出所有命令类
export { AddTimelineItemCommand } from './AddTimelineItemCommand'
export { RemoveTimelineItemCommand } from './RemoveTimelineItemCommand'
export { MoveTimelineItemCommand } from './MoveTimelineItemCommand'
export { UpdateTransformCommand } from './UpdateTransformCommand'
export { DuplicateTimelineItemCommand } from './DuplicateTimelineItemCommand'
export { SplitTimelineItemCommand } from './SplitTimelineItemCommand'
export { AddTrackCommand } from './AddTrackCommand'
export { RenameTrackCommand } from './RenameTrackCommand'
export { RemoveTrackCommand } from './RemoveTrackCommand'
export { ToggleTrackVisibilityCommand } from './ToggleTrackVisibilityCommand'
export { ToggleTrackMuteCommand } from './ToggleTrackMuteCommand'
export { ResizeTimelineItemCommand } from './ResizeTimelineItemCommand'
export { SelectTimelineItemsCommand } from './SelectTimelineItemsCommand'

// 导出类型定义
export type { SimpleCommand } from './types'
