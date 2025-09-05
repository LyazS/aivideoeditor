import { MP4Clip, ImgClip } from '@webav/av-cliper'
import type { UnifiedMediaItemData } from '@/unified/mediaitem'
import type { UnifiedTimelineItemData } from '@/unified/timelineitem/TimelineItemData'
import { UnifiedMediaItemQueries } from '@/unified/mediaitem'
import { ThumbnailMode } from '@/unified/constants/ThumbnailConstants'

/**
 * 统一架构下的缩略图生成器
 * 使用WebAV的tick API生成视频和图片的缩略图
 */

/**
 * 计算缩略图尺寸
 * @param originalWidth 原始宽度
 * @param originalHeight 原始高度
 * @param containerWidth 容器宽度（100px）
 * @param containerHeight 容器高度（60px）
 * @param mode 缩略图显示模式，默认为适应模式
 * @returns 缩略图尺寸和位置信息
 */
export function calculateThumbnailSize(
  originalWidth: number,
  originalHeight: number,
  containerWidth: number = 100,
  containerHeight: number = 60,
  mode: ThumbnailMode = ThumbnailMode.FIT,
) {
  const aspectRatio = originalWidth / originalHeight
  const containerAspectRatio = containerWidth / containerHeight

  let drawWidth: number
  let drawHeight: number
  let offsetX: number
  let offsetY: number

  if (mode === ThumbnailMode.FILL) {
    // 填满模式：填满整个容器，可能裁剪部分内容
    if (aspectRatio > containerAspectRatio) {
      // 原始宽高比大于容器宽高比，以容器高度为准进行裁剪
      drawWidth = containerHeight * aspectRatio
      drawHeight = containerHeight
      offsetX = (containerWidth - drawWidth) / 2
      offsetY = 0
    } else {
      // 原始宽高比小于等于容器宽高比，以容器宽度为准进行裁剪
      drawWidth = containerWidth
      drawHeight = containerWidth / aspectRatio
      offsetX = 0
      offsetY = (containerHeight - drawHeight) / 2
    }
  } else {
    // 适应模式（默认）：保持宽高比，居中显示，两侧或上下留黑边
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
    offsetX = (containerWidth - drawWidth) / 2
    offsetY = (containerHeight - drawHeight) / 2
  }

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
 * 从VideoFrame或ImageBitmap创建Canvas并绘制缩略图
 * @param source VideoFrame或ImageBitmap
 * @param sizeInfo 尺寸和位置信息
 * @returns Canvas元素
 */
export function createThumbnailCanvas(
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
 * @param containerWidth 容器宽度（默认100px）
 * @param containerHeight 容器高度（默认60px）
 * @param mode 缩略图显示模式，默认为适应模式
 * @param shouldClone 是否克隆MP4Clip以避免影响原始实例，默认为true
 * @returns Promise<HTMLCanvasElement>
 */
export async function generateVideoThumbnail(
  mp4Clip: MP4Clip,
  timePosition?: number,
  containerWidth: number = 100,
  containerHeight: number = 60,
  mode: ThumbnailMode = ThumbnailMode.FIT,
  shouldClone: boolean = true, // 新增参数，默认要clone
): Promise<HTMLCanvasElement> {
  let workingClip: MP4Clip = mp4Clip // 使用原始clip或克隆的clip

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

    // 根据shouldClone标志决定是否克隆MP4Clip
    if (shouldClone) {
      console.log('🔄 [ThumbnailGenerator] 克隆MP4Clip...')
      workingClip = await mp4Clip.clone()
      console.log('✅ [ThumbnailGenerator] MP4Clip克隆完成')
    } else {
      console.log('ℹ️ [ThumbnailGenerator] 跳过克隆，使用原始MP4Clip')
      // workingClip 初始值已经是 mp4Clip，无需重新赋值
    }

    // 如果没有指定时间位置，使用视频中间位置
    const tickTime = timePosition ?? meta.duration / 2
    console.log('⏰ [ThumbnailGenerator] 获取视频帧时间位置:', tickTime)

    // 使用workingClip获取指定时间的帧
    console.log('🎞️ [ThumbnailGenerator] 开始tick获取视频帧...')
    const tickResult = await workingClip.tick(tickTime)
    console.log('📸 [ThumbnailGenerator] tick结果:', {
      state: tickResult.state,
      hasVideo: !!tickResult.video,
    })

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取视频帧')
    }

    // 计算缩略图尺寸
    const sizeInfo = calculateThumbnailSize(meta.width, meta.height, containerWidth, containerHeight, mode)
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
    // 清理克隆的clip（只有当shouldClone为true且workingClip是克隆的实例时才需要清理）
    if (shouldClone && workingClip !== mp4Clip) {
      console.log('🧹 [ThumbnailGenerator] 清理克隆的clip')
      workingClip.destroy()
    }
  }
}

/**
 * 使用ImgClip的tick方法生成图片缩略图
 * @param imgClip ImgClip实例
 * @param containerWidth 容器宽度（默认100px）
 * @param containerHeight 容器高度（默认60px）
 * @param mode 缩略图显示模式，默认为适应模式
 * @param shouldClone 是否克隆ImgClip以避免影响原始实例，默认为true
 * @returns Promise<HTMLCanvasElement>
 */
