/**
 * 统一模块系统导出
 * 提供基于新架构统一类型的模块功能
 */

// ==================== 统一轨道模块 ====================
export {
  createUnifiedTrackModule,
  type UnifiedTrackModule
} from './UnifiedTrackModule'

// ==================== 统一媒体模块 ====================
export {
  createUnifiedMediaModule,
  type UnifiedMediaModule
} from './UnifiedMediaModule'

// ==================== 统一时间轴模块 ====================
export {
  createUnifiedTimelineModule,
  type UnifiedTimelineModule
} from './UnifiedTimelineModule'

// ==================== 统一项目模块 ====================
export {
  createUnifiedProjectModule,
  type UnifiedProjectModule
} from './UnifiedProjectModule'

// ==================== 统一视口模块 ====================
export {
  createUnifiedViewportModule,
  type UnifiedViewportModule
} from './UnifiedViewportModule'

// ==================== 统一选择模块 ====================
export {
  createUnifiedSelectionModule,
  type UnifiedSelectionModule
} from './UnifiedSelectionModule'

// ==================== 统一片段操作模块 ====================
export {
  createUnifiedClipOperationsModule,
  type UnifiedClipOperationsModule
} from './UnifiedClipOperationsModule'
