import { MP4Clip, ImgClip } from '@webav/av-cliper'
import type { UnifiedMediaItemData } from '../mediaitem/types'
import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData'

/**
 * 统一架构下的缩略图生成器
 * 使用WebAV的tick API生成视频和图片的缩略图
 */

/**
 * 计算保持宽高比的缩略图尺寸（在固定尺寸容器内居中显示）
 * @param originalWidth 原始宽度
 * @param originalHeight 原始高度
 * @param containerWidth 容器宽度（100px）
 * @param containerHeight 容器高度（60px）
 * @returns 缩略图尺寸和位置信息
 */
function calculateThumbnailSize(
  originalWidth: number,
  originalHeight: number,
  containerWidth: number = 100,
  containerHeight: number = 60,
) {
  const aspectRatio = originalWidth / originalHeight
  const containerAspectRatio = containerWidth / containerHeight

  let drawWidth: number
  let drawHeight: number

  if (aspectRatio > containerAspectRatio) {
    // 原始宽高比大于容器宽高比，以容器宽度为准
    drawWidth = containerWidth
    drawHeight = containerWidth / aspectRatio
  } else {
    // 原始宽高比小于等于容器宽高比，以容器高度为准
    drawWidth = containerHeight * aspectRatio
    drawHeight = containerHeight
  }

  // 计算居中位置
  const offsetX = (containerWidth - drawWidth) / 2
  const offsetY = (containerHeight - drawHeight) / 2

  return {
    containerWidth,
    containerHeight,
    drawWidth,
    drawHeight,
    offsetX,
    offsetY,
  }
}

/**
 * 从VideoFrame或ImageBitmap创建Canvas并绘制缩略图（固定80x80，居中显示，黑色背景）
 * @param source VideoFrame或ImageBitmap
 * @param sizeInfo 尺寸和位置信息
 * @returns Canvas元素
 */
function createThumbnailCanvas(
  source: VideoFrame | ImageBitmap,
  sizeInfo: {
    containerWidth: number
    containerHeight: number
    drawWidth: number
    drawHeight: number
    offsetX: number
    offsetY: number
  },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('无法创建Canvas上下文')
  }

  // 设置固定的容器尺寸
  canvas.width = sizeInfo.containerWidth
  canvas.height = sizeInfo.containerHeight

  // 填充黑色背景
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, sizeInfo.containerWidth, sizeInfo.containerHeight)

  // 在居中位置绘制图像
  // VideoFrame 和 ImageBitmap 都是有效的 CanvasImageSource
  ctx.drawImage(
    source as CanvasImageSource,
    sizeInfo.offsetX,
    sizeInfo.offsetY,
    sizeInfo.drawWidth,
    sizeInfo.drawHeight,
  )

  return canvas
}

/**
 * 使用MP4Clip的tick方法生成视频缩略图
 * @param mp4Clip MP4Clip实例
 * @param timePosition 时间位置（微秒），默认为视频中间位置
 * @returns Promise<HTMLCanvasElement>
 */
