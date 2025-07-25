/**
 * 统一时间轴项目使用示例
 * 展示如何使用统一时间轴项目的各种功能
 */

import { watch } from 'vue'
import {
  // 核心类型
  type UnifiedTimelineItem,
  type TimelineStatusContext,
  
  // 工厂函数
  createVideoTimelineItem,
  createTextTimelineItem,
  
  // 查询函数
  UnifiedTimelineItemQueries,
  
  // 行为函数
  UnifiedTimelineItemActions,
  
  // 上下文模板
  TIMELINE_CONTEXT_TEMPLATES,
  createDownloadContext,
  
  // 工具函数
  TimelineContextUtils,
  getTimelineItemDisplayStatus,
  getTimelineItemProgress
} from './index'

// ==================== 基础使用示例 ====================

/**
 * 示例1：创建视频时间轴项目
 */
export function example1_CreateVideoTimelineItem(): UnifiedTimelineItem {
  console.log('📝 示例1：创建视频时间轴项目')
  
  const videoItem = createVideoTimelineItem({
    mediaItemId: 'media-video-001',
    trackId: 'track-video-001',
    name: '示例视频',
    startTime: 0,
    endTime: 1800, // 30秒 @ 60fps
    mediaConfig: {
      x: 100,
      y: 100,
      width: 1280,
      height: 720,
      volume: 0.8,
      playbackRate: 1.0
    }
  })
  
  console.log('✅ 视频项目创建成功:', videoItem.config.name)
  return videoItem
}

/**
 * 示例2：创建文本时间轴项目
 */
export function example2_CreateTextTimelineItem(): UnifiedTimelineItem {
  console.log('📝 示例2：创建文本时间轴项目')
  
  const textItem = createTextTimelineItem({
    mediaItemId: 'media-text-001',
    trackId: 'track-text-001',
    name: '示例文本',
    startTime: 600,  // 10秒开始
    endTime: 1200,   // 20秒结束
    text: '这是一个示例文本',
    style: {
      fontSize: 64,
      color: '#ff6b6b',
      fontWeight: 'bold'
    }
  })
  
  console.log('✅ 文本项目创建成功:', textItem.config.name)
  return textItem
}

// ==================== 状态管理示例 ====================

/**
 * 示例3：状态转换和上下文管理
 */
export function example3_StateTransitionDemo(item: UnifiedTimelineItem): void {
  console.log('📝 示例3：状态转换演示')
  
  // 检查当前状态
  console.log('当前状态:', item.timelineStatus)
  console.log('是否可以转换到ready:', UnifiedTimelineItemQueries.canTransitionTo(item, 'ready'))
  
  // 转换到下载状态
  const downloadContext = createDownloadContext(25, {
    speed: '2.5 MB/s',
    downloadedBytes: 25 * 1024 * 1024,
    totalBytes: 100 * 1024 * 1024
  })
  
  UnifiedTimelineItemActions.transitionToLoading(item, downloadContext)
  console.log('✅ 已转换到下载状态')
  
  // 模拟下载进度更新
  setTimeout(() => {
    const progressContext = createDownloadContext(75, {
      speed: '3.2 MB/s',
      message: '下载进度 75%'
    })
    UnifiedTimelineItemActions.transitionTo(item, 'loading', progressContext)
    console.log('📊 下载进度已更新')
  }, 1000)
  
  // 模拟下载完成
  setTimeout(() => {
    const readyContext = TIMELINE_CONTEXT_TEMPLATES.ready({
      duration: 1800,
      resolution: '1920x1080',
      format: 'mp4'
    })
    UnifiedTimelineItemActions.transitionToReady(item, readyContext)
    console.log('✅ 下载完成，项目已就绪')
  }, 2000)
}

// ==================== 响应式监听示例 ====================

/**
 * 示例4：Vue3响应式监听
 */
export function example4_ReactiveWatching(item: UnifiedTimelineItem): void {
  console.log('📝 示例4：响应式监听演示')
  
  // 监听状态变化
  watch(
    () => item.timelineStatus,
    (newStatus, oldStatus) => {
      console.log(`🔄 状态变化: ${oldStatus} → ${newStatus}`)
      
      // 根据状态执行不同逻辑
      switch (newStatus) {
        case 'loading':
          console.log('⏳ 项目正在处理中...')
          break
        case 'ready':
          console.log('✅ 项目已就绪，可以使用')
          break
        case 'error':
          console.log('❌ 项目出现错误')
          break
      }
    }
  )
  
  // 监听进度变化
  watch(
    () => getTimelineItemProgress(item),
    (progress) => {
      if (progress.hasProgress) {
        console.log(`📊 进度更新: ${progress.percent}%${progress.detail ? ` - ${progress.detail}` : ''}`)
      }
    },
    { deep: true }
  )
  
  // 监听配置变化
  watch(
    () => item.config,
    (newConfig) => {
      console.log('⚙️ 配置已更新:', newConfig.name)
    },
    { deep: true }
  )
}

// ==================== 事件系统示例 ====================

/**
 * 示例5：响应式状态监听（替代事件系统）
 */
