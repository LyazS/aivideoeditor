/**
 * 属性同步器
 * 监听WebAV的propsChange事件，将WebAV的属性变化同步到TimelineItem
 */

import type { TimelineItem, PropsChangeEvent, CustomSprite } from '../types'
import { webavToProjectCoords } from './coordinateTransform'

// ==================== 同步器类型定义 ====================

/**
 * 属性同步配置
 */
export interface SyncConfig {
  /** 是否启用位置同步 */
  syncPosition: boolean
  /** 是否启用尺寸同步 */
  syncSize: boolean
  /** 是否启用旋转同步 */
  syncRotation: boolean
  /** 是否启用透明度同步 */
  syncOpacity: boolean
  /** 是否启用层级同步 */
  syncZIndex: boolean
  /** 是否启用调试日志 */
  enableDebugLog: boolean
}

/**
 * 默认同步配置
 */
const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncPosition: true,
  syncSize: true,
  syncRotation: true,
  syncOpacity: true,
  syncZIndex: true,
  enableDebugLog: false
}

// ==================== 属性同步器类 ====================

/**
 * 属性同步器
 * 负责监听WebAV sprite的属性变化并同步到TimelineItem
 */
export class PropertySynchronizer {
  private timelineItem: TimelineItem
  private config: SyncConfig
  private isDestroyed: boolean = false

  constructor(timelineItem: TimelineItem, config: Partial<SyncConfig> = {}) {
    this.timelineItem = timelineItem
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config }
    this.setupEventListeners()
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    const sprite = this.timelineItem.sprite

    if (!sprite) {
      console.warn('🔄 [PropertySync] No sprite found for TimelineItem:', this.timelineItem.id)
      return
    }

    // 监听属性变化事件
    sprite.on('propsChange', this.handlePropsChange.bind(this))

