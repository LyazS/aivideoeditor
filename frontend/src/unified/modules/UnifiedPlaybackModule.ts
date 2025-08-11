import { createPlaybackModule, type PlaybackModule } from '@/stores/modules/playbackModule'

/**
 * 统一播放控制管理模块
 * 负责管理播放状态和时间控制
 *
 * 注意：此模块是对旧架构playbackModule的封装，用于统一新架构的模块导入方式
 */
export function createUnifiedPlaybackModule(frameRate: { value: number }) {
  // 直接使用旧架构的playbackModule
  const playbackModule = createPlaybackModule(frameRate)

  return {
    // 导出所有playbackModule的状态和方法
    ...playbackModule,
  }
}

// 导出类型定义
export type UnifiedPlaybackModule = ReturnType<typeof createUnifiedPlaybackModule>
