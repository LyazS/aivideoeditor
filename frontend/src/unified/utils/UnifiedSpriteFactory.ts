/**
 * 统一架构的 Sprite 工厂类
 * 
 * 职责：
 * 1. 基于统一媒体项目数据创建对应的 Sprite 实例
 * 2. 提供统一的错误处理和状态验证
 * 3. 支持视频、图片、音频三种媒体类型
 * 4. 遵循新架构的"数据与行为分离"设计模式
 * 
 * 设计理念：
 * - 使用 UnifiedMediaItemData 作为输入参数
 * - 集成现有的 Sprite 类实现
 * - 提供完整的 TypeScript 类型支持
 * - 包含详细的错误信息和状态检查
 */

import type { Raw } from 'vue'
import type { UnifiedMediaItemData } from '../mediaitem/types'
import type { CustomSprite } from '../../types'

// 导入现有的 Sprite 类
import { VideoVisibleSprite } from '../../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../../utils/ImageVisibleSprite'
import { AudioVisibleSprite } from '../../utils/AudioVisibleSprite'

/**
 * 从统一媒体项目数据创建对应的 Sprite 实例
 * 
 * 这是现有 spriteFactory.createSpriteFromMediaItem 的统一架构版本，
 * 使用新的 UnifiedMediaItemData 类型作为输入参数。
 * 
 * @param mediaData 统一媒体项目数据
 * @returns 创建的 Sprite 实例
 * @throws 当媒体项目未准备好或类型不支持时抛出错误
 * 
 * @example
 * ```typescript
 * // 基本使用
 * const sprite = await createSpriteFromUnifiedMediaItem(mediaData)
 * 
 * // 错误处理
 * try {
 *   const sprite = await createSpriteFromUnifiedMediaItem(mediaData)
 *   // 使用 sprite...
 * } catch (error) {
 *   console.error('创建 Sprite 失败:', error.message)
 * }
 * ```
 */
export async function createSpriteFromUnifiedMediaItem(
  mediaData: UnifiedMediaItemData,
): Promise<Raw<CustomSprite>> {
  // 1. 验证媒体项目状态
  if (mediaData.mediaStatus !== 'ready') {
    throw new Error(`媒体项目尚未就绪，当前状态: ${mediaData.mediaStatus}，素材名称: ${mediaData.name}`)
  }

  // 2. 验证媒体类型
  if (mediaData.mediaType === 'unknown') {
    throw new Error(`媒体类型未确定，无法创建 Sprite: ${mediaData.name}`)
  }

  // 3. 验证 WebAV 对象存在
  if (!mediaData.webav) {
    throw new Error(`媒体项目 WebAV 对象未就绪，无法创建 Sprite: ${mediaData.name}`)
  }

  // 4. 动态导入 unifiedStore 以避免循环依赖
  const { useUnifiedStore } = await import('../unifiedStore')
  const unifiedStore = useUnifiedStore()

  // 5. 根据媒体类型创建对应的 Sprite
  try {
    switch (mediaData.mediaType) {
      case 'video': {
        if (!mediaData.webav.mp4Clip) {
          throw new Error(`视频 WebAV 对象缺失，无法创建 Sprite: ${mediaData.name}`)
        }
        
        // 克隆 MP4Clip 以避免多个 Sprite 共享同一个 Clip
        const clonedMP4Clip = await unifiedStore.cloneMP4Clip(mediaData.webav.mp4Clip)
        return new VideoVisibleSprite(clonedMP4Clip) as Raw<CustomSprite>
      }

      case 'image': {
        if (!mediaData.webav.imgClip) {
          throw new Error(`图片 WebAV 对象缺失，无法创建 Sprite: ${mediaData.name}`)
        }
        
        // 克隆 ImgClip 以避免多个 Sprite 共享同一个 Clip
        const clonedImgClip = await unifiedStore.cloneImgClip(mediaData.webav.imgClip)
        return new ImageVisibleSprite(clonedImgClip) as Raw<CustomSprite>
      }

      case 'audio': {
        if (!mediaData.webav.audioClip) {
          throw new Error(`音频 WebAV 对象缺失，无法创建 Sprite: ${mediaData.name}`)
        }
        
        // 克隆 AudioClip 以避免多个 Sprite 共享同一个 Clip
        const clonedAudioClip = await unifiedStore.cloneAudioClip(mediaData.webav.audioClip)
        return new AudioVisibleSprite(clonedAudioClip) as Raw<CustomSprite>
      }

      case 'text': {
        // 文本类型暂不支持，因为它不需要基于媒体项目创建
        throw new Error(`文本类型不支持通过媒体项目创建 Sprite，请使用专门的文本 Sprite 创建方法`)
      }

      default: {
        // TypeScript 应该确保这里不会到达，但为了运行时安全还是加上
        throw new Error(`不支持的媒体类型: ${(mediaData as any).mediaType}`)
      }
    }
  } catch (error) {
    // 6. 统一错误处理
    if (error instanceof Error) {
      // 重新抛出已知错误，保持错误信息
      throw error
    } else {
      // 处理未知错误类型
      throw new Error(`创建 Sprite 时发生未知错误: ${String(error)}，素材名称: ${mediaData.name}`)
    }
  }
}

