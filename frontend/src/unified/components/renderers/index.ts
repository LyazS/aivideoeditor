/**
 * 内容渲染器模块导出
 */

// 导出渲染器工厂
export { ContentRendererFactory } from './ContentRendererFactory'

// 导出状态渲染器
export { LoadingContentRenderer, ErrorContentRenderer } from './status'

// 导出媒体类型渲染器
export { VideoContentRenderer, AudioContentRenderer, TextContentRenderer } from './mediatype'

// 导出基础接口（从类型定义中重新导出）
export type {
  ContentRenderer,
  ContentRenderContext,
  StatusRendererType,
  MediaTypeRendererType,
  RendererType,
} from '../../types/clipRenderer'
