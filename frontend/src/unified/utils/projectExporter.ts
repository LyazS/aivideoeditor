/**
 * 项目导出工具
 * 提供视频项目导出为 MP4 文件的功能
 */

import { Combinator } from '@webav/av-cliper'
import {
  VideoOffscreenSprite,
  ImageOffscreenSprite,
  AudioOffscreenSprite,
  // TextOffscreenSprite,
} from '@/unified/offscreensprite'
import type { UnifiedOffscreenSprite } from '@/unified/offscreensprite'
import type { UnifiedSprite } from '@/unified/visiblesprite'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import type { MediaType } from '@/unified/mediaitem'
import {
  isVideoTimelineItem,
  isImageTimelineItem,
  isAudioTimelineItem,
  isTextTimelineItem,
  hasVisualProperties,
  hasAudioProperties,
} from '@/unified/timelineitem/TimelineItemQueries'
import { projectToWebavCoords } from '@/unified/utils/coordinateTransform'
import { convertToWebAVAnimation, isValidAnimationConfig } from '@/unified/utils/animationConverter'
import { hasAnimation } from '@/unified/utils/unifiedKeyframeUtils'

/**
 * 导出项目参数接口
 */
export interface ExportProjectOptions {
  /** 视频分辨率宽度 */
  videoWidth: number
  /** 视频分辨率高度 */
  videoHeight: number
  /** 项目名称 */
  projectName: string
  /** 时间轴项目列表 */
  timelineItems: UnifiedTimelineItemData<MediaType>[]
  /** 轨道列表 */
  tracks: { id: string; isVisible: boolean; isMuted: boolean }[]
  /** 进度更新回调函数（可选） */
  onProgress?: (stage: string, progress: number, details?: string) => void
}

/**
 * 导出项目为 MP4 文件
 * @param options 导出项目参数
 */