export async function generateVideoThumbnail(
  mp4Clip: MP4Clip,
  timePosition?: number,
): Promise<HTMLCanvasElement> {
  let clonedClip: MP4Clip | null = null

  try {
    console.log('🎬 [ThumbnailGenerator] 开始生成视频缩略图...')

    // 等待MP4Clip准备完成
    console.log('⏳ [ThumbnailGenerator] 等待MP4Clip准备完成...')
    const meta = await mp4Clip.ready
    console.log('✅ [ThumbnailGenerator] MP4Clip准备完成:', {
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
    })

    // 克隆MP4Clip以避免影响原始实例
    console.log('🔄 [ThumbnailGenerator] 克隆MP4Clip...')
    clonedClip = await mp4Clip.clone()
    console.log('✅ [ThumbnailGenerator] MP4Clip克隆完成')

    // 如果没有指定时间位置，使用视频中间位置
    const tickTime = timePosition ?? meta.duration / 2
    console.log('⏰ [ThumbnailGenerator] 获取视频帧时间位置:', tickTime)

    // 使用克隆的clip获取指定时间的帧
    console.log('🎞️ [ThumbnailGenerator] 开始tick获取视频帧...')
    const tickResult = await clonedClip.tick(tickTime)
    console.log('📸 [ThumbnailGenerator] tick结果:', {
      state: tickResult.state,
      hasVideo: !!tickResult.video,
    })

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取视频帧')
    }

    // 计算缩略图尺寸
    const sizeInfo = calculateThumbnailSize(meta.width, meta.height)
    console.log('📐 [ThumbnailGenerator] 缩略图尺寸:', {
      original: `${meta.width}x${meta.height}`,
      container: `${sizeInfo.containerWidth}x${sizeInfo.containerHeight}`,
      draw: `${sizeInfo.drawWidth}x${sizeInfo.drawHeight}`,
      offset: `${sizeInfo.offsetX},${sizeInfo.offsetY}`,
    })

    // 创建缩略图canvas
    console.log('🎨 [ThumbnailGenerator] 创建缩略图canvas...')
    const canvas = createThumbnailCanvas(tickResult.video, sizeInfo)
    console.log('✅ [ThumbnailGenerator] 缩略图canvas创建完成')

    // 清理VideoFrame资源
    if ('close' in tickResult.video) {
      tickResult.video.close()
    }

    return canvas
  } catch (error) {
    console.error('❌ [ThumbnailGenerator] 生成视频缩略图失败:', error)
    console.error('❌ [ThumbnailGenerator] 错误堆栈:', (error as Error).stack)
    throw error
  } finally {
    // 清理克隆的clip
    if (clonedClip) {
      console.log('🧹 [ThumbnailGenerator] 清理克隆的clip')
      clonedClip.destroy()
    }
  }
}

/**
 * 使用ImgClip的tick方法生成图片缩略图
 * @param imgClip ImgClip实例
 * @returns Promise<HTMLCanvasElement>
 */
export async function generateImageThumbnail(imgClip: ImgClip): Promise<HTMLCanvasElement> {
  let clonedClip: ImgClip | null = null

  try {
    console.log('🖼️ [ThumbnailGenerator] 开始生成图片缩略图...')

    // 等待ImgClip准备完成
    console.log('⏳ [ThumbnailGenerator] 等待ImgClip准备完成...')
    const meta = await imgClip.ready
    console.log('✅ [ThumbnailGenerator] ImgClip准备完成:', {
      width: meta.width,
      height: meta.height,
    })

    // 克隆ImgClip以避免影响原始实例
    console.log('🔄 [ThumbnailGenerator] 克隆ImgClip...')
    clonedClip = await imgClip.clone()
    console.log('✅ [ThumbnailGenerator] ImgClip克隆完成')

    // 使用克隆的clip获取图片（时间参数对静态图片无意义，传0即可）
    console.log('🎞️ [ThumbnailGenerator] 开始tick获取图片数据...')
    const tickResult = await clonedClip.tick(0)
    console.log('📸 [ThumbnailGenerator] tick结果:', {
      state: tickResult.state,
      hasVideo: !!tickResult.video,
    })

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取图片数据')
    }

    // 计算缩略图尺寸
    const sizeInfo = calculateThumbnailSize(meta.width, meta.height)
    console.log('📐 [ThumbnailGenerator] 缩略图尺寸:', {
      original: `${meta.width}x${meta.height}`,
      container: `${sizeInfo.containerWidth}x${sizeInfo.containerHeight}`,
      draw: `${sizeInfo.drawWidth}x${sizeInfo.drawHeight}`,
      offset: `${sizeInfo.offsetX},${sizeInfo.offsetY}`,
    })

    // 创建缩略图canvas
    console.log('🎨 [ThumbnailGenerator] 创建缩略图canvas...')
    const canvas = createThumbnailCanvas(tickResult.video, sizeInfo)
    console.log('✅ [ThumbnailGenerator] 缩略图canvas创建完成')

    // 清理资源（如果是VideoFrame）
    if ('close' in tickResult.video) {
      tickResult.video.close()
    }

    return canvas
  } catch (error) {
    console.error('❌ [ThumbnailGenerator] 生成图片缩略图失败:', error)
    console.error('❌ [ThumbnailGenerator] 错误堆栈:', (error as Error).stack)
    throw error
  } finally {
    // 清理克隆的clip
    if (clonedClip) {
      console.log('🧹 [ThumbnailGenerator] 清理克隆的clip')
      clonedClip.destroy()
    }
  }
}