/**
 * 检查统一媒体项目数据是否可以创建 Sprite
 * 
 * 这是一个辅助函数，用于在创建 Sprite 之前进行预检查，
 * 避免不必要的异步操作和错误处理。
 * 
 * @param mediaData 统一媒体项目数据
 * @returns 检查结果对象
 * 
 * @example
 * ```typescript
 * const checkResult = canCreateSpriteFromUnifiedMediaItem(mediaData)
 * if (checkResult.canCreate) {
 *   const sprite = await createSpriteFromUnifiedMediaItem(mediaData)
 * } else {
 *   console.warn('无法创建 Sprite:', checkResult.reason)
 * }
 * ```
 */
export function canCreateSpriteFromUnifiedMediaItem(
  mediaData: UnifiedMediaItemData,
): { canCreate: boolean; reason?: string } {
  // 检查媒体状态
  if (mediaData.mediaStatus !== 'ready') {
    return {
      canCreate: false,
      reason: `媒体项目尚未就绪，当前状态: ${mediaData.mediaStatus}`
    }
  }

  // 检查媒体类型
  if (mediaData.mediaType === 'unknown') {
    return {
      canCreate: false,
      reason: '媒体类型未确定'
    }
  }

  // 检查是否为文本类型
  if (mediaData.mediaType === 'text') {
    return {
      canCreate: false,
      reason: '文本类型不支持通过媒体项目创建 Sprite'
    }
  }

  // 检查 WebAV 对象
  if (!mediaData.webav) {
    return {
      canCreate: false,
      reason: 'WebAV 对象未就绪'
    }
  }

  // 检查具体的 WebAV Clip 对象
  switch (mediaData.mediaType) {
    case 'video':
      if (!mediaData.webav.mp4Clip) {
        return {
          canCreate: false,
          reason: '视频 WebAV 对象缺失'
        }
      }
      break

    case 'image':
      if (!mediaData.webav.imgClip) {
        return {
          canCreate: false,
          reason: '图片 WebAV 对象缺失'
        }
      }
      break

    case 'audio':
      if (!mediaData.webav.audioClip) {
        return {
          canCreate: false,
          reason: '音频 WebAV 对象缺失'
        }
      }
      break
  }

  return { canCreate: true }
}

/**
 * 获取媒体项目支持的 Sprite 类型
 * 
 * 根据统一媒体项目数据返回对应的 Sprite 类型名称，
 * 用于调试和日志记录。
 * 
 * @param mediaData 统一媒体项目数据
 * @returns Sprite 类型名称
 */
export function getSpriteTypeFromUnifiedMediaItem(
  mediaData: UnifiedMediaItemData,
): string {
  switch (mediaData.mediaType) {
    case 'video':
      return 'VideoVisibleSprite'
    case 'image':
      return 'ImageVisibleSprite'
    case 'audio':
      return 'AudioVisibleSprite'
    case 'text':
      return 'TextVisibleSprite'
    case 'unknown':
      return 'UnknownSprite'
    default:
      return 'UnsupportedSprite'
  }
}

/**
 * 批量检查多个媒体项目是否可以创建 Sprite
 * 
 * 用于批量操作场景，可以快速筛选出可以创建 Sprite 的媒体项目。
 * 
 * @param mediaItems 统一媒体项目数据数组
 * @returns 检查结果数组
 */
export function batchCheckCanCreateSprite(
  mediaItems: UnifiedMediaItemData[],
): Array<{ mediaData: UnifiedMediaItemData; canCreate: boolean; reason?: string }> {
  return mediaItems.map(mediaData => ({
    mediaData,
    ...canCreateSpriteFromUnifiedMediaItem(mediaData)
  }))
}