/**
 * 文本时间轴工具函数
 * 提供文本项目创建、管理和操作的工具函数
 */

import { markRaw } from 'vue'
import type { TextTimelineItem, TextMediaConfig, TextStyleConfig, ImageTimeRange } from '../types'
import { TextVisibleSprite } from './TextVisibleSprite'
import { TextHelper } from './TextHelper'

/**
 * 生成唯一的时间轴项目ID
 * @returns 唯一ID字符串
 */
export function generateTimelineItemId(): string {
  return `timeline-item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 创建文本时间轴项目
 * 
 * @param text 文本内容
 * @param style 文本样式配置（可选）
 * @param startTimeFrames 开始时间（帧数）
 * @param trackId 轨道ID
 * @param duration 显示时长（帧数），默认使用TextVisibleSprite.DEFAULT_DURATION
 * @returns Promise<TextTimelineItem>
 */
export async function createTextTimelineItem(
  text: string,
  style: Partial<TextStyleConfig> = {},
  startTimeFrames: number,
  trackId: string,
  duration: number = TextVisibleSprite.DEFAULT_DURATION
): Promise<TextTimelineItem> {
  try {
    console.log('🎨 [textTimelineUtils] 开始创建文本时间轴项目:', {
      text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
      style,
      startTimeFrames,
      trackId,
      duration
    })

    // 1. 创建文本精灵
    const textSprite = await TextVisibleSprite.create(text, style)
    
    // 2. 设置时间范围
    textSprite.setTimelineStartTime(startTimeFrames)
    textSprite.setDisplayDuration(duration)
    
    // 3. 设置默认位置（画布中心）
    textSprite.rect.x = 400  // 画布宽度的一半
    textSprite.rect.y = 300  // 画布高度的一半
    
    // 4. 获取文本渲染后的尺寸
    const textMeta = await textSprite.getTextMeta()
    
    // 5. 创建时间轴项目
    const timelineItem: TextTimelineItem = {
      id: generateTimelineItemId(),
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId,
      mediaType: 'text',
      timeRange: textSprite.getTimeRange(),
      sprite: markRaw(textSprite),
      config: {
        text,
        style: textSprite.getTextStyle(),
        x: textSprite.rect.x,
        y: textSprite.rect.y,
        width: textMeta.width,
        height: textMeta.height,
        opacity: textSprite.getOpacityValue(),
        rotation: textSprite.rect.angle,
        zIndex: textSprite.zIndex,
      }
    }
    
    console.log('✅ [textTimelineUtils] 文本时间轴项目创建成功:', {
      id: timelineItem.id,
      textMeta,
      timeRange: timelineItem.timeRange
    })
    
    return timelineItem
  } catch (error) {
    console.error('❌ [textTimelineUtils] 创建文本时间轴项目失败:', error)
    throw new Error(`创建文本时间轴项目失败: ${(error as Error).message}`)
  }
}

/**
 * 创建默认文本项目
 * 使用预设的默认值快速创建文本项目
 * 
 * @param trackId 轨道ID
 * @param startTimeFrames 开始时间（帧数）
 * @returns Promise<TextTimelineItem>
 */
export async function createDefaultTextItem(
  trackId: string,
  startTimeFrames: number
): Promise<TextTimelineItem> {
  return createTextTimelineItem(
    '点击编辑文本',  // 默认文本内容
    { fontSize: 48, color: '#ffffff' },  // 默认样式
    startTimeFrames,
    trackId,
    TextVisibleSprite.DEFAULT_DURATION
  )
}

/**
 * 更新文本项目的配置
 * 
 * @param timelineItem 要更新的文本时间轴项目
 * @param newConfig 新的配置
 * @returns 更新后的配置
 */
export function updateTextItemConfig(
  timelineItem: TextTimelineItem,
  newConfig: Partial<TextMediaConfig>
): TextMediaConfig {
  const updatedConfig: TextMediaConfig = {
    ...timelineItem.config,
    ...newConfig
  }
  
  // 更新时间轴项目的配置
  timelineItem.config = updatedConfig
  
  console.log('🔄 [textTimelineUtils] 文本项目配置已更新:', {
    id: timelineItem.id,
    updatedFields: Object.keys(newConfig),
    newConfig: updatedConfig
  })
  
  return updatedConfig
}

/**
 * 从文本精灵同步配置到时间轴项目
 * 
 * @param timelineItem 文本时间轴项目
 * @param textSprite 文本精灵
 */
export async function syncConfigFromSprite(
  timelineItem: TextTimelineItem,
  textSprite: TextVisibleSprite
): Promise<void> {
  try {
    // 获取文本渲染后的尺寸
    const textMeta = await textSprite.getTextMeta()
    
    // 同步配置
    const syncedConfig: TextMediaConfig = {
      text: textSprite.getText(),
      style: textSprite.getTextStyle(),
      x: textSprite.rect.x,
      y: textSprite.rect.y,
      width: textMeta.width,
      height: textMeta.height,
      originalWidth: textMeta.width, // 保存原始尺寸
      originalHeight: textMeta.height, // 保存原始尺寸
      opacity: textSprite.getOpacityValue(),
      rotation: textSprite.rect.angle,
      zIndex: textSprite.zIndex,
    }
    
    // 更新时间轴项目配置
    timelineItem.config = syncedConfig
    timelineItem.timeRange = textSprite.getTimeRange()
    
    console.log('🔄 [textTimelineUtils] 配置已从精灵同步到时间轴项目:', {
      id: timelineItem.id,
      syncedConfig
    })
  } catch (error) {
    console.error('❌ [textTimelineUtils] 同步配置失败:', error)
    throw error
  }
}

/**
 * 验证文本时间轴项目
 * 
 * @param timelineItem 要验证的时间轴项目
 * @returns 验证结果
 */
export function validateTextTimelineItem(timelineItem: any): timelineItem is TextTimelineItem {
  if (!timelineItem || typeof timelineItem !== 'object') {
    return false
  }
  
  // 检查必需的属性
  const requiredProps = ['id', 'mediaType', 'trackId', 'config', 'sprite', 'timeRange']
  for (const prop of requiredProps) {
    if (!(prop in timelineItem)) {
      console.warn(`[textTimelineUtils] 缺少必需属性: ${prop}`)
      return false
    }
  }
  
  // 检查媒体类型
  if (timelineItem.mediaType !== 'text') {
    console.warn(`[textTimelineUtils] 媒体类型不匹配: ${timelineItem.mediaType}`)
    return false
  }
  
  // 检查配置对象
  const config = timelineItem.config
  if (!config || typeof config !== 'object') {
    console.warn('[textTimelineUtils] 配置对象无效')
    return false
  }
  
  // 检查文本配置的必需属性
  const requiredConfigProps = ['text', 'style', 'x', 'y', 'width', 'height', 'opacity', 'rotation', 'zIndex']
  for (const prop of requiredConfigProps) {
    if (!(prop in config)) {
      console.warn(`[textTimelineUtils] 配置缺少必需属性: ${prop}`)
      return false
    }
  }
  
  return true
}

/**
 * 创建文本项目的数据快照
 * 用于命令模式中保存状态
 * 
 * @param timelineItem 文本时间轴项目
 * @returns 数据快照
 */
export function createTextItemSnapshot(timelineItem: TextTimelineItem) {
  return {
    id: timelineItem.id,
    mediaItemId: timelineItem.mediaItemId,
    trackId: timelineItem.trackId,
    mediaType: timelineItem.mediaType,
    timeRange: { ...timelineItem.timeRange },
    config: { 
      ...timelineItem.config,
      style: { ...timelineItem.config.style }
    },
    thumbnailUrl: timelineItem.thumbnailUrl
  }
}

/**
 * 文本项目类型守卫
 * 
 * @param item 要检查的项目
 * @returns 是否为文本项目
 */
export function isTextTimelineItem(item: any): item is TextTimelineItem {
  return item && item.mediaType === 'text' && validateTextTimelineItem(item)
}
