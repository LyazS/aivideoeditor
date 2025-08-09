/**
 * 关键帧命令共享工具函数和类型定义
 * 适配新架构的统一类型系统
 */

import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData'
import { generateCommandId as generateId } from '../../../../utils/idGenerator'
import { isPlayheadInTimelineItem as checkPlayheadInTimelineItem } from '../../../utils/timelineSearchUtils'
import { cloneDeep } from 'lodash'

// ==================== 关键帧数据快照接口 ====================

/**
 * 类型安全的关键帧状态快照
 * 用于保存和恢复关键帧的完整状态
 */
export interface KeyframeSnapshot {
  /** 动画配置的完整快照 */
  animationConfig: any
  /** 时间轴项目的属性快照 */
  itemProperties: any
}

// ==================== 通用接口定义 ====================

/**
 * 时间轴模块接口
 */
export interface TimelineModule {
  getTimelineItem: (id: string) => UnifiedTimelineItemData | undefined
}

/**
 * WebAV动画管理器接口
 */
export interface WebAVAnimationManager {
  updateWebAVAnimation: (item: UnifiedTimelineItemData) => Promise<void>
}

/**
 * 播放控制接口
 */
export interface PlaybackControls {
  seekTo: (frame: number) => void
}

// ==================== 通用工具函数 ====================

/**
 * 生成命令ID
 */
export function generateCommandId(): string {
  return generateId()
}

/**
 * 创建状态快照
 */
export function createSnapshot(item: UnifiedTimelineItemData): KeyframeSnapshot {
  return {
    animationConfig: item.animation ? cloneDeep(item.animation) : undefined,
    itemProperties: cloneDeep(item.config),
  }
}

/**
 * 通用的状态快照应用函数
 * 适配新架构的数据流向：UI → WebAV → TimelineItem
 */
export async function applyKeyframeSnapshot(
  item: UnifiedTimelineItemData,
  snapshot: KeyframeSnapshot,
  webavAnimationManager: WebAVAnimationManager,
): Promise<void> {
  // 1. 恢复动画配置（关键帧数据）
  if (snapshot.animationConfig) {
    // 直接修改item的animation属性
    ;(item as any).animation = cloneDeep(snapshot.animationConfig)
  } else {
    ;(item as any).animation = undefined
  }

  // 2. 恢复属性值
  if (snapshot.itemProperties) {
    Object.assign(item.config, snapshot.itemProperties)
  }

  // 3. 更新WebAV动画配置
  await webavAnimationManager.updateWebAVAnimation(item)

  // 4. 触发渲染更新
  try {
    const { useUnifiedStore } = await import('../../../unifiedStore')
    const store = useUnifiedStore()
    store.seekToFrame(store.currentFrame)
  } catch (error) {
    console.warn('Failed to trigger render update:', error)
  }
}

/**
 * 检查播放头是否在时间轴项目范围内
 */
export function isPlayheadInTimelineItem(item: UnifiedTimelineItemData, frame: number): boolean {
  return checkPlayheadInTimelineItem(item, frame)
}

/**
 * 显示用户警告
 */
export async function showUserWarning(title: string, message: string): Promise<void> {
  try {
    const { useUnifiedStore } = await import('../../../unifiedStore')
    const store = useUnifiedStore()
    // 假设新架构有类似的警告方法
    if (typeof store.showWarning === 'function') {
      store.showWarning(title, message)
    } else {
      console.warn(`${title}: ${message}`)
    }
  } catch (error) {
    console.warn(`${title}: ${message}`)
  }
}