export function example5_ReactiveStateDemo(item: UnifiedTimelineItem): void {
  console.log('📝 示例5：响应式状态监听演示')

  // 使用Vue3的watch监听状态变化
  watch(
    () => item.timelineStatus,
    (newStatus, oldStatus) => {
      console.log('🎉 状态变化监听:', {
        itemName: item.config.name,
        transition: `${oldStatus} → ${newStatus}`,
        timestamp: new Date().toLocaleTimeString()
      })

      // 根据状态变化执行业务逻辑
      if (newStatus === 'ready') {
        console.log('🎭 项目就绪，可以创建Sprite')
      } else if (newStatus === 'error') {
        console.log('🚨 项目出错，需要处理错误')
      }
    }
  )

  // 监听状态上下文变化
  watch(
    () => item.statusContext,
    (context) => {
      if (context) {
        console.log('📊 状态上下文更新:', {
          stage: context.stage,
          message: context.message
        })
      }
    },
    { deep: true }
  )
}

// ==================== 类型安全示例 ====================

/**
 * 示例6：类型安全的上下文处理
 */
export function example6_TypeSafeContextHandling(context: TimelineStatusContext): void {
  console.log('📝 示例6：类型安全的上下文处理')
  
  // 使用类型守卫进行安全的上下文访问
  if (TimelineContextUtils.isDownloading(context)) {
    // TypeScript 知道这里是 DownloadContext
    console.log(`下载进度: ${context.progress.percent}%`)
    if (context.downloadSpeed) {
      console.log(`下载速度: ${context.downloadSpeed}`)
    }
    if (context.downloadedBytes && context.totalBytes) {
      console.log(`已下载: ${context.downloadedBytes}/${context.totalBytes} 字节`)
    }
  } else if (TimelineContextUtils.isParsing(context)) {
    // TypeScript 知道这里是 ParseContext
    console.log(`解析进度: ${context.progress.percent}%`)
    if (context.currentStep) {
      console.log(`当前步骤: ${context.currentStep}`)
    }
  } else if (TimelineContextUtils.hasError(context)) {
    // TypeScript 知道这里是 ErrorContext
    console.log(`错误: ${context.error.message}`)
    console.log(`错误代码: ${context.error.code}`)
    console.log(`可恢复: ${context.error.recoverable ? '是' : '否'}`)
  } else if (TimelineContextUtils.isReady(context)) {
    // TypeScript 知道这里是 ReadyContext
    console.log('项目已就绪')
    if (context.metadata) {
      console.log('元数据:', context.metadata)
    }
  }
}

// ==================== 批量操作示例 ====================

/**
 * 示例7：批量操作
 */
export function example7_BatchOperations(): void {
  console.log('📝 示例7：批量操作演示')
  
  // 创建多个项目
  const items = [
    createVideoTimelineItem({
      mediaItemId: 'media-1',
      name: '视频1',
      startTime: 0,
      endTime: 600
    }),
    createVideoTimelineItem({
      mediaItemId: 'media-2',
      name: '视频2',
      startTime: 600,
      endTime: 1200
    }),
    createTextTimelineItem({
      mediaItemId: 'media-3',
      name: '文本1',
      startTime: 1200,
      endTime: 1800,
      text: '结束文本'
    })
  ]
  
  console.log(`✅ 创建了 ${items.length} 个项目`)
  
  // 批量状态转换
  const errorContext = TIMELINE_CONTEXT_TEMPLATES.error('批量测试错误', 'BATCH_TEST')
  const result = UnifiedTimelineItemActions.batchTransition(items, 'error', errorContext)
  
  console.log(`📦 批量转换结果: 成功 ${result.success.length}, 失败 ${result.failed.length}`)
  
  // 批量查询
  const readyItems = items.filter(item => UnifiedTimelineItemQueries.isReady(item))
  const errorItems = items.filter(item => UnifiedTimelineItemQueries.hasError(item))
  
  console.log(`📊 状态统计: 就绪 ${readyItems.length}, 错误 ${errorItems.length}`)
}

// ==================== 完整工作流示例 ====================

/**
 * 示例8：完整的时间轴项目生命周期
 */
export async function example8_CompleteWorkflow(): Promise<void> {
  console.log('📝 示例8：完整工作流演示')
  
  // 1. 创建项目
  const item = createVideoTimelineItem({
    mediaItemId: 'workflow-demo',
    name: '工作流演示视频',
    startTime: 0,
    endTime: 3600 // 1分钟
  })
  
  console.log('1️⃣ 项目已创建')
  
  // 2. 设置响应式监听
  const stopWatching = watch(
    () => item.timelineStatus,
    (newStatus, oldStatus) => {
      console.log(`🔄 工作流状态变化: ${oldStatus} → ${newStatus}`)
    }
  )
  
  // 3. 模拟异步处理流程
  console.log('2️⃣ 开始异步处理...')
  
  // 下载阶段
  UnifiedTimelineItemActions.transitionToLoading(item, TIMELINE_CONTEXT_TEMPLATES.downloadStart())
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 解析阶段
  UnifiedTimelineItemActions.transitionTo(item, 'loading', TIMELINE_CONTEXT_TEMPLATES.parseStart())
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 完成
  UnifiedTimelineItemActions.transitionToReady(item, TIMELINE_CONTEXT_TEMPLATES.ready({
    duration: 3600,
    resolution: '1920x1080',
    format: 'mp4'
  }))
  
  console.log('3️⃣ 处理完成，项目已就绪')
  
  // 4. 验证最终状态
  console.log('4️⃣ 最终状态验证:')
  console.log('- 是否就绪:', UnifiedTimelineItemQueries.isReady(item))
  console.log('- 是否可用:', UnifiedTimelineItemQueries.isAvailable(item))
  console.log('- 显示状态:', getTimelineItemDisplayStatus(item))
  
  // 清理响应式监听
  stopWatching()
}
