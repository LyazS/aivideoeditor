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
    // 等待MP4Clip准备完成
    const meta = await mp4Clip.ready

    // 克隆MP4Clip以避免影响原始实例
    clonedClip = await mp4Clip.clone()

    // 如果没有指定时间位置，使用视频中间位置
    const tickTime = timePosition ?? (meta.duration / 2)

    // 使用克隆的clip获取指定时间的帧
    const tickResult = await clonedClip.tick(tickTime)

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取视频帧')
    }

    // 计算缩略图尺寸
    const { width: thumbnailWidth, height: thumbnailHeight } = calculateThumbnailSize(
      meta.width,
      meta.height
    )

    // 创建缩略图canvas
    const canvas = createThumbnailCanvas(
      tickResult.video,
      thumbnailWidth,
      thumbnailHeight
    )

    // 清理VideoFrame资源
    if ('close' in tickResult.video) {
      tickResult.video.close()
    }

    return canvas
  } catch (error) {
    console.error('生成视频缩略图失败:', error)
    throw error
  } finally {
    // 清理克隆的clip
    if (clonedClip) {
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
    // 等待ImgClip准备完成
    const meta = await imgClip.ready

    // 克隆ImgClip以避免影响原始实例
    clonedClip = await imgClip.clone()

    // 使用克隆的clip获取图片（时间参数对静态图片无意义，传0即可）
    const tickResult = await clonedClip.tick(0)

    if (tickResult.state !== 'success' || !tickResult.video) {
      throw new Error('无法获取图片数据')
    }

    // 计算缩略图尺寸
    const { width: thumbnailWidth, height: thumbnailHeight } = calculateThumbnailSize(
      meta.width,
      meta.height
    )

    // 创建缩略图canvas
    const canvas = createThumbnailCanvas(
      tickResult.video,
      thumbnailWidth,
      thumbnailHeight
    )

    // 清理资源（如果是VideoFrame）
    if ('close' in tickResult.video) {
      tickResult.video.close()
    }

    return canvas
  } catch (error) {
    console.error('生成图片缩略图失败:', error)
    throw error
  } finally {
    // 清理克隆的clip
    if (clonedClip) {
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
