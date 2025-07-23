/**
 * 用户选择文件数据源特定行为函数和查询函数
 * 基于"核心数据与行为分离"的重构方案
 */

import type {
  BaseDataSourceData
} from './BaseDataSource'
import {
  UnifiedDataSourceActions,
  DataSourceQueries
} from './BaseDataSource'
import { reactive } from 'vue'
import { generateUUID4 } from '@/utils/idGenerator'

// ==================== 用户选择文件数据源类型定义 ====================

/**
 * 用户选择文件数据源
 */
export interface UserSelectedFileSourceData extends BaseDataSourceData {
  type: 'user-selected'
  selectedFile: File
}

// ==================== 工厂函数 ====================

/**
 * 用户选择文件数据源工厂函数
 */
export const UserSelectedFileSourceFactory = {
  createUserSelectedSource(file: File): UserSelectedFileSourceData {
    return reactive({
      id: generateUUID4(),
      type: 'user-selected',
      status: 'pending',
      progress: 0,
      file: null,
      url: null,
      selectedFile: file
    }) as UserSelectedFileSourceData
  }
}

// ==================== 类型守卫 ====================

/**
 * 用户选择文件类型守卫
 */
export const UserSelectedFileTypeGuards = {
  isUserSelectedSource(source: BaseDataSourceData): source is UserSelectedFileSourceData {
    return source.type === 'user-selected'
  }
}

// ==================== 支持的文件类型配置 ====================

/**
 * 支持的媒体文件类型
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
    'video/mkv'
  ],
  audio: [
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/aac',
    'audio/flac',
    'audio/m4a',
    'audio/wma'
  ],
  image: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml'
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

// ==================== 文件验证接口 ====================

/**
 * 文件验证结果
 */
export interface FileValidationResult {
  isValid: boolean
  errorMessage?: string
  mediaType?: 'video' | 'audio' | 'image'
  fileSize?: number
}

// ==================== 用户选择文件特定行为函数 ====================

/**
 * 用户选择文件特定行为函数
 */
export const UserSelectedFileActions = {
  /**
   * 执行文件获取
   */
  executeAcquisition(source: UserSelectedFileSourceData): void {
    try {
      // 设置为获取中状态
      UnifiedDataSourceActions.setAcquiring(source)
      
      // 验证文件有效性
      const validationResult = this.validateFile(source.selectedFile)
      if (!validationResult.isValid) {
        UnifiedDataSourceActions.setError(source, validationResult.errorMessage || '文件验证失败')
        return
      }

      // 创建URL
      const url = URL.createObjectURL(source.selectedFile)
      
      // 设置为已获取状态
      UnifiedDataSourceActions.setAcquired(source, source.selectedFile, url)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '文件处理失败'
      UnifiedDataSourceActions.setError(source, errorMessage)
    }
  },

  /**
   * 验证文件
   */
  validateFile(file: File): FileValidationResult {
    // 检查文件是否存在
    if (!file) {
      return {
        isValid: false,
        errorMessage: '文件不存在'
      }
    }

    // 检查文件大小
    if (file.size === 0) {
      return {
        isValid: false,
        errorMessage: '文件为空'
      }
    }

    // 检查文件类型
    const mediaType = this.getMediaType(file.type)
    if (!mediaType) {
      return {
        isValid: false,
        errorMessage: `不支持的文件类型: ${file.type || '未知'}`
      }
    }

    // 检查文件大小限制
    const sizeLimit = FILE_SIZE_LIMITS[mediaType]
    if (file.size > sizeLimit) {
      const sizeMB = Math.round(file.size / (1024 * 1024))
      const limitMB = Math.round(sizeLimit / (1024 * 1024))
      return {
        isValid: false,
        errorMessage: `文件过大: ${sizeMB}MB，最大支持 ${limitMB}MB`
      }
    }

    // 检查文件名
    if (!this.isValidFileName(file.name)) {
      return {
        isValid: false,
        errorMessage: '文件名包含非法字符'
      }
    }

    return {
      isValid: true,
      mediaType,
      fileSize: file.size
    }
  },

  /**
   * 获取媒体类型
   */
  getMediaType(mimeType: string): 'video' | 'audio' | 'image' | null {
    if (SUPPORTED_MEDIA_TYPES.video.includes(mimeType as any)) {
      return 'video'
    }
    if (SUPPORTED_MEDIA_TYPES.audio.includes(mimeType as any)) {
      return 'audio'
    }
    if (SUPPORTED_MEDIA_TYPES.image.includes(mimeType as any)) {
      return 'image'
    }
    return null
  },

  /**
   * 验证文件名
   */
  isValidFileName(fileName: string): boolean {
    // 检查文件名长度
    if (!fileName || fileName.length === 0 || fileName.length > 255) {
      return false
    }

    // 检查非法字符
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(fileName)) {
      return false
    }

    // 检查保留名称（Windows）
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i
    if (reservedNames.test(fileName)) {
      return false
    }

    return true
  },

  /**
   * 重试获取
   */
  retryAcquisition(source: UserSelectedFileSourceData): void {
    if (!DataSourceQueries.canRetry(source)) {
      return
    }

    // 清理之前的状态
    UnifiedDataSourceActions.cleanup(source)
    
    // 重新执行获取
    this.executeAcquisition(source)
  },

  /**
   * 取消获取
   */
  cancelAcquisition(source: UserSelectedFileSourceData): void {
    if (!DataSourceQueries.canCancel(source)) {
      return
    }

    // 清理资源
    UnifiedDataSourceActions.cleanup(source)
    
    // 设置为取消状态
    UnifiedDataSourceActions.setCancelled(source)
  }
}

// ==================== 用户选择文件特定查询函数 ====================

/**
 * 用户选择文件特定查询函数
 */
export const UserSelectedFileQueries = {
  /**
   * 获取选择的文件
   */
  getSelectedFile(source: BaseDataSourceData): File | null {
    return UserSelectedFileTypeGuards.isUserSelectedSource(source) ? source.selectedFile : null
  },

  /**
   * 获取文件信息
   */
  getFileInfo(source: UserSelectedFileSourceData): {
    name: string
    size: number
    type: string
    lastModified: number
  } {
    const file = source.selectedFile
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }
  },

  /**
   * 获取文件大小（格式化）
   */
  getFormattedFileSize(source: UserSelectedFileSourceData): string {
    const size = source.selectedFile.size
    
    if (size < 1024) {
      return `${size} B`
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`
    } else if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`
    } else {
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
  },

  /**
   * 获取媒体类型
   */
  getMediaType(source: UserSelectedFileSourceData): 'video' | 'audio' | 'image' | null {
    return UserSelectedFileActions.getMediaType(source.selectedFile.type)
  },

  /**
   * 检查是否为视频文件
   */
  isVideoFile(source: UserSelectedFileSourceData): boolean {
    return this.getMediaType(source) === 'video'
  },

  /**
   * 检查是否为音频文件
   */
  isAudioFile(source: UserSelectedFileSourceData): boolean {
    return this.getMediaType(source) === 'audio'
  },

  /**
   * 检查是否为图片文件
   */
  isImageFile(source: UserSelectedFileSourceData): boolean {
    return this.getMediaType(source) === 'image'
  },

  /**
   * 检查文件是否有效
   */
  isFileValid(source: UserSelectedFileSourceData): boolean {
    return UserSelectedFileActions.validateFile(source.selectedFile).isValid
  },

  /**
   * 获取文件验证结果
   */
  getValidationResult(source: UserSelectedFileSourceData): FileValidationResult {
    return UserSelectedFileActions.validateFile(source.selectedFile)
  }
}
