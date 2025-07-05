import { ref, reactive } from 'vue'
import type { SnapPoint } from '../types/snap'

/**
 * 吸附指示器数据接口
 */
export interface SnapIndicatorData {
  // 是否显示指示器
  show: boolean
  // 吸附点信息
  snapPoint?: SnapPoint
  // 时间轴宽度
  timelineWidth: number
  // 时间轴容器的偏移量
  timelineOffset?: { x: number; y: number }
  // 是否显示工具提示
  showTooltip?: boolean
  // 指示线高度
  lineHeight?: number
}

/**
 * 吸附指示器管理器类
 * 统一管理吸附指示器的显示、隐藏和更新
 */
class SnapIndicatorManager {
  private indicatorData = reactive<SnapIndicatorData>({
    show: false,
    timelineWidth: 0,
    timelineOffset: { x: 0, y: 0 },
    showTooltip: true,
    lineHeight: 400
  })

  private isVisible = ref(false)
  private hideTimeout: number | null = null

  /**
   * 获取当前指示器数据（响应式）
   */
  get data() {
    return this.indicatorData
  }

  /**
   * 获取指示器可见状态
   */
  get visible() {
    return this.isVisible.value
  }

  /**
   * 显示吸附指示器
   */
  show(snapPoint: SnapPoint, timelineWidth: number, options: Partial<SnapIndicatorData> = {}) {
    // 清除之前的隐藏定时器
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }

    // 更新指示器数据
    Object.assign(this.indicatorData, {
      show: true,
      snapPoint,
      timelineWidth,
      ...options
    })

    this.isVisible.value = true
  }

  /**
   * 隐藏吸附指示器
   */
  hide(immediate: boolean = false) {
    if (immediate) {
      this._hideImmediate()
    } else {
      // 延迟隐藏，避免频繁闪烁
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout)
      }
      
      this.hideTimeout = window.setTimeout(() => {
        this._hideImmediate()
        this.hideTimeout = null
      }, 100)
    }
  }

  /**
   * 立即隐藏指示器
   */
  private _hideImmediate() {
    this.indicatorData.show = false
    this.isVisible.value = false
    this.indicatorData.snapPoint = undefined
  }

  /**
   * 更新指示器位置
   */
  updatePosition(snapPoint: SnapPoint, timelineWidth: number) {
    if (this.isVisible.value) {
      this.indicatorData.snapPoint = snapPoint
      this.indicatorData.timelineWidth = timelineWidth
    }
  }

  /**
   * 更新时间轴偏移量
   */
  updateTimelineOffset(offset: { x: number; y: number }) {
    this.indicatorData.timelineOffset = offset
  }

  /**
   * 更新指示线高度
   */
  updateLineHeight(height: number) {
    this.indicatorData.lineHeight = height
  }

  /**
   * 设置工具提示显示状态
   */
  setTooltipVisible(visible: boolean) {
    this.indicatorData.showTooltip = visible
  }

  /**
   * 清理资源
   */
  dispose() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }
    this._hideImmediate()
  }
}

// 全局实例变量
let _snapIndicatorManager: SnapIndicatorManager | null = null

/**
 * 获取全局吸附指示器管理器实例（延迟创建）
 */
export function getSnapIndicatorManager(): SnapIndicatorManager {
  if (!_snapIndicatorManager) {
    _snapIndicatorManager = new SnapIndicatorManager()
  }
  return _snapIndicatorManager
}

/**
 * 吸附指示器管理器 Composable
 * 提供响应式的吸附指示器管理功能
 */
export function useSnapIndicator() {
  const manager = getSnapIndicatorManager()

  return {
    // 响应式数据
    indicatorData: manager.data,
    isVisible: manager.visible,

    // 管理方法
    show: manager.show.bind(manager),
    hide: manager.hide.bind(manager),
    updatePosition: manager.updatePosition.bind(manager),
    updateTimelineOffset: manager.updateTimelineOffset.bind(manager),
    updateLineHeight: manager.updateLineHeight.bind(manager),
    setTooltipVisible: manager.setTooltipVisible.bind(manager),
    dispose: manager.dispose.bind(manager)
  }
}


