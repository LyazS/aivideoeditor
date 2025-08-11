/**
 * 统一时间轴项目模块入口
 * 基于"核心数据 + 行为分离"的响应式重构版本
 */

// ==================== 类型定义导出 ====================
export type {
  // 核心数据类型
  UnifiedTimelineItemData,
  TimelineItemStatus,
  TransformData,
  CreateTimelineItemOptions,
  UnknownMediaConfig,
  KnownTimelineItem,
  UnknownTimelineItem,
} from './TimelineItemData'

// 从mediaitem模块导入MediaType
export type { MediaType } from '../mediaitem'

// ==================== 常量导出 ====================
export { VALID_TIMELINE_TRANSITIONS, MEDIA_TO_TIMELINE_STATUS_MAP } from './TimelineItemData'

// ==================== 工厂函数导出 ====================
export {
  // 工厂函数集合
  TimelineItemFactory,
} from './TimelineItemFactory'

// ==================== 状态显示工具导出 ====================
export {
  // 状态显示工具类
  TimelineStatusDisplayUtils,
  createStatusDisplayComputeds,
} from './TimelineStatusDisplayUtils'

// 状态显示类型导出
export type { StatusDisplayInfo } from './TimelineStatusDisplayUtils'

// ==================== 行为函数导出 ====================
export {
  // 状态查询函数
  canTransitionTo,

  // 时间范围操作函数
  updateTimeRange,
  moveTimelineItem,
  resizeTimelineItem,

  // 类型转换函数
} from './TimelineItemBehaviors'

// 从 TimelineItemBehaviors 导出的状态查询函数（避免与 TimelineItemQueries 冲突）
export {
  isReady as isReadyBehavior,
  isLoading as isLoadingBehavior,
  hasError as hasErrorBehavior,
  getDuration as getDurationBehavior,
  hasValidTimeRange as hasValidTimeRangeBehavior,
} from './TimelineItemBehaviors'

// ==================== 查询工具导出 ====================
export {
  // 类型守卫函数
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  hasVisualProperties,
  hasAudioProperties,

  // 状态查询（主要使用这些）
  isReady,
  isLoading,
  hasError,
  getStatusText,
  getProgressInfo,
  getErrorInfo,

  // 时间查询
  getDuration,
  getDurationInSeconds,
  hasValidTimeRange,
  containsTime,
  getTimelinePosition,

  // 配置查询
  getTransform,
  getOpacity,
  getVolume,
  isMuted,
  getVideoClip,

  // 批量查询
  filterByStatus,
  filterByTrack,
  filterByMediaType,
  sortByTime,
  findItemsAtTime,
  findOverlappingItems,
  getTrackTimeStats,

  // 查询工具集合
  TimelineItemQueries,
} from './TimelineItemQueries'

// ==================== 管理器导出 ====================
// TimelineMediaSyncManager 已删除，因为未被使用

// ==================== 便捷使用示例 ====================

/**
 * 使用示例：创建视频时间轴项目
 *
 * ```typescript
 * import { createVideoTimelineItem } from '@/unified/timelineitem'
 *
 * // 创建视频时间轴项目
 * const videoItem = createVideoTimelineItem({
 *   mediaItemId: 'media-123',
 *   trackId: 'video-track-1',
 *   timeRange: { timelineStartTime: 0, timelineEndTime: 300 },
 *   name: '我的视频',
 *   clipStartTime: 30,
 *   clipEndTime: 330
 * })
 *
 * // 状态转换
 * videoItem.timelineStatus = 'ready' // 直接设置状态
 *
 * // 查询状态
 * console.log(isReady(videoItem)) // true
 * console.log(getDuration(videoItem)) // 300
 * ```
 */

/**
 * 使用示例：状态同步管理
 *
 * 注意：TimelineMediaSyncManager 和 transitionTimelineStatus 函数已删除，因为未被使用
 * 如果需要状态转换功能，请直接修改 timelineStatus 属性
 */

/**
 * 使用示例：Vue组件中的响应式使用
 *
 * ```vue
 * <template>
 *   <div class="timeline-item" :class="statusClass">
 *     <span>{{ statusText }}</span>
 *     <div v-if="progressInfo.hasProgress" class="progress">
 *       {{ progressInfo.text }}
 *     </div>
 *   </div>
 * </template>
 *
 * <script setup lang="ts">
 * import { computed } from 'vue'
 * import { getStatusText, getProgressInfo, type UnifiedTimelineItemData } from '@/unified/timelineitem'
 *
 * const props = defineProps<{ data: UnifiedTimelineItemData }>()
 *
 * // 计算属性自动响应数据变化
 * const statusClass = computed(() => `status-${props.data.timelineStatus}`)
 * const statusText = computed(() => getStatusText(props.data))
 * const progressInfo = computed(() => getProgressInfo(props.data))
 * </script>
 * ```
 */

// ==================== 默认导出 ====================

// 导入所有需要的函数和对象用于默认导出
import { TimelineItemFactory } from './TimelineItemFactory'

import {
  canTransitionTo,
  updateTimeRange,
  moveTimelineItem,
  resizeTimelineItem,
} from './TimelineItemBehaviors'

import {
  isKnownTimelineItem,
  isUnknownTimelineItem,
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  hasVisualProperties,
  hasAudioProperties,
  isReady,
  isLoading,
  hasError,
  getDuration,
  hasValidTimeRange,
  getStatusText,
  getProgressInfo,
  getErrorInfo,
  filterByStatus,
  filterByTrack,
  sortByTime,
} from './TimelineItemQueries'

import {
  TimelineStatusDisplayUtils,
  createStatusDisplayComputeds,
} from './TimelineStatusDisplayUtils'
import type { UnifiedTimelineItemData } from './TimelineItemData'
import type { MediaType } from '../mediaitem'

/**
 * 默认导出：统一时间轴项目工具集合
 */
export default {
  // 工厂函数
  Factory: {
    create: TimelineItemFactory.createUnknown,
    createVideo: TimelineItemFactory.createVideo,
    createAudio: TimelineItemFactory.createAudio,
    createImage: TimelineItemFactory.createImage,
    clone: TimelineItemFactory.clone,
    duplicate: TimelineItemFactory.duplicate,
    validate: TimelineItemFactory.validate,
  },

  // 行为函数
  Behaviors: {
    canTransition: canTransitionTo,

    // 时间范围操作
    updateTimeRange,
    moveItem: moveTimelineItem,
    resizeItem: resizeTimelineItem,

  },

  // 查询函数
  Queries: {
    // 类型守卫
    isKnownTimelineItem,
    isUnknownTimelineItem,
    isVideoTimelineItem,
    isImageTimelineItem,
    isAudioTimelineItem,
    isTextTimelineItem,
    hasVisualProperties,
    hasAudioProperties,

    // 状态查询
    isReady,
    isLoading,
    hasError,
    canPlay: (data: UnifiedTimelineItemData<MediaType>) =>
      isReady(data) && hasValidTimeRange(data),
    getDuration,
    getStatusText,
    getProgressInfo,
    getErrorInfo,
    filterByStatus,
    filterByTrack,
    sortByTime,
  },

  // 工具类
  Utils: {
    Display: TimelineStatusDisplayUtils, // 状态显示工具
    createStatusComputeds: createStatusDisplayComputeds,
  },

  // 管理器
  // Managers: {
  //   MediaSync: TimelineMediaSyncManager, // 已删除，因为未被使用
  // },
}
