import { VisibleSprite } from '@webav/av-cliper'
import { EventTool } from '@webav/internal-utils'
import type { ExtendedSpriteEvents } from '@/unified/visiblesprite/types'

/**
 * 基础的VisibleSprite类，继承自WebAV的VisibleSprite
 * 提供了扩展的事件监听功能，包括透明度变化事件
 * 作为ImageVisibleSprite和VideoVisibleSprite的公共父类
 */
export abstract class BaseVisibleSprite extends VisibleSprite {
  /**
   * 存储opacity值的私有字段
   */
  #opacityValue: number = 1

  // ==================== 覆写的事件工具 ====================

  /**
   * 覆写父类的事件工具，支持透明度变化事件
   */
  #evtTool = new EventTool<ExtendedSpriteEvents>()

  /**
   * 覆写父类的 on 方法，支持扩展的事件类型
   */
  on = this.#evtTool.on

  // ==================== 覆写的属性 ====================

  /**
   * 存储 zIndex 值的私有字段
   */
  #zIndexValue: number = 0

  /**
   * 覆写 zIndex 属性，使其使用新的事件工具
   */
  get zIndex(): number {
    return this.#zIndexValue
  }

  set zIndex(v: number) {
    const changed = this.#zIndexValue !== v
    this.#zIndexValue = v
    if (changed) {
      this.#evtTool.emit('propsChange', { zIndex: v })
    }
  }

  /**
   * 构造函数
   * @param clip Clip实例
   */
  constructor(clip: any) {
    // 调用父类构造函数
    super(clip)

    // 初始化属性值（从父类获取）
    this.#zIndexValue = super.zIndex
    // 安全地获取父类的 opacity 属性，如果不存在则使用默认值 1
    this.#opacityValue = this.getParentOpacity() || 1

    // 覆写 opacity 属性为访问器
    this.#setupOpacityAccessor()

    // 重新设置 rect 事件监听（因为我们覆写了 evtTool）
    this.#setupRectEventListener()
  }

  // ==================== 受保护的方法 ====================

  /**
   * 获取事件工具实例，供子类使用
   */
  protected getEventTool(): EventTool<ExtendedSpriteEvents> {
    return this.#evtTool
  }

  /**
   * 获取当前opacity值，供子类使用
   */
  protected getOpacityValue(): number {
    return this.#opacityValue
  }

  /**
   * 设置opacity值，供子类使用
   */
  protected setOpacityValue(value: number): void {
    this.#opacityValue = value
  }

  // ==================== 私有方法 ====================

  /**
   * 安全地获取父类的 opacity 属性
   * @returns 父类的 opacity 值，如果不存在则返回 undefined
   */
  private getParentOpacity(): number | undefined {
    try {
      // 尝试访问父类的 opacity 属性
      const parentOpacity = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), 'opacity')
      if (parentOpacity && parentOpacity.get) {
        return parentOpacity.get.call(this)
      }
      // 如果没有 getter，尝试直接访问属性
      // 这里使用 any 是因为需要访问父类的私有属性，是必要的类型断言
      return (Object.getPrototypeOf(this) as { opacity?: number }).opacity
    } catch {
      // 如果访问失败，返回 undefined
      return undefined
    }
  }

  /**
   * 设置 opacity 属性访问器
   * 使用属性描述符覆写父类的 opacity 属性
   */
  #setupOpacityAccessor(): void {
    Object.defineProperty(this, 'opacity', {
      get: () => {
        return this.#opacityValue
      },
      set: (value: number) => {
        const changed = this.#opacityValue !== value
        this.#opacityValue = value
        if (changed) {
          this.#evtTool.emit('propsChange', { opacity: value })
        }
      },
      enumerable: true,
      configurable: true,
    })
  }

  /**
   * 重新设置 rect 事件监听
   * 因为我们覆写了 evtTool，需要重新绑定 rect 的 propsChange 事件
   */
  #setupRectEventListener(): void {
    this.rect.on('propsChange', (props) => {
      this.#evtTool.emit('propsChange', { rect: props })
    })
  }
}
