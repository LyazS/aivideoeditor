/**
 * WebAV调试工具
 * 用于在WebAV初始化流程中添加详细的调试信息
 */

/**
 * 调试日志前缀和分组
 */
export const DEBUG_GROUPS = {
  // 🚀 初始化相关
  INIT: {
    PREFIX: '🚀 [WebAV Init]',
    CONTAINER: '📦 [Container]',
    CANVAS: '🎨 [Canvas]',
    EVENTS: '🎧 [Events]'
  },

  // 🔄 画布重建相关
  REBUILD: {
    PREFIX: '🔄 [Canvas Rebuild]',
    DESTROY: '💥 [Destroy]',
    BACKUP: '📦 [Backup]',
    RESTORE: '🔄 [Restore]',
    COORDS: '📐 [Coordinates]'
  },

  // 🎬 组件生命周期相关
  LIFECYCLE: {
    PREFIX: '🎬 [Lifecycle]',
    RENDERER: '🖼️ [Renderer]',
    ENGINE: '⚙️ [Engine]',
    STORE: '🏪 [Store]'
  },

  // ⚡ 性能监控相关
  PERFORMANCE: {
    PREFIX: '⚡ [Performance]',
    TIMER: '⏱️ [Timer]',
    STATS: '📊 [Stats]'
  }
} as const

// ==================== 🚀 初始化相关调试函数 ====================

/**
 * 记录WebAV初始化开始
 */
export function logWebAVInitStart(params: {
  hasContainer: boolean
  containerType?: string
  containerSize?: string
  options?: any
}) {
  console.group(`${DEBUG_GROUPS.INIT.PREFIX} Starting WebAV Canvas initialization`)
  console.log(`${DEBUG_GROUPS.INIT.PREFIX} Parameters:`, params)
}

/**
 * 记录WebAV初始化步骤
 */
export function logWebAVInitStep(stepNumber: number, stepName: string, details?: any) {
  console.log(`${DEBUG_GROUPS.INIT.PREFIX} Step ${stepNumber}: ${stepName}`)
  if (details) {
    console.log(`${DEBUG_GROUPS.INIT.PREFIX} Details:`, details)
  }
}

/**
 * 记录WebAV初始化成功
 */
export function logWebAVInitSuccess(totalTime: number, details?: any) {
  console.log(`🎉 ${DEBUG_GROUPS.INIT.PREFIX} Initialization completed successfully!`, {
    totalTime: `${totalTime.toFixed(2)}ms`,
    ...details
  })
  console.groupEnd()
}

/**
 * 记录WebAV初始化失败
 */
export function logWebAVInitError(error: Error, totalTime: number, context?: any) {
  console.error(`❌ ${DEBUG_GROUPS.INIT.PREFIX} Initialization failed!`, {
    error: error.message,
    errorStack: error.stack,
    totalTime: `${totalTime.toFixed(2)}ms`,
    ...context
  })
  console.groupEnd()
}

/**
 * 记录容器创建
 */
export function logContainerCreation(options: any) {
  console.log(`${DEBUG_GROUPS.INIT.CONTAINER} Creating canvas container...`)
  console.log(`${DEBUG_GROUPS.INIT.CONTAINER} Options:`, options)
}

/**
 * 记录容器创建成功
 */
export function logContainerCreated(details: any) {
  console.log(`✅ ${DEBUG_GROUPS.INIT.CONTAINER} Container created successfully:`, details)
}



// ==================== 🔄 画布重建相关调试函数 ====================

/**
 * 记录画布销毁开始
 */
export function logCanvasDestroyStart(state: any) {
  console.group(`${DEBUG_GROUPS.REBUILD.PREFIX} Starting canvas destruction`)
  console.log(`${DEBUG_GROUPS.REBUILD.DESTROY} Current state:`, state)
}

/**
 * 记录备份过程
 */
export function logCanvasBackup(spriteCount: number, backupData: any) {
  console.log(`${DEBUG_GROUPS.REBUILD.BACKUP} Backing up ${spriteCount} sprites`)
  console.log(`${DEBUG_GROUPS.REBUILD.BACKUP} Backup data:`, backupData)
}

/**
 * 记录画布销毁完成
 */
export function logCanvasDestroyComplete(time: number, spriteCount: number) {
  console.log(`✅ ${DEBUG_GROUPS.REBUILD.DESTROY} Destruction completed`, {
    time: `${time.toFixed(2)}ms`,
    backupSprites: spriteCount
  })
  console.groupEnd()
}

/**
 * 记录画布重建开始
 */
