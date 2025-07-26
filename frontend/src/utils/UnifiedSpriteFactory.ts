import type { Raw } from 'vue'
import type {
  MediaType,
  CustomSprite,
  TextStyleConfig,
  LocalMediaItem
} from '../types'
import type {
  UnifiedMediaItemData
} from '../unified/UnifiedMediaItem'
import { VideoVisibleSprite } from './VideoVisibleSprite'
import { ImageVisibleSprite } from './ImageVisibleSprite'
import { AudioVisibleSprite } from './AudioVisibleSprite'
import { TextVisibleSprite } from './TextVisibleSprite'
import { DEFAULT_TEXT_STYLE } from '../types'

/**
 * Sprite 创建配置接口
 */
export interface SpriteCreationConfig {
  /** 媒体类型 */
  mediaType: MediaType
  /** 文本内容（仅文本类型需要） */
  text?: string
  /** 文本样式配置（仅文本类型需要） */
  textStyle?: TextStyleConfig
  /** 是否启用调试日志 */
  enableDebugLog?: boolean
}

/**
 * Sprite 创建结果接口
 */
export interface SpriteCreationResult {
  /** 创建的 Sprite 实例 */
  sprite: Raw<CustomSprite>
  /** 媒体类型 */
  mediaType: MediaType
  /** 创建时间戳 */
  createdAt: string
  /** 是否为文本类型 */
  isTextSprite: boolean
}

/**
 * Sprite 工厂错误类
 */
export class SpriteFactoryError extends Error {
  constructor(
    message: string,
    public readonly mediaType?: MediaType,
    public readonly mediaItemId?: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'SpriteFactoryError'
  }
}

/**
 * 统一的 Sprite 工厂类
 * 
 * 新架构特点：
 * 1. 统一处理所有媒体类型（video、image、audio、text）
 * 2. 支持本地和异步处理媒体项目
 * 3. 提供类型安全的创建接口
 * 4. 集成错误处理和日志记录
 * 5. 支持文本类型的动态创建
 * 6. 提供 Sprite 生命周期管理
 */
export class UnifiedSpriteFactory {
  /**
   * 工厂实例缓存
   */
  private static instance: UnifiedSpriteFactory | null = null

  /**
   * 创建的 Sprite 注册表
   */
  private readonly spriteRegistry = new Map<string, Raw<CustomSprite>>()

  /**
   * 获取工厂单例实例
   */
  public static getInstance(): UnifiedSpriteFactory {
    if (!UnifiedSpriteFactory.instance) {
      UnifiedSpriteFactory.instance = new UnifiedSpriteFactory()
    }
    return UnifiedSpriteFactory.instance
  }

  /**
   * 私有构造函数，确保单例模式
   */
  private constructor() {}

  /**
   * 从媒体项目创建 Sprite
   * 
   * @param mediaItem 媒体项目（本地或异步处理）
   * @param config 创建配置
   * @returns Sprite 创建结果
   * @throws SpriteFactoryError 当创建失败时
   */
  public async createSpriteFromMediaItem(
    mediaItem: UnifiedMediaItemData,
    config?: Partial<SpriteCreationConfig>
  ): Promise<SpriteCreationResult> {
    // 验证媒体类型
    if (mediaItem.mediaType === 'unknown') {
      throw new Error(`媒体类型未知，无法创建 Sprite: ${mediaItem.name}`)
    }

    const finalConfig: SpriteCreationConfig = {
      mediaType: mediaItem.mediaType as MediaType,
      enableDebugLog: false,
      ...config
    }

    try {
      // 检查媒体项目状态
      this.validateMediaItemStatus(mediaItem)

      // 根据媒体类型创建对应的 Sprite
      const sprite = await this.createSpriteByType(mediaItem, finalConfig)

      // 注册 Sprite
      this.registerSprite(mediaItem.id, sprite)

      const result: SpriteCreationResult = {
        sprite,
        mediaType: finalConfig.mediaType,
        createdAt: new Date().toISOString(),
        isTextSprite: finalConfig.mediaType === 'text'
      }

      if (finalConfig.enableDebugLog) {
        console.log('✅ [UnifiedSpriteFactory] Sprite 创建成功:', {
          mediaItemId: mediaItem.id,
          mediaType: finalConfig.mediaType,
          spriteType: sprite.constructor.name
        })
      }

      return result

    } catch (error) {
      const factoryError = new SpriteFactoryError(
        `创建 Sprite 失败: ${error instanceof Error ? error.message : String(error)}`,
        finalConfig.mediaType,
        mediaItem.id,
        error instanceof Error ? error : undefined
      )

      console.error('❌ [UnifiedSpriteFactory] Sprite 创建失败:', {
        mediaItemId: mediaItem.id,
        mediaType: finalConfig.mediaType,
        error: factoryError.message
      })

      throw factoryError
    }
  }

