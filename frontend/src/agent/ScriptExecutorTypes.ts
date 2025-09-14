/**
 * 操作配置接口
 */
export interface OperationConfig {
  type: string
  params: any
  timestamp: number
  id: string
}

/**
 * 执行API接口 - 定义用户脚本可调用的函数
 */
export interface ExecutionAPI {
  // 时间轴项目操作
  addTimelineItem: (item: any) => OperationConfig
  rmTimelineItem: (id: string) => OperationConfig
  mvTimelineItem: (id: string, position: string, trackId?: string) => OperationConfig
  
  // 轨道操作
  addTrack: (type?: string, position?: number) => OperationConfig
  rmTrack: (id: string) => OperationConfig
  renameTrack: (id: string, name: string) => OperationConfig
  
  // 文本操作
  updateTextContent: (id: string, text: string, style?: any) => OperationConfig
  updateTextStyle: (id: string, style: any) => OperationConfig
  
  // 关键帧操作
  createKeyframe: (id: string, position: string) => OperationConfig
  deleteKeyframe: (id: string, position: string) => OperationConfig
  updateKeyframeProperty: (id: string, position: string, property: string, value: any) => OperationConfig
  clearAllKeyframes: (id: string) => OperationConfig
  
  // 其他操作
  splitTimelineItem: (id: string, position: string) => OperationConfig
  cpTimelineItem: (id: string, position: string, trackId?: string) => OperationConfig
  resizeTimelineItem: (id: string, timeRange: any) => OperationConfig
  updateTimelineItemTransform: (id: string, transform: any) => OperationConfig
  
  autoArrangeTrack: (id: string) => OperationConfig
  toggleTrackVisibility: (id: string, visible: boolean) => OperationConfig
  toggleTrackMute: (id: string, muted: boolean) => OperationConfig
}

/**
 * Web Worker执行器接口
 */
export interface WebWorkerExecutor {
  registerFunctions(fnMap: Record<string, string>): Promise<void>
  exec(code: string, args?: Record<string, any>, timeout?: number): Promise<any>
  terminate(): void
}