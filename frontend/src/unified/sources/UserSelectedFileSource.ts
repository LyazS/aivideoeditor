/**
 * 用户选择文件数据源类型定义和查询函数
 * 基于"核心数据与行为分离"的重构方案
 * 行为函数已移动到 UserSelectedFileManager 中
 */
import type { BaseDataSourceData } from './BaseDataSource'
import { reactive } from 'vue'
import { generateUUID4 } from '@/utils/idGenerator'
import { getMediaTypeFromMimeType } from '../utils/mediaTypeDetector'

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
      selectedFile: file,
    }) as UserSelectedFileSourceData
  },
}

// ==================== 类型守卫 ====================

/**
 * 用户选择文件类型守卫
 */
export const UserSelectedFileTypeGuards = {
  isUserSelectedSource(source: BaseDataSourceData): source is UserSelectedFileSourceData {
    return source.type === 'user-selected'
  },
}

// ==================== 支持的文件类型配置 ====================
// 注意：媒体类型配置已移至 ../utils/mediaTypeDetector.ts 统一管理

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
      lastModified: file.lastModified,
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
    const detectedType = getMediaTypeFromMimeType(source.selectedFile.type)
    return detectedType === 'unknown' ? null : detectedType
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
   * 检查文件是否有效（简化版本，仅检查基本条件）
   */
  isFileValid(source: UserSelectedFileSourceData): boolean {
    const file = source.selectedFile
    if (!file || file.size === 0) {
      return false
    }

    const mediaType = this.getMediaType(source)
    return mediaType !== null
  },

  /**
   * 获取文件验证结果（简化版本）
   */
  getValidationResult(source: UserSelectedFileSourceData): FileValidationResult {
    const file = source.selectedFile

    if (!file) {
      return {
        isValid: false,
        errorMessage: '文件不存在',
      }
    }

    if (file.size === 0) {
      return {
        isValid: false,
        errorMessage: '文件为空',
      }
    }

    const mediaType = this.getMediaType(source)
    if (!mediaType) {
      return {
        isValid: false,
        errorMessage: '不支持的文件类型',
      }
    }

    return {
      isValid: true,
      mediaType,
      fileSize: file.size,
    }
  },
}