/**
 * 将Canvas转换为Blob URL
 * @param canvas Canvas元素
 * @param quality 图片质量（0-1）
 * @returns Promise<string> Blob URL
 */
export function canvasToBlob(canvas: HTMLCanvasElement, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          resolve(url)
        } else {
          reject(new Error('无法创建Blob'))
        }
      },
      'image/jpeg',
      quality,
    )
  })
}

/**
 * 统一的缩略图生成函数 - 根据媒体类型自动选择合适的生成方法
 * @param mediaItem 统一媒体项目
 * @param timePosition 视频时间位置（微秒），仅对视频有效
 * @returns Promise<string | undefined> 缩略图URL
 */
export async function generateThumbnailForUnifiedMediaItem(
  mediaItem: UnifiedMediaItemData,
  timePosition?: number,
): Promise<string | undefined> {
  try {
    let canvas: HTMLCanvasElement

    if (mediaItem.mediaType === 'video' && mediaItem.webav?.mp4Clip) {
      console.log('🎬 生成视频缩略图...')
      canvas = await generateVideoThumbnail(mediaItem.webav.mp4Clip, timePosition)
      console.log('✅ 视频缩略图生成成功')
    } else if (mediaItem.mediaType === 'image' && mediaItem.webav?.imgClip) {
      console.log('🖼️ 生成图片缩略图...')
      canvas = await generateImageThumbnail(mediaItem.webav.imgClip)
      console.log('✅ 图片缩略图生成成功')
    } else if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return undefined
    } else {
      console.error('❌ 不支持的媒体类型或缺少clip对象')
      return undefined
    }

    // 转换为Blob URL
    const thumbnailUrl = await canvasToBlob(canvas)
    return thumbnailUrl
  } catch (error) {
    console.error('❌ 缩略图生成失败:', error)
    return undefined
  }
}

/**
 * 根据TimelineItem的时间范围重新生成缩略图
 * @param timelineItem 统一时间轴项目
 * @param mediaItem 对应的统一媒体项目
 * @returns Promise<string | undefined> 新的缩略图URL
 */
export async function regenerateThumbnailForUnifiedTimelineItem(
  timelineItem: UnifiedTimelineItemData,
  mediaItem: UnifiedMediaItemData,
): Promise<string | undefined> {
  try {
    console.log('🔄 [ThumbnailGenerator] 重新生成时间轴clip缩略图:', {
      timelineItemId: timelineItem.id,
      mediaType: mediaItem.mediaType,
    })

    // 音频不需要缩略图，直接返回
    if (mediaItem.mediaType === 'audio') {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return undefined
    }

    let thumbnailTime: number | undefined

    if (mediaItem.mediaType === 'video' && mediaItem.webav?.mp4Clip) {
      // 对于视频，使用clip的起始时间作为缩略图时间位置
      const timeRange = timelineItem.timeRange

      // 直接使用clipStartTime（UnifiedTimeRange中总是存在）
      thumbnailTime = timeRange.clipStartTime
      console.log(
        '📍 [ThumbnailGenerator] 使用视频clip起始时间:',
        (thumbnailTime ?? 0) / 1000000,
        's',
      )
    }

    // 使用统一的缩略图生成函数
    const thumbnailUrl = await generateThumbnailForUnifiedMediaItem(mediaItem, thumbnailTime)

    if (thumbnailUrl) {
      console.log('✅ [ThumbnailGenerator] 时间轴clip缩略图重新生成成功')
    }

    return thumbnailUrl
  } catch (error) {
    console.error('❌ [ThumbnailGenerator] 重新生成时间轴clip缩略图失败:', error)
    return undefined
  }
}