  /**
   * 创建文本 Sprite
   * 
   * @param text 文本内容
   * @param textStyle 文本样式配置
   * @param config 创建配置
   * @returns Sprite 创建结果
   */
  public async createTextSprite(
    text: string,
    textStyle?: TextStyleConfig,
    config?: Partial<SpriteCreationConfig>
  ): Promise<SpriteCreationResult> {
    const finalConfig: SpriteCreationConfig = {
      mediaType: 'text',
      text,
      textStyle: textStyle || DEFAULT_TEXT_STYLE,
      enableDebugLog: false,
      ...config
    }

    try {
      const sprite = await this.createTextSpriteInternal(finalConfig)
      
      // 生成临时 ID 用于注册
      const tempId = `text_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      this.registerSprite(tempId, sprite)

      const result: SpriteCreationResult = {
        sprite,
        mediaType: 'text',
        createdAt: new Date().toISOString(),
        isTextSprite: true
      }

      if (finalConfig.enableDebugLog) {
        console.log('✅ [UnifiedSpriteFactory] 文本 Sprite 创建成功:', {
          text: finalConfig.text,
          tempId
        })
      }

      return result

    } catch (error) {
      const factoryError = new SpriteFactoryError(
        `创建文本 Sprite 失败: ${error instanceof Error ? error.message : String(error)}`,
        'text',
        undefined,
        error instanceof Error ? error : undefined
      )

      console.error('❌ [UnifiedSpriteFactory] 文本 Sprite 创建失败:', {
        text: finalConfig.text,
        error: factoryError.message
      })

      throw factoryError
    }
  }

  /**
   * 销毁 Sprite
   * 
   * @param spriteId Sprite ID 或媒体项目 ID
   * @returns 是否成功销毁
   */
  public destroySprite(spriteId: string): boolean {
    const sprite = this.spriteRegistry.get(spriteId)
    if (!sprite) {
      return false
    }

    try {
      // 从注册表中移除
      this.spriteRegistry.delete(spriteId)
      
      // 注意：实际的 Sprite 销毁应该由 AVCanvas 管理
      // 这里只是从工厂的注册表中移除引用
      
      console.log('🗑️ [UnifiedSpriteFactory] Sprite 已从注册表移除:', spriteId)
      return true

    } catch (error) {
      console.error('❌ [UnifiedSpriteFactory] Sprite 销毁失败:', {
        spriteId,
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * 获取已注册的 Sprite
   * 
   * @param spriteId Sprite ID
   * @returns Sprite 实例或 undefined
   */
  public getSprite(spriteId: string): Raw<CustomSprite> | undefined {
    return this.spriteRegistry.get(spriteId)
  }

  /**
   * 获取所有已注册的 Sprite
   * 
   * @returns Sprite 注册表的只读副本
   */
  public getAllSprites(): ReadonlyMap<string, Raw<CustomSprite>> {
    return new Map(this.spriteRegistry)
  }

  /**
   * 清空所有已注册的 Sprite
   */
  public clearAllSprites(): void {
    this.spriteRegistry.clear()
    console.log('🧹 [UnifiedSpriteFactory] 所有 Sprite 注册表已清空')
  }

  // ==================== 私有方法 ====================

  /**
   * 验证媒体项目状态
   */
  private validateMediaItemStatus(mediaItem: UnifiedMediaItemData): void {
    // 检查统一媒体项目状态
    if (mediaItem.mediaStatus !== 'ready') {
      throw new Error(`媒体项目尚未就绪: ${mediaItem.name} (状态: ${mediaItem.mediaStatus})`)
    }

    // 检查是否有必要的 WebAV 对象
    if (!mediaItem.webav) {
      throw new Error(`媒体项目缺少 WebAV 对象: ${mediaItem.name}`)
    }
  }

  /**
   * 根据媒体类型创建 Sprite
   */
  private async createSpriteByType(
    mediaItem: UnifiedMediaItemData,
    config: SpriteCreationConfig
  ): Promise<Raw<CustomSprite>> {
    switch (config.mediaType) {
      case 'video':
        return this.createVideoSprite(mediaItem)
      
      case 'image':
        return this.createImageSprite(mediaItem)
      
      case 'audio':
        return this.createAudioSprite(mediaItem)
      
      case 'text':
        return this.createTextSpriteInternal(config)
      
      default:
        throw new Error(`不支持的媒体类型: ${config.mediaType}`)
    }
  }

  /**
   * 创建视频 Sprite
   */
  private async createVideoSprite(mediaItem: UnifiedMediaItemData): Promise<Raw<VideoVisibleSprite>> {
    if (!mediaItem.webav?.mp4Clip) {
      throw new Error(`视频素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }

    // 动态导入 videoStore 以避免循环依赖
    const { useVideoStore } = await import('../stores/videoStore')
    const videoStore = useVideoStore()

    const clonedMP4Clip = await videoStore.cloneMP4Clip(mediaItem.webav.mp4Clip)
    return new VideoVisibleSprite(clonedMP4Clip)
  }

