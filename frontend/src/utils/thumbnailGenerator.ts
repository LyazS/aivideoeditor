import { MP4Clip, ImgClip } from '@webav/av-cliper'

/**
 * 缩略图生成器
 * 使用WebAV的tick API生成视频和图片的缩略图
 */

/**
 * 计算保持宽高比的缩略图尺寸
 * @param originalWidth 原始宽度
 * @param originalHeight 原始高度
 * @param maxSize 最大尺寸（60px）
 * @returns 缩略图尺寸
 */
function calculateThumbnailSize(originalWidth: number, originalHeight: number, maxSize: number = 60) {
  const aspectRatio = originalWidth / originalHeight
  
  if (originalWidth > originalHeight) {
    // 宽度较大，以宽度为准
    return {
      width: Math.min(originalWidth, maxSize),
      height: Math.min(originalWidth, maxSize) / aspectRatio
    }
  } else {
    // 高度较大，以高度为准
    return {
      width: Math.min(originalHeight, maxSize) * aspectRatio,
      height: Math.min(originalHeight, maxSize)
    }
  }
}

/**
 * 从VideoFrame或ImageBitmap创建Canvas并绘制缩略图
 * @param source VideoFrame或ImageBitmap
 * @param targetWidth 目标宽度
 * @param targetHeight 目标高度
 * @returns Canvas元素
 */
function createThumbnailCanvas(
  source: VideoFrame | ImageBitmap, 
  targetWidth: number, 
  targetHeight: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('无法创建Canvas上下文')
  }
  
  canvas.width = targetWidth
  canvas.height = targetHeight
  
  // 绘制图像到canvas
  ctx.drawImage(source as any, 0, 0, targetWidth, targetHeight)
  
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
  timePosition?: number
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
      height: meta.height
    })

    // 克隆MP4Clip以避免影响原始实例
    console.log('🔄 [ThumbnailGenerator] 克隆MP4Clip...')
    clonedClip = await mp4Clip.clone()
    console.log('✅ [ThumbnailGenerator] MP4Clip克隆完成')

    // 如果没有指定时间位置，使用视频中间位置
    const tickTime = timePosition ?? (meta.duration / 2)
    console.log('⏰ [ThumbnailGenerator] 获取视频帧时间位置:', tickTime)

    // 使用克隆的clip获取指定时间的帧
    console.log('🎞️ [ThumbnailGenerator] 开始tick获取视频帧...')
    const tickResult = await clonedClip.tick(tickTime)
    console.log('📸 [ThumbnailGenerator] tick结果:', {
      state: tickResult.state,
      hasVideo: !!tickResult.video
    })

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取视频帧')
    }

    // 计算缩略图尺寸
    const { width: thumbnailWidth, height: thumbnailHeight } = calculateThumbnailSize(
      meta.width,
      meta.height
    )
    console.log('📐 [ThumbnailGenerator] 缩略图尺寸:', {
      original: `${meta.width}x${meta.height}`,
      thumbnail: `${thumbnailWidth}x${thumbnailHeight}`
    })

    // 创建缩略图canvas
    console.log('🎨 [ThumbnailGenerator] 创建缩略图canvas...')
    const canvas = createThumbnailCanvas(
      tickResult.video,
      thumbnailWidth,
      thumbnailHeight
    )
    console.log('✅ [ThumbnailGenerator] 缩略图canvas创建完成')

    // 清理VideoFrame资源
    if ('close' in tickResult.video) {
      tickResult.video.close()
    }

    return canvas
  } catch (error) {
    console.error('❌ [ThumbnailGenerator] 生成视频缩略图失败:', error)
    console.error('❌ [ThumbnailGenerator] 错误堆栈:', error.stack)
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
      height: meta.height
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
      hasVideo: !!tickResult.video
    })

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取图片数据')
    }

    // 计算缩略图尺寸
    const { width: thumbnailWidth, height: thumbnailHeight } = calculateThumbnailSize(
      meta.width,
      meta.height
    )
    console.log('📐 [ThumbnailGenerator] 缩略图尺寸:', {
      original: `${meta.width}x${meta.height}`,
      thumbnail: `${thumbnailWidth}x${thumbnailHeight}`
    })

    // 创建缩略图canvas
    console.log('🎨 [ThumbnailGenerator] 创建缩略图canvas...')
    const canvas = createThumbnailCanvas(
      tickResult.video,
      thumbnailWidth,
      thumbnailHeight
    )
    console.log('✅ [ThumbnailGenerator] 缩略图canvas创建完成')

    // 清理资源（如果是VideoFrame）
    if ('close' in tickResult.video) {
      tickResult.video.close()
    }

    return canvas
  } catch (error) {
    console.error('❌ [ThumbnailGenerator] 生成图片缩略图失败:', error)
    console.error('❌ [ThumbnailGenerator] 错误堆栈:', error.stack)
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
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        resolve(url)
      } else {
        reject(new Error('无法创建Blob'))
      }
    }, 'image/jpeg', quality)
  })
}

/**
 * 根据TimelineItem的时间范围重新生成缩略图
 * @param timelineItem 时间轴项目
 * @param mediaItem 对应的媒体项目
 * @returns Promise<string | undefined> 新的缩略图URL
 */
export async function regenerateThumbnailForTimelineItem(
  timelineItem: any,
  mediaItem: any
): Promise<string | undefined> {
  try {
    console.log('🔄 [ThumbnailGenerator] 重新生成时间轴clip缩略图:', {
      timelineItemId: timelineItem.id,
      mediaType: mediaItem.mediaType
    })

    let canvas: HTMLCanvasElement

    if (mediaItem.mediaType === 'video' && mediaItem.mp4Clip) {
      // 对于视频，使用clip的起始时间作为缩略图时间位置
      const timeRange = timelineItem.timeRange
      let thumbnailTime: number

      if ('clipStartTime' in timeRange) {
        // 使用clip内部的起始时间（微秒）
        thumbnailTime = timeRange.clipStartTime
        console.log('📍 [ThumbnailGenerator] 使用视频clip起始时间:', thumbnailTime / 1000000, 's')
      } else {
        // 如果没有clipStartTime，使用视频中间位置
        const meta = await mediaItem.mp4Clip.ready
        thumbnailTime = meta.duration / 2
        console.log('📍 [ThumbnailGenerator] 使用视频中间位置:', thumbnailTime / 1000000, 's')
      }

      canvas = await generateVideoThumbnail(mediaItem.mp4Clip, thumbnailTime)
    } else if (mediaItem.mediaType === 'image' && mediaItem.imgClip) {
      // 图片缩略图不需要时间位置
      canvas = await generateImageThumbnail(mediaItem.imgClip)
    } else {
      console.error('❌ [ThumbnailGenerator] 不支持的媒体类型或缺少clip')
      return undefined
    }

    // 转换为Blob URL
    const thumbnailUrl = await canvasToBlob(canvas)
    console.log('✅ [ThumbnailGenerator] 时间轴clip缩略图重新生成成功')
    return thumbnailUrl

  } catch (error) {
    console.error('❌ [ThumbnailGenerator] 重新生成时间轴clip缩略图失败:', error)
    return undefined
  }
}