    if (this.config.enableDebugLog) {
      console.log('🔄 [PropertySync] Event listeners setup for:', this.timelineItem.id)
    }
  }

  /**
   * 处理属性变化事件
   */
  private handlePropsChange(event: PropsChangeEvent): void {
    if (this.isDestroyed) return

    if (this.config.enableDebugLog) {
      console.log('🔄 [PropertySync] Props changed:', {
        itemId: this.timelineItem.id,
        event
      })
    }

    try {
      this.syncProperties(event)
    } catch (error) {
      console.error('🔄 [PropertySync] Error syncing properties:', error)
    }
  }

  /**
   * 同步属性到TimelineItem
   */
  private syncProperties(event: PropsChangeEvent): void {
    let hasChanges = false

    // 同步位置和尺寸（需要坐标转换）
    if (event.rect && (this.config.syncPosition || this.config.syncSize || this.config.syncRotation)) {
      hasChanges = this.syncRectProperties(event.rect) || hasChanges
    }

    // 同步层级
    if (event.zIndex !== undefined && this.config.syncZIndex) {
      if (this.timelineItem.zIndex !== event.zIndex) {
        this.timelineItem.zIndex = event.zIndex
        hasChanges = true
      }
    }

    // 同步透明度（从sprite直接读取）
    if (this.config.syncOpacity) {
      const sprite = this.timelineItem.sprite
      if (sprite && sprite.opacity !== this.timelineItem.opacity) {
        this.timelineItem.opacity = sprite.opacity
        hasChanges = true
      }
    }

    if (hasChanges && this.config.enableDebugLog) {
      console.log('🔄 [PropertySync] Properties synchronized:', {
        itemId: this.timelineItem.id,
        x: this.timelineItem.x,
        y: this.timelineItem.y,
        width: this.timelineItem.width,
        height: this.timelineItem.height,
        rotation: this.timelineItem.rotation,
        opacity: this.timelineItem.opacity,
        zIndex: this.timelineItem.zIndex
      })
    }
  }

  /**
   * 同步矩形属性（位置、尺寸、旋转）
   */
  private syncRectProperties(rect: Partial<{ x: number; y: number; w: number; h: number; angle: number }>): boolean {
    let hasChanges = false

    // 同步位置
    if (this.config.syncPosition && (rect.x !== undefined || rect.y !== undefined)) {
      const webavX = rect.x ?? this.timelineItem.sprite.rect.x
      const webavY = rect.y ?? this.timelineItem.sprite.rect.y

      // 转换WebAV坐标到项目坐标
      const projectCoords = webavToProjectCoords(webavX, webavY)

      if (this.timelineItem.x !== Math.round(projectCoords.x)) {
        this.timelineItem.x = Math.round(projectCoords.x)
        hasChanges = true
      }

      if (this.timelineItem.y !== Math.round(projectCoords.y)) {
        this.timelineItem.y = Math.round(projectCoords.y)
        hasChanges = true
      }
    }

    // 同步尺寸
    if (this.config.syncSize && (rect.w !== undefined || rect.h !== undefined)) {
      if (rect.w !== undefined && this.timelineItem.width !== rect.w) {
        this.timelineItem.width = rect.w
        hasChanges = true
      }

      if (rect.h !== undefined && this.timelineItem.height !== rect.h) {
        this.timelineItem.height = rect.h
        hasChanges = true
      }
    }

    // 同步旋转
    if (this.config.syncRotation && rect.angle !== undefined) {
      if (this.timelineItem.rotation !== rect.angle) {
        this.timelineItem.rotation = rect.angle
        hasChanges = true
      }
    }

    return hasChanges
  }

  /**
   * 更新同步配置
   */
  public updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (this.config.enableDebugLog) {
      console.log('🔄 [PropertySync] Config updated:', this.config)
    }
  }

  /**
   * 手动触发一次完整同步
   */
  public forceSync(): void {
    if (this.isDestroyed) return

    const sprite = this.timelineItem.sprite
    if (!sprite) return

    // 构造一个完整的propsChange事件
    const event: PropsChangeEvent = {
      rect: {
        x: sprite.rect.x,
        y: sprite.rect.y,
        w: sprite.rect.w,
        h: sprite.rect.h,
        angle: sprite.rect.angle
      },
      zIndex: sprite.zIndex
    }

    this.handlePropsChange(event)

    if (this.config.enableDebugLog) {
      console.log('🔄 [PropertySync] Force sync completed for:', this.timelineItem.id)
    }
  }

  /**
   * 销毁同步器
   */
  public destroy(): void {
    this.isDestroyed = true

    // 移除事件监听器
    const sprite = this.timelineItem.sprite
    if (sprite) {
      sprite.off('propsChange', this.handlePropsChange.bind(this))
    }

    if (this.config.enableDebugLog) {
      console.log('🔄 [PropertySync] Synchronizer destroyed for:', this.timelineItem.id)
    }
  }

  /**
   * 检查同步器是否已销毁
   */
  public isDestroyed_(): boolean {
    return this.isDestroyed
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建属性同步器
 * @param timelineItem 时间轴项目
 * @param config 同步配置
 * @returns 属性同步器实例
 */
export function createPropertySynchronizer(
  timelineItem: TimelineItem,
  config: Partial<SyncConfig> = {}
): PropertySynchronizer {
  return new PropertySynchronizer(timelineItem, config)
}

/**
 * 为多个TimelineItem创建同步器
 * @param timelineItems 时间轴项目数组
 * @param config 同步配置
 * @returns 同步器数组
 */
export function createMultipleSynchronizers(
  timelineItems: TimelineItem[],
  config: Partial<SyncConfig> = {}
): PropertySynchronizer[] {
  return timelineItems.map(item => createPropertySynchronizer(item, config))
}

// ==================== 全局同步管理器 ====================

/**
 * 全局同步管理器
 * 管理所有TimelineItem的属性同步器
 */
class GlobalSyncManager {
  private synchronizers = new Map<string, PropertySynchronizer>()
  private globalConfig: SyncConfig = DEFAULT_SYNC_CONFIG

  /**
   * 添加同步器
   */
  public addSynchronizer(timelineItem: TimelineItem, config?: Partial<SyncConfig>): void {
    const finalConfig = { ...this.globalConfig, ...config }
    const synchronizer = new PropertySynchronizer(timelineItem, finalConfig)
    this.synchronizers.set(timelineItem.id, synchronizer)
  }

  /**
   * 移除同步器
   */
  public removeSynchronizer(itemId: string): void {
    const synchronizer = this.synchronizers.get(itemId)
    if (synchronizer) {
      synchronizer.destroy()
      this.synchronizers.delete(itemId)
    }
  }

  /**
   * 获取同步器
   */
  public getSynchronizer(itemId: string): PropertySynchronizer | undefined {
    return this.synchronizers.get(itemId)
  }

  /**
   * 更新全局配置
   */
  public updateGlobalConfig(config: Partial<SyncConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config }
    
    // 更新所有现有同步器的配置
    this.synchronizers.forEach(synchronizer => {
      synchronizer.updateConfig(this.globalConfig)
    })
  }

  /**
   * 清除所有同步器
   */
  public clearAll(): void {
    this.synchronizers.forEach(synchronizer => {
      synchronizer.destroy()
    })
    this.synchronizers.clear()
  }

  /**
   * 获取同步器数量
   */
  public getCount(): number {
    return this.synchronizers.size
  }
}

// 导出全局实例
export const globalSyncManager = new GlobalSyncManager()