export function logCanvasRecreateStart(params: any) {
  console.group(`${DEBUG_GROUPS.REBUILD.PREFIX} Starting canvas recreation`)
  console.log(`${DEBUG_GROUPS.REBUILD.PREFIX} Parameters:`, params)
}

/**
 * 记录Sprite恢复过程
 */
export function logSpriteRestore(spriteId: string, step: string, details?: any) {
  console.log(`${DEBUG_GROUPS.REBUILD.RESTORE} ${step}: ${spriteId}`, details || '')
}

/**
 * 记录坐标转换
 */
export function logCoordinateTransform(spriteId: string, transform: any) {
  console.log(`${DEBUG_GROUPS.REBUILD.COORDS} Coordinate transform: ${spriteId}`, transform)
}

/**
 * 记录画布重建完成
 */
export function logCanvasRecreateComplete(time: number, stats: any) {
  console.log(`🎉 ${DEBUG_GROUPS.REBUILD.PREFIX} Recreation completed successfully!`, {
    time: `${time.toFixed(2)}ms`,
    ...stats
  })
  console.groupEnd()
}

// ==================== 🎬 组件生命周期相关调试函数 ====================

/**
 * 记录渲染器状态
 */
export function logRendererState(state: any) {
  console.log(`${DEBUG_GROUPS.LIFECYCLE.RENDERER} State:`, state)
}

/**
 * 记录Store状态变化
 */
export function logStoreStateChange(method: string, data: any) {
  console.log(`${DEBUG_GROUPS.LIFECYCLE.STORE} ${method}:`, data)
}

/**
 * 记录组件生命周期
 */
export function logComponentLifecycle(component: string, lifecycle: string, data?: any) {
  const lifecycleEmojis: Record<string, string> = {
    mounted: '🔄',
    unmounted: '🔄',
    created: '🆕',
    destroyed: '💥'
  }

  const emoji = lifecycleEmojis[lifecycle] || '🔄'
  console.log(`${emoji} ${DEBUG_GROUPS.LIFECYCLE.PREFIX} [${component}] ${lifecycle}`, data || '')
}

/**
 * 记录WebAV就绪状态变化
 */
export function logWebAVReadyStateChange(isReady: boolean, wasReady?: boolean) {
  console.log(`${DEBUG_GROUPS.LIFECYCLE.ENGINE} WebAV ready state changed:`, {
    isReady,
    wasReady,
    stateChange: wasReady === undefined ? 'initial' : (isReady ? 'ready' : 'not-ready'),
    timestamp: new Date().toISOString()
  })

  if (isReady && !wasReady) {
    console.log(`🎉 ${DEBUG_GROUPS.LIFECYCLE.ENGINE} WebAV is now ready! Timeline will be rendered.`)
  } else if (!isReady && wasReady) {
    console.log(`⚠️ ${DEBUG_GROUPS.LIFECYCLE.ENGINE} WebAV is no longer ready! Timeline will be hidden.`)
  }
}

// ==================== ⚡ 性能监控相关调试函数 ====================

/**
 * 创建性能计时器
 */
export function createPerformanceTimer(name: string) {
  const startTime = performance.now()
  console.log(`${DEBUG_GROUPS.PERFORMANCE.TIMER} Starting: ${name}`)

  return {
    end: () => {
      const endTime = performance.now()
      const duration = endTime - startTime
      console.log(`${DEBUG_GROUPS.PERFORMANCE.TIMER} Completed: ${name} - ${duration.toFixed(2)}ms`)
      return duration
    }
  }
}

/**
 * 记录性能统计
 */
export function logPerformanceStats(operation: string, stats: any) {
  console.log(`${DEBUG_GROUPS.PERFORMANCE.STATS} ${operation}:`, stats)
}

// ==================== 🔧 通用调试工具函数 ====================

/**
 * 创建分组日志
 */
export function createDebugGroup(title: string, callback: () => void) {
  console.group(title)
  try {
    callback()
  } finally {
    console.groupEnd()
  }
}

/**
 * 记录详细的初始化流程
 */
export function logDetailedInitFlow(step: string, details: any) {
  console.group(`🔍 [WebAV Init Flow] ${step}`)
  console.log(details)
  console.groupEnd()
}

/**
 * 条件调试日志（只在开发环境输出）
 */
export function debugLog(message: string, data?: any) {
  if (import.meta.env.DEV) {
    console.log(message, data || '')
  }
}

/**
 * 错误调试日志
 */
export function debugError(message: string, error: Error, context?: any) {
  console.error(message, {
    error: error.message,
    stack: error.stack,
    ...context
  })
}
