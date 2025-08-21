/**
 * 元数据管理器
 * 专门负责媒体项目的元数据管理
 */

import type { UnifiedMediaItemData, WebAVObjects, MediaType } from '@/unified/mediaitem/types'
import { UnifiedMediaItemActions } from '@/unified/mediaitem/actions'
import type { WebAVProcessingResult } from './WebAVProcessor'

/**
 * 元数据更新结果
 */
export interface MetadataUpdateResult {
  success: boolean
  error?: string
  updatedFields?: string[]
}

/**
 * 元数据管理器
 * 负责媒体项目的元数据设置和管理
 */
export class MetadataManager {
  /**
   * 设置WebAV对象
   * @param mediaItem 媒体项目
   * @param webavObjects WebAV对象
   * @returns 更新结果
   */
  setWebAVObjects(mediaItem: UnifiedMediaItemData, webavObjects: WebAVObjects): MetadataUpdateResult {
    try {
      console.log(`🔧 [MetadataManager] 设置WebAV对象: ${mediaItem.name}`)
      
      UnifiedMediaItemActions.setWebAVObjects(mediaItem, webavObjects)
      
      return {
        success: true,
        updatedFields: ['webav'],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '设置WebAV对象失败'
      console.error(`❌ [MetadataManager] 设置WebAV对象失败: ${mediaItem.name}`, error)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 设置媒体时长
   * @param mediaItem 媒体项目
   * @param duration 时长（帧数）
   * @returns 更新结果
   */
  setDuration(mediaItem: UnifiedMediaItemData, duration: number): MetadataUpdateResult {
    try {
      console.log(`⏱️ [MetadataManager] 设置媒体时长: ${mediaItem.name} -> ${duration}帧`)
      
      UnifiedMediaItemActions.setDuration(mediaItem, duration)
      
      return {
        success: true,
        updatedFields: ['duration'],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '设置时长失败'
      console.error(`❌ [MetadataManager] 设置时长失败: ${mediaItem.name}`, error)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 设置媒体类型
   * @param mediaItem 媒体项目
   * @param mediaType 媒体类型
   * @returns 更新结果
   */
  setMediaType(mediaItem: UnifiedMediaItemData, mediaType: MediaType): MetadataUpdateResult {
    try {
      console.log(`🏷️ [MetadataManager] 设置媒体类型: ${mediaItem.name} -> ${mediaType}`)
      
      UnifiedMediaItemActions.setMediaType(mediaItem, mediaType)
      
      return {
        success: true,
        updatedFields: ['mediaType'],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '设置媒体类型失败'
      console.error(`❌ [MetadataManager] 设置媒体类型失败: ${mediaItem.name}`, error)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 更新媒体项目名称
   * @param mediaItem 媒体项目
   * @param newName 新名称
   * @returns 更新结果
   */
  updateName(mediaItem: UnifiedMediaItemData, newName: string): MetadataUpdateResult {
    try {
      if (!newName.trim()) {
        return {
          success: false,
          error: '名称不能为空',
        }
      }

      console.log(`📝 [MetadataManager] 更新媒体项目名称: ${mediaItem.name} -> ${newName}`)
      
      UnifiedMediaItemActions.updateName(mediaItem, newName.trim())
      
      return {
        success: true,
        updatedFields: ['name'],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新名称失败'
      console.error(`❌ [MetadataManager] 更新名称失败: ${mediaItem.name}`, error)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 批量设置元数据
   * @param mediaItem 媒体项目
   * @param webavResult WebAV处理结果
   * @returns 更新结果
   */
  batchSetMetadata(
    mediaItem: UnifiedMediaItemData, 
    webavResult: WebAVProcessingResult
  ): MetadataUpdateResult {
    try {
      const updatedFields: string[] = []
      
      // 设置WebAV对象
      const webavResult1 = this.setWebAVObjects(mediaItem, webavResult.webavObjects)
      if (webavResult1.success && webavResult1.updatedFields) {
        updatedFields.push(...webavResult1.updatedFields)
      } else if (!webavResult1.success) {
        return webavResult1
      }
      
      // 设置时长
      const durationResult = this.setDuration(mediaItem, webavResult.duration)
      if (durationResult.success && durationResult.updatedFields) {
        updatedFields.push(...durationResult.updatedFields)
      } else if (!durationResult.success) {
        return durationResult
      }
      
      console.log(`🔧 [MetadataManager] 批量设置元数据完成: ${mediaItem.name}`)
      console.log(`📋 [MetadataManager] 更新字段: ${updatedFields.join(', ')}`)
      
      return {
        success: true,
        updatedFields,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '批量设置元数据失败'
      console.error(`❌ [MetadataManager] 批量设置元数据失败: ${mediaItem.name}`, error)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 获取媒体项目元数据摘要
   * @param mediaItem 媒体项目
   * @returns 元数据摘要
   */
  getMetadataSummary(mediaItem: UnifiedMediaItemData): {
    id: string
    name: string
    mediaType: string
    mediaStatus: string
    duration?: number
    hasWebAV: boolean
    hasFile: boolean
    hasUrl: boolean
    sourceType: string
    createdAt: string
  } {
    return {
      id: mediaItem.id,
      name: mediaItem.name,
      mediaType: mediaItem.mediaType,
      mediaStatus: mediaItem.mediaStatus,
      duration: mediaItem.duration,
      hasWebAV: !!mediaItem.webav,
      hasFile: !!mediaItem.source.file,
      hasUrl: !!mediaItem.source.url,
      sourceType: mediaItem.source.type,
      createdAt: new Date(mediaItem.createdAt).toLocaleString(),
    }
  }

  /**
   * 验证元数据完整性
   * @param mediaItem 媒体项目
   * @returns 验证结果
   */
  validateMetadata(mediaItem: UnifiedMediaItemData): {
    isValid: boolean
    missingFields: string[]
    warnings: string[]
  } {
    const missingFields: string[] = []
    const warnings: string[] = []

    // 检查必需字段
    if (!mediaItem.id) missingFields.push('id')
    if (!mediaItem.name) missingFields.push('name')
    if (!mediaItem.mediaType) missingFields.push('mediaType')
    if (!mediaItem.mediaStatus) missingFields.push('mediaStatus')
    if (!mediaItem.source) missingFields.push('source')

    // 检查就绪状态的必需字段
    if (mediaItem.mediaStatus === 'ready') {
      if (!mediaItem.duration) missingFields.push('duration')
      if (!mediaItem.webav) missingFields.push('webav')
    }

    // 检查警告条件
    if (mediaItem.mediaType === 'unknown') {
      warnings.push('媒体类型未知')
    }
    
    if (mediaItem.source && !mediaItem.source.file) {
      warnings.push('数据源缺少文件')
    }
    
    if (mediaItem.source && !mediaItem.source.url) {
      warnings.push('数据源缺少URL')
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
      warnings,
    }
  }

  /**
   * 克隆元数据
   * @param sourceItem 源媒体项目
   * @param targetItem 目标媒体项目
   * @returns 更新结果
   */
  cloneMetadata(
    sourceItem: UnifiedMediaItemData, 
    targetItem: UnifiedMediaItemData
  ): MetadataUpdateResult {
    try {
      const updatedFields: string[] = []
      
      // 克隆基本元数据
      if (sourceItem.duration !== undefined) {
        const result = this.setDuration(targetItem, sourceItem.duration)
        if (result.success && result.updatedFields) {
          updatedFields.push(...result.updatedFields)
        }
      }
      
      if (sourceItem.mediaType !== 'unknown') {
        const result = this.setMediaType(targetItem, sourceItem.mediaType)
        if (result.success && result.updatedFields) {
          updatedFields.push(...result.updatedFields)
        }
      }
      
      // 克隆WebAV对象
      if (sourceItem.webav) {
        const result = this.setWebAVObjects(targetItem, sourceItem.webav)
        if (result.success && result.updatedFields) {
          updatedFields.push(...result.updatedFields)
        }
      }
      
      console.log(`🔧 [MetadataManager] 克隆元数据完成: ${sourceItem.name} -> ${targetItem.name}`)
      
      return {
        success: true,
        updatedFields,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '克隆元数据失败'
      console.error(`❌ [MetadataManager] 克隆元数据失败: ${sourceItem.name} -> ${targetItem.name}`, error)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 清理元数据
   * @param mediaItem 媒体项目
   * @param fieldsToClear 要清理的字段列表
   * @returns 更新结果
   */
  clearMetadata(
    mediaItem: UnifiedMediaItemData, 
    fieldsToClear: string[] = ['webav', 'duration']
  ): MetadataUpdateResult {
    try {
      const updatedFields: string[] = []
      
      for (const field of fieldsToClear) {
        switch (field) {
          case 'webav':
            if (mediaItem.webav) {
              delete mediaItem.webav
              updatedFields.push('webav')
            }
            break
          case 'duration':
            if (mediaItem.duration !== undefined) {
              delete mediaItem.duration
              updatedFields.push('duration')
            }
            break
          default:
            console.warn(`⚠️ [MetadataManager] 不支持清理的字段: ${field}`)
        }
      }
      
      console.log(`🧹 [MetadataManager] 清理元数据完成: ${mediaItem.name}`)
      console.log(`📋 [MetadataManager] 清理字段: ${updatedFields.join(', ')}`)
      
      return {
        success: true,
        updatedFields,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '清理元数据失败'
      console.error(`❌ [MetadataManager] 清理元数据失败: ${mediaItem.name}`, error)
      
      return {
        success: false,
        error: errorMessage,
      }
    }
  }
}