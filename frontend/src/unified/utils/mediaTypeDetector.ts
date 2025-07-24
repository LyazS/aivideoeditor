/**
 * 媒体类型检测工具
 * 提供统一的文件媒体类型检测功能
 */

/**
 * 媒体类型枚举
 */
export type DetectedMediaType = 'video' | 'image' | 'audio' | 'unknown'

// ==================== 支持的媒体类型配置 ====================

/**
 * 支持的媒体文件类型（MIME类型）
 */
export const SUPPORTED_MEDIA_TYPES = {
  video: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/mkv',
    'video/quicktime',      // .mov 的标准MIME类型
    'video/x-matroska',     // .mkv 的标准MIME类型
    'video/x-ms-wmv',       // .wmv 的标准MIME类型
    'video/x-flv',          // .flv 的标准MIME类型
    'video/3gpp'            // .3gp 的标准MIME类型
  ],
  audio: [
    'audio/mpeg',           // .mp3
    'audio/wav',            // .wav
    'audio/ogg',            // .ogg
    'audio/aac',            // .aac
    'audio/flac',           // .flac
    'audio/mp4',            // .m4a
    'audio/x-ms-wma'        // .wma
  ],
  image: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml',
    'image/tiff'
  ]
} as const

/**
 * 文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS = {
  video: 500 * 1024 * 1024,    // 500MB
  audio: 100 * 1024 * 1024,    // 100MB
  image: 50 * 1024 * 1024      // 50MB
} as const

/**
 * 检测文件的媒体类型
 * @param file 文件对象
 * @returns 检测到的媒体类型
 */
export function detectFileMediaType(file: File): DetectedMediaType {
  const mimeType = file.type.toLowerCase()

  // 首先根据MIME类型精确检测
  if (SUPPORTED_MEDIA_TYPES.video.includes(mimeType as any)) {
    return 'video'
  } else if (SUPPORTED_MEDIA_TYPES.audio.includes(mimeType as any)) {
    return 'audio'
  } else if (SUPPORTED_MEDIA_TYPES.image.includes(mimeType as any)) {
    return 'image'
  } else {
    // 如果MIME类型不在支持列表中，根据文件扩展名进行二次检测
    const extension = file.name.toLowerCase().split('.').pop() || ''

    const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp']
    const audioExtensions = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma']
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff']

    if (videoExtensions.includes(extension)) {
      return 'video'
    } else if (audioExtensions.includes(extension)) {
      return 'audio'
    } else if (imageExtensions.includes(extension)) {
      return 'image'
    }

    return 'unknown'
  }
}

/**
 * 检查文件类型是否支持
 * @param file 文件对象
 * @returns 是否支持该文件类型
 */
export function isSupportedMediaType(file: File): boolean {
  const detectedType = detectFileMediaType(file)

  // 支持的媒体类型：video, audio, image
  // 不支持的类型：unknown
  return ['video', 'audio', 'image'].includes(detectedType)
}

/**
 * 检查MIME类型是否被支持
 * @param mimeType MIME类型字符串
 * @returns 是否支持该MIME类型
 */
export function isSupportedMimeType(mimeType: string): boolean {
  const normalizedMimeType = mimeType.toLowerCase()

  return SUPPORTED_MEDIA_TYPES.video.includes(normalizedMimeType as any) ||
         SUPPORTED_MEDIA_TYPES.audio.includes(normalizedMimeType as any) ||
         SUPPORTED_MEDIA_TYPES.image.includes(normalizedMimeType as any)
}

/**
 * 根据MIME类型获取媒体类型
 * @param mimeType MIME类型字符串
 * @returns 媒体类型
 */
export function getMediaTypeFromMimeType(mimeType: string): DetectedMediaType {
  const normalizedMimeType = mimeType.toLowerCase()

  if (SUPPORTED_MEDIA_TYPES.video.includes(normalizedMimeType as any)) {
    return 'video'
  } else if (SUPPORTED_MEDIA_TYPES.audio.includes(normalizedMimeType as any)) {
    return 'audio'
  } else if (SUPPORTED_MEDIA_TYPES.image.includes(normalizedMimeType as any)) {
    return 'image'
  }

  return 'unknown'
}

/**
 * 获取媒体类型的显示名称
 * @param mediaType 媒体类型
 * @returns 显示名称
 */
export function getMediaTypeDisplayName(mediaType: DetectedMediaType): string {
  const displayNames: Record<DetectedMediaType, string> = {
    video: '视频',
    audio: '音频',
    image: '图片',
    unknown: '未知'
  }
  
  return displayNames[mediaType]
}

/**
 * 根据媒体类型获取默认图标
 * @param mediaType 媒体类型
 * @returns 图标名称或URL
 */
export function getMediaTypeIcon(mediaType: DetectedMediaType): string {
  const icons: Record<DetectedMediaType, string> = {
    video: '🎬',
    audio: '🎵',
    image: '🖼️',
    unknown: '📄'
  }
  
  return icons[mediaType]
}