export async function generateImageThumbnail(
  imgClip: ImgClip,
  containerWidth: number = 100,
  containerHeight: number = 60,
  mode: ThumbnailMode = ThumbnailMode.FIT,
  shouldClone: boolean = true, // 新增参数，默认要clone
): Promise<HTMLCanvasElement> {
  let workingClip: ImgClip = imgClip // 使用原始clip或克隆的clip

  try {
    console.log('🖼️ [ThumbnailGenerator] 开始生成图片缩略图...')

    // 等待ImgClip准备完成
    console.log('⏳ [ThumbnailGenerator] 等待ImgClip准备完成...')
    const meta = await imgClip.ready
    console.log('✅ [ThumbnailGenerator] ImgClip准备完成:', {
      width: meta.width,
      height: meta.height,
    })

    // 根据shouldClone标志决定是否克隆ImgClip
    if (shouldClone) {
      console.log('🔄 [ThumbnailGenerator] 克隆ImgClip...')
      workingClip = await imgClip.clone()
      console.log('✅ [ThumbnailGenerator] ImgClip克隆完成')
    } else {
      console.log('ℹ️ [ThumbnailGenerator] 跳过克隆，使用原始ImgClip')
      // workingClip 初始值已经是 imgClip，无需重新赋值
    }

    // 使用workingClip获取图片（时间参数对静态图片无意义，传0即可）
    console.log('🎞️ [ThumbnailGenerator] 开始tick获取图片数据...')
    const tickResult = await workingClip.tick(0)
    console.log('📸 [ThumbnailGenerator] tick结果:', {
      state: tickResult.state,
      hasVideo: !!tickResult.video,
    })

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取图片数据')
    }

    // 计算缩略图尺寸
    const sizeInfo = calculateThumbnailSize(meta.width, meta.height, containerWidth, containerHeight, mode)
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
    // 清理克隆的clip（只有当shouldClone为true且workingClip是克隆的实例时才需要清理）
    if (shouldClone && workingClip !== imgClip) {
      console.log('🧹 [ThumbnailGenerator] 清理克隆的clip')
      workingClip.destroy()
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
 * @param containerWidth 容器宽度（默认100px）
 * @param containerHeight 容器高度（默认60px）
 * @param mode 缩略图显示模式，默认为适应模式
 * @returns Promise<string | undefined> 缩略图URL
 */
export async function generateThumbnailForUnifiedMediaItem(
  mediaItem: UnifiedMediaItemData,
  timePosition?: number,
  containerWidth: number = 100,
  containerHeight: number = 60,
  mode: ThumbnailMode = ThumbnailMode.FIT,
): Promise<string | undefined> {
  try {
    let canvas: HTMLCanvasElement

    if (UnifiedMediaItemQueries.isVideo(mediaItem) && mediaItem.webav?.mp4Clip) {
      console.log('🎬 生成视频缩略图...')
      canvas = await generateVideoThumbnail(mediaItem.webav.mp4Clip, timePosition, containerWidth, containerHeight, mode, true)
      console.log('✅ 视频缩略图生成成功')
    } else if (UnifiedMediaItemQueries.isImage(mediaItem) && mediaItem.webav?.imgClip) {
      console.log('🖼️ 生成图片缩略图...')
      canvas = await generateImageThumbnail(mediaItem.webav.imgClip, containerWidth, containerHeight, mode, true)
      console.log('✅ 图片缩略图生成成功')
    } else if (UnifiedMediaItemQueries.isAudio(mediaItem)) {
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
 * @param containerWidth 容器宽度（可选，默认100px）
 * @param containerHeight 容器高度（可选，默认60px）
 * @param mode 缩略图显示模式，默认为适应模式
 * @returns Promise<string | undefined> 新的缩略图URL
 */
export async function regenerateThumbnailForUnifiedTimelineItem(
  timelineItem: UnifiedTimelineItemData,
  mediaItem: UnifiedMediaItemData,
  containerWidth: number = 100,
  containerHeight: number = 60,
  mode: ThumbnailMode = ThumbnailMode.FIT,
): Promise<string | undefined> {
  try {
    console.log('🔄 [ThumbnailGenerator] 重新生成时间轴clip缩略图:', {
      timelineItemId: timelineItem.id,
      mediaType: mediaItem.mediaType,
      containerWidth,
      containerHeight,
    })

    // 音频不需要缩略图，直接返回
    if (UnifiedMediaItemQueries.isAudio(mediaItem)) {
      console.log('🎵 音频不需要缩略图，跳过生成')
      return undefined
    }

    let thumbnailTime: number | undefined

    if (UnifiedMediaItemQueries.isVideo(mediaItem) && mediaItem.webav?.mp4Clip) {
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

    // 使用统一的缩略图生成函数，传递容器尺寸参数和模式
    const thumbnailUrl = await generateThumbnailForUnifiedMediaItem(
      mediaItem,
      thumbnailTime,
      containerWidth,
      containerHeight,
      mode
    )

    if (thumbnailUrl) {
      // 将缩略图URL存储到runtime中
      timelineItem.runtime.thumbnailUrl = thumbnailUrl
      console.log('✅ [ThumbnailGenerator] 时间轴clip缩略图重新生成成功，已存储到runtime')
    }

    return thumbnailUrl
  } catch (error) {
    console.error('❌ [ThumbnailGenerator] 重新生成时间轴clip缩略图失败:', error)
    return undefined
  }
}
