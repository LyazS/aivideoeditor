/**
 * 内容渲染器模块导出
 */

// 导出渲染器工厂
export { ContentRendererFactory } from '@/unified/components/renderers/ContentRendererFactory'

// 导出基础接口（从类型定义中重新导出）
export type {
  StatusRendererType,
  MediaTypeRendererType,
  RendererType,
} from '@/unified/types/clipRenderer'