export async function exportProject(options: ExportProjectOptions): Promise<void> {
  const { videoWidth, videoHeight, projectName, timelineItems, tracks, onProgress } = options
  
  // 初始化进度
  if (onProgress) {
    onProgress('', 0) // 直接开始导出进度，不显示准备阶段
  }
  console.log('开始导出项目...')

  try {
    // 1. 创建 Combinator 实例
    const combinator = new Combinator({
      width: videoWidth,
      height: videoHeight,
      bgColor: 'black',
    })

    console.log('Combinator 实例已创建')
    // 不显示准备阶段的进度，直接从0开始

    console.log('获取到时间轴项目:', timelineItems.length)

    // 3. 将时间轴项目转换为 OffscreenSprite 并添加到 Combinator
    for (let i = 0; i < timelineItems.length; i++) {
      const item = timelineItems[i]
      // 检查轨道可见性
      if (item.trackId) {
        const track = tracks.find(t => t.id === item.trackId)
        if (track && !track.isVisible) {
          console.log(`跳过不可见轨道上的时间轴项目: ${item.id} (轨道: ${item.trackId})`)
          continue
        }
      }

      if (item.runtime.sprite) {
        const visibleSprite = item.runtime.sprite as UnifiedSprite

        // 获取 Clip 并克隆一份新的
        const clip = visibleSprite.getClip()
        if (!clip) {
          console.warn('无法获取 Clip，跳过项目:', item.id)
          continue
        }

        // 克隆 Clip
        const clonedClip = await clip.clone()

        // 根据媒体类型创建相应的 OffscreenSprite
        let offscreenSprite: UnifiedOffscreenSprite

        if (isVideoTimelineItem(item)) {
          offscreenSprite = new VideoOffscreenSprite(clonedClip as any)
        } else if (isImageTimelineItem(item)) {
          offscreenSprite = new ImageOffscreenSprite(clonedClip as any)
        } else if (isAudioTimelineItem(item)) {
          offscreenSprite = new AudioOffscreenSprite(clonedClip as any)
        } else if (isTextTimelineItem(item)) {
          // 文本类型需要特殊处理，因为 TextOffscreenSprite 使用静态工厂方法创建
          // 这里我们使用 ImageOffscreenSprite 作为基础，然后设置文本属性
          offscreenSprite = new ImageOffscreenSprite(clonedClip as any)
        } else {
          console.warn('未知的媒体类型，跳过项目:', item.mediaType, item.id)
          continue
        }

        // 设置时间范围
        if (hasAudioProperties(item)) {
          // 视频和音频类型有完整的时间范围信息
          const videoOrAudioSprite = offscreenSprite as VideoOffscreenSprite | AudioOffscreenSprite
          videoOrAudioSprite.setTimeRange({
            clipStartTime: item.timeRange.clipStartTime,
            clipEndTime: item.timeRange.clipEndTime,
            timelineStartTime: item.timeRange.timelineStartTime,
            timelineEndTime: item.timeRange.timelineEndTime,
          })
        } else {
          // 图片和文本类型只有时间轴时间范围
          const imageOrTextSprite = offscreenSprite as ImageOffscreenSprite
          imageOrTextSprite.setTimeRange({
            timelineStartTime: item.timeRange.timelineStartTime,
            timelineEndTime: item.timeRange.timelineEndTime,
          })
        }

        // 复制 VisibleSprite 的状态到 OffscreenSprite
        if (visibleSprite.opacity !== undefined) {
          offscreenSprite.opacity = visibleSprite.opacity
        }

        // 复制 zIndex 属性
        if (visibleSprite.zIndex !== undefined) {
          offscreenSprite.zIndex = visibleSprite.zIndex
        }

        // 复制位置和大小信息（根据媒体类型处理不同的配置）
        if (item.config) {
          // 检查是否是视觉媒体类型（有x, y, width, height, rotation属性）
          if (hasVisualProperties(item)) {
            // 使用坐标转换系统将项目坐标系转换为WebAV坐标系
            const spriteWidth = item.config.width || 100
            const spriteHeight = item.config.height || 100
            const projectX = item.config.x || 0
            const projectY = item.config.y || 0
            
            const webavCoords = projectToWebavCoords(
              projectX,
              projectY,
              spriteWidth,
              spriteHeight,
              videoWidth,
              videoHeight
            )
            
            offscreenSprite.rect.x = webavCoords.x
            offscreenSprite.rect.y = webavCoords.y
            offscreenSprite.rect.w = spriteWidth
            offscreenSprite.rect.h = spriteHeight
            offscreenSprite.rect.angle = item.config.rotation || 0
          }
        }

        // 设置音频相关属性（仅对视频和音频类型）
        if (hasAudioProperties(item)) {
          const audioCapableSprite = offscreenSprite as VideoOffscreenSprite | AudioOffscreenSprite
          audioCapableSprite.setVolume(item.config.volume || 1)
          audioCapableSprite.setMuted(item.config.isMuted || false)

          // 设置轨道静音状态
          if (item.trackId) {
            const track = tracks.find(t => t.id === item.trackId)
            if (track) {
              audioCapableSprite.setTrackMuted(track.isMuted)
              console.log(`设置轨道静音状态: ${item.id} (轨道: ${item.trackId}, 静音: ${track.isMuted})`)
            }
          }

          // 如果是音频类型，设置增益
          if (isAudioTimelineItem(item)) {
            ;(audioCapableSprite as AudioOffscreenSprite).setGain(item.config.gain || 0)
          }
        }
        
        // 设置动画（如果存在）
        if (hasAnimation(item) && item.animation && isValidAnimationConfig(item.animation)) {
          try {
            console.log('🎬 [Export] 应用动画到 OffscreenSprite:', {
              itemId: item.id,
              keyframeCount: item.animation.keyframes.length,
            })
            
            // 转换为WebAV格式
            const webavConfig = convertToWebAVAnimation(
              item.animation,
              item.timeRange,
              videoWidth,
              videoHeight
            )
            
            // 检查是否有关键帧
            if (Object.keys(webavConfig.keyframes).length > 0) {
              // 应用动画到OffscreenSprite
              offscreenSprite.setAnimation(webavConfig.keyframes, webavConfig.options)
              
              console.log('🎬 [Export] 动画设置成功:', {
                itemId: item.id,
                keyframes: webavConfig.keyframes,
                duration: webavConfig.options.duration,
              })
            } else {
              console.warn('🎬 [Export] 没有有效的关键帧，跳过动画设置:', item.id)
            }
          } catch (error) {
            console.error('🎬 [Export] 设置动画失败:', error, {
              itemId: item.id,
              animation: item.animation,
            })
          }
        }

        // 将 OffscreenSprite 添加到 Combinator
        await combinator.addSprite(offscreenSprite)
        console.log(`已添加 ${item.mediaType} OffscreenSprite 到 Combinator`)
        // 不显示准备阶段的进度更新
      }
    }

    // 4. 监听导出进度事件 - 这是真正的视频合成阶段，从0-100%显示
    combinator.on('OutputProgress', (progress: number) => {
      const percent = progress * 100
      console.log(`导出进度: ${percent.toFixed(2)}%`)
      if (onProgress) {
        onProgress('', percent) // 直接从0-100%显示实际导出进度
      }
    })

    // 5. 开始合成输出（真正的导出过程）
    const output = combinator.output()

    // 6. 将流转换为 Blob
    const chunks: Uint8Array[] = []
    const reader = output.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' })
    console.log('视频合成完成，Blob 大小:', blob.size)

    // 7. 创建下载链接并弹窗
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || '导出项目'}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // 完成
    if (onProgress) {
      onProgress('', 100) // 最终完成状态
    }
    console.log('导出完成')
  } catch (error) {
    console.error('导出项目失败:', error)
    if (onProgress) {
      onProgress('', -1, error instanceof Error ? error.message : '未知错误')
    }
    throw error // 重新抛出错误，让调用者处理
  }
}