  /**
   * 创建图片 Sprite
   */
  private async createImageSprite(mediaItem: UnifiedMediaItemData): Promise<Raw<ImageVisibleSprite>> {
    if (!mediaItem.webav?.imgClip) {
      throw new Error(`图片素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }

    // 动态导入 videoStore 以避免循环依赖
    const { useVideoStore } = await import('../stores/videoStore')
    const videoStore = useVideoStore()

    const clonedImgClip = await videoStore.cloneImgClip(mediaItem.webav.imgClip)
    return new ImageVisibleSprite(clonedImgClip)
  }

  /**
   * 创建音频 Sprite
   */
  private async createAudioSprite(mediaItem: UnifiedMediaItemData): Promise<Raw<AudioVisibleSprite>> {
    if (!mediaItem.webav?.audioClip) {
      throw new Error(`音频素材解析失败，无法创建sprite: ${mediaItem.name}`)
    }

    // 动态导入 videoStore 以避免循环依赖
    const { useVideoStore } = await import('../stores/videoStore')
    const videoStore = useVideoStore()

    const clonedAudioClip = await videoStore.cloneAudioClip(mediaItem.webav.audioClip)
    return new AudioVisibleSprite(clonedAudioClip)
  }

  /**
   * 创建文本 Sprite（内部方法）
   */
  private async createTextSpriteInternal(config: SpriteCreationConfig): Promise<Raw<TextVisibleSprite>> {
    if (!config.text) {
      throw new Error('创建文本 Sprite 需要提供文本内容')
    }

    const textStyle = config.textStyle || DEFAULT_TEXT_STYLE
    return await TextVisibleSprite.create(config.text, textStyle)
  }

  /**
   * 注册 Sprite 到注册表
   */
  private registerSprite(id: string, sprite: Raw<CustomSprite>): void {
    this.spriteRegistry.set(id, sprite)
  }
}

// ==================== 便捷函数导出 ====================

/**
 * 将 LocalMediaItem 转换为 UnifiedMediaItemData
 */
function adaptLocalMediaItemToUnified(localItem: LocalMediaItem): UnifiedMediaItemData {
  // 创建一个虚拟的用户选择文件数据源
  const mockFile = new File([], localItem.name, { type: 'application/octet-stream' })

  return {
    id: localItem.id,
    name: localItem.name,
    createdAt: localItem.createdAt,
    mediaStatus: localItem.status === 'ready' ? 'ready' : 'error',
    mediaType: localItem.mediaType,
    source: {
      id: `local_${localItem.id}`,
      type: 'user-selected',
      status: localItem.status === 'ready' ? 'acquired' : 'error',
      progress: localItem.status === 'ready' ? 100 : 0,
      file: mockFile,
      url: null,
      selectedFile: mockFile
    },
    webav: {
      mp4Clip: localItem.mp4Clip || undefined,
      imgClip: localItem.imgClip || undefined,
      audioClip: localItem.audioClip || undefined,
      thumbnailUrl: localItem.thumbnailUrl,
      // LocalMediaItem 没有原始尺寸信息，这些需要从 WebAV 对象中获取
      originalWidth: undefined,
      originalHeight: undefined,
    },
    duration: localItem.duration
  }
}

/**
 * 便捷函数：从媒体项目创建 Sprite
 * 兼容旧的 spriteFactory.ts 接口
 */
export async function createSpriteFromMediaItem(
  mediaItem: LocalMediaItem
): Promise<VideoVisibleSprite | ImageVisibleSprite | AudioVisibleSprite> {
  const factory = UnifiedSpriteFactory.getInstance()
  const unifiedItem = adaptLocalMediaItemToUnified(mediaItem)
  const result = await factory.createSpriteFromMediaItem(unifiedItem)

  // 类型断言确保返回类型兼容
  return result.sprite as VideoVisibleSprite | ImageVisibleSprite | AudioVisibleSprite
}

/**
 * 便捷函数：创建文本 Sprite
 */
export async function createTextSprite(
  text: string,
  textStyle?: TextStyleConfig
): Promise<TextVisibleSprite> {
  const factory = UnifiedSpriteFactory.getInstance()
  const result = await factory.createTextSprite(text, textStyle)
  return result.sprite as TextVisibleSprite
}

/**
 * 便捷函数：获取工厂实例
 */
export function getSpriteFactory(): UnifiedSpriteFactory {
  return UnifiedSpriteFactory.getInstance()
}
