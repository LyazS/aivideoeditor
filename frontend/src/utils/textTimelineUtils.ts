import { markRaw, reactive } from 'vue'
import { TextVisibleSprite } from './TextVisibleSprite'
import { webavToProjectCoords } from './coordinateTransform'
import { generateId } from './idGenerator'
import type { TimelineItem, TextStyleConfig, TextMediaConfig } from '../types'
import { DEFAULT_TEXT_STYLE } from '../types'

/**
 * 文本时间轴工具函数
 * 提供文本项目的创建、管理和操作功能
 */

/**
 * 生成时间轴项目ID
 * 复用现有的ID生成逻辑
 * @returns 唯一的时间轴项目ID
 */
export function generateTimelineItemId(): string {
  return generateId()
}

/**
 * 创建文本时间轴项目
 * @param text 文本内容
 * @param style 文本样式配置（部分）
 * @param startTimeFrames 开始时间（帧数）
 * @param trackId 轨道ID
 * @param duration 显示时长（帧数），默认150帧（5秒@30fps）
 * @param videoResolution 视频分辨率配置
 * @returns Promise<TextTimelineItem>
 */
export async function createTextTimelineItem(
  text: string,
  style: Partial<TextStyleConfig>,
  startTimeFrames: number,
  trackId: string,
  duration: number = TextVisibleSprite.DEFAULT_DURATION,
  videoResolution: { width: number; height: number }
): Promise<TimelineItem<'text'>> {
  console.log('🔄 [TextTimelineUtils] 开始创建文本时间轴项目:', {
    text: text.substring(0, 20) + '...',
    startTimeFrames,
    trackId,
    duration,
    videoResolution
  })

  try {
    // 1. 验证和补全文本样式
    const completeStyle = {
      ...DEFAULT_TEXT_STYLE,
      ...style
    }

    // 2. 创建文本精灵（复用现有TextVisibleSprite）
    const textSprite = await TextVisibleSprite.create(text, completeStyle)
    console.log('✅ [TextTimelineUtils] 文本精灵创建成功')

    // 3. 设置时间范围
    textSprite.setTimelineStartTime(startTimeFrames)
    textSprite.setDisplayDuration(duration)
    console.log('✅ [TextTimelineUtils] 时间范围设置完成:', {
      startTime: startTimeFrames,
      duration: duration,
      endTime: startTimeFrames + duration
    })

    // 4. 设置默认位置（画布中心）
    const canvasWidth = videoResolution.width
    const canvasHeight = videoResolution.height
    textSprite.rect.x = (canvasWidth - textSprite.rect.w) / 2
    textSprite.rect.y = (canvasHeight - textSprite.rect.h) / 2
    console.log('✅ [TextTimelineUtils] 默认位置设置完成:', {
      webavX: textSprite.rect.x,
      webavY: textSprite.rect.y,
      width: textSprite.rect.w,
      height: textSprite.rect.h
    })

    // 5. 坐标系转换（WebAV -> 项目坐标系）
    const projectCoords = webavToProjectCoords(
      textSprite.rect.x,
      textSprite.rect.y,
      textSprite.rect.w,
      textSprite.rect.h,
      canvasWidth,
      canvasHeight
    )
    console.log('✅ [TextTimelineUtils] 坐标转换完成:', {
      webav: { x: textSprite.rect.x, y: textSprite.rect.y },
      project: projectCoords
    })

    // 6. 创建文本媒体配置
    const textConfig: TextMediaConfig = {
      // 文本特有属性
      text,
      style: textSprite.getTextStyle(),
      // 视觉属性（继承自 VisualMediaProps）
      x: Math.round(projectCoords.x),
      y: Math.round(projectCoords.y),
      width: textSprite.rect.w,
      height: textSprite.rect.h,
      rotation: textSprite.rect.angle || 0,
      opacity: textSprite.opacity,
      // 原始尺寸（对于文本，原始尺寸就是渲染后的尺寸）
      originalWidth: textSprite.rect.w,
      originalHeight: textSprite.rect.h,
      // 等比缩放状态（默认开启）
      proportionalScale: true,
      // 基础属性（继承自 BaseMediaProps）
      zIndex: textSprite.zIndex,
      animation: undefined,
    }

    // 7. 创建时间轴项目
    const timelineItem: TimelineItem<'text'> = reactive({
      id: generateTimelineItemId(),
      mediaItemId: '', // 文本项目不需要媒体库项目
      trackId,
      mediaType: 'text',
      timeRange: textSprite.getTimeRange(),
      sprite: markRaw(textSprite),
      thumbnailUrl: undefined, // 文本项目不需要缩略图
      config: textConfig
    })

    console.log('✅ [TextTimelineUtils] 文本时间轴项目创建完成:', {
      id: timelineItem.id,
      text: text.substring(0, 20) + '...',
      timeRange: timelineItem.timeRange,
      config: {
        position: { x: textConfig.x, y: textConfig.y },
        size: { width: textConfig.width, height: textConfig.height },
        style: textConfig.style
      }
    })

    return timelineItem
  } catch (error) {
    console.error('❌ [TextTimelineUtils] 创建文本时间轴项目失败:', error)
    throw new Error(`创建文本项目失败: ${(error as Error).message}`)
  }
}

/**
 * 验证文本轨道兼容性
 * @param trackType 轨道类型
 * @returns 是否兼容文本项目
 */
export function isTextTrackCompatible(trackType: string): boolean {
  return trackType === 'text'
}

/**
 * 创建默认文本样式
 * @param overrides 样式覆盖选项
 * @returns 完整的文本样式配置
 */
export function createDefaultTextStyle(overrides: Partial<TextStyleConfig> = {}): TextStyleConfig {
  return {
    ...DEFAULT_TEXT_STYLE,
    ...overrides
  }
}

/**
 * 获取文本项目的显示名称
 * @param textItem 文本时间轴项目
 * @param maxLength 最大显示长度
 * @returns 显示名称
 */
export function getTextItemDisplayName(textItem: TimelineItem<'text'>, maxLength: number = 20): string {
  const text = textItem.config.text || '文本'
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

/**
 * 检查文本内容是否有效
 * @param text 文本内容
 * @returns 是否有效
 */
export function isValidTextContent(text: string): boolean {
  return typeof text === 'string' && text.trim().length > 0
}

/**
 * 创建文本项目的预览信息
 * @param textItem 文本时间轴项目
 * @returns 预览信息对象
 */
export function createTextItemPreview(textItem: TimelineItem<'text'>) {
  return {
    id: textItem.id,
    text: getTextItemDisplayName(textItem),
    style: {
      fontSize: textItem.config.style.fontSize,
      fontFamily: textItem.config.style.fontFamily,
      color: textItem.config.style.color
    },
    duration: textItem.timeRange.displayDuration,
    position: {
      x: textItem.config.x,
      y: textItem.config.y
    }
  }
}
