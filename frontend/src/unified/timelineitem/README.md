# 统一时间轴项目设计

基于重构文档 `10-统一时间轴项目设计-类型设计.md` 的完整实现。

## 🎯 设计目标

将当前的双重时间轴项目系统（`LocalTimelineItem` 和 `AsyncProcessingTimelineItem`）统一为单一的 `UnifiedTimelineItem`，采用状态驱动的设计模式，实现时间轴项目的自动化生命周期管理。

## 🏗️ 核心设计理念

### 1. 状态驱动的统一架构
- 将"本地"和"异步"从**类型区分**改为**状态区分**
- 采用三层状态映射：数据源状态 → 媒体项目状态 → 时间轴项目状态
- 自动化的Sprite生命周期管理

### 2. 3状态简化方案
```typescript
type TimelineItemStatus = 
  | 'ready'    // 完全就绪，可用于时间轴
  | 'loading'  // 正在处理中，包含下载、解析、等待
  | 'error'    // 不可用状态，包含错误、缺失、取消
```

### 3. 状态上下文承载细节
- `BasicTimelineConfig`：静态配置，"这个项目是什么"
- `TimelineStatusContext`：动态状态，"这个项目现在怎么样"

## 📁 文件结构

```
frontend/src/unified/timelineitem/
├── types.ts              # 核心类型定义
├── queries.ts            # 查询函数（无状态）
├── actions.ts            # 行为函数（无状态）
├── contextTemplates.ts   # 状态上下文模板
├── factory.ts            # 工厂函数和创建工具
├── examples.ts           # 使用示例
├── index.ts              # 主入口文件
└── README.md             # 本文档
```

## 🚀 快速开始

### 1. 创建时间轴项目

```typescript
import { createVideoTimelineItem } from '@/unified/timelineitem'

// 创建视频项目
const videoItem = createVideoTimelineItem({
  mediaItemId: 'media-001',
  trackId: 'track-001',
  name: '我的视频',
  startTime: 0,
  endTime: 1800, // 30秒 @ 60fps
  mediaConfig: {
    x: 100,
    y: 100,
    width: 1280,
    height: 720,
    volume: 0.8
  }
})
```

### 2. 状态管理

```typescript
import { 
  UnifiedTimelineItemActions, 
  UnifiedTimelineItemQueries,
  TIMELINE_CONTEXT_TEMPLATES 
} from '@/unified/timelineitem'

// 检查状态
if (UnifiedTimelineItemQueries.canTransitionTo(item, 'ready')) {
  // 转换到就绪状态
  UnifiedTimelineItemActions.transitionToReady(
    item, 
    TIMELINE_CONTEXT_TEMPLATES.ready()
  )
}

// 查询状态
const isReady = UnifiedTimelineItemQueries.isReady(item)
const progress = UnifiedTimelineItemQueries.getProgress(item)
```

### 3. 响应式监听

```typescript
import { watch } from 'vue'

// 监听状态变化
watch(
  () => item.timelineStatus,
  (newStatus, oldStatus) => {
    console.log(`状态变化: ${oldStatus} → ${newStatus}`)

    // 根据状态变化执行业务逻辑
    if (newStatus === 'ready') {
      console.log('项目已就绪，可以创建Sprite')
    } else if (newStatus === 'error') {
      console.log('项目出错，需要处理错误')
    }
  }
)

// 监听进度变化
watch(
  () => UnifiedTimelineItemQueries.getProgress(item),
  (progress) => {
    if (progress !== undefined) {
      console.log(`进度: ${progress}%`)
    }
  }
)

// 监听状态上下文变化
watch(
  () => item.statusContext,
  (context) => {
    if (context) {
      console.log('状态上下文更新:', context.message)
    }
  },
  { deep: true }
)
```

## 🔧 核心API

### 查询函数 (UnifiedTimelineItemQueries)

```typescript
// 状态检查
isLoading(item): boolean
isReady(item): boolean
hasError(item): boolean
isAvailable(item): boolean

// 状态转换验证
canTransitionTo(item, newStatus): boolean
canRetry(item): boolean
canCancel(item): boolean

// 信息获取
getProgress(item): number | undefined
getStatusMessage(item): string
getError(item): ErrorInfo | undefined
getTimeRange(item): TimeRangeInfo
```

### 行为函数 (UnifiedTimelineItemActions)

```typescript
// 状态转换
transitionTo(item, newStatus, context?): boolean
transitionToLoading(item, context?): boolean
transitionToReady(item, context?): boolean
transitionToError(item, context?): boolean

// 配置管理
updateConfig(item, config): void
updateName(item, name): void
updateMediaConfig(item, mediaConfig): void

// 时间范围管理
updateTimeRange(item, timeRange): void
setStartTime(item, startTime): void
setEndTime(item, endTime): void
setDuration(item, duration): void

// 便捷操作
retry(item): boolean
cancel(item): boolean
reset(item): boolean
```

### 工厂函数

```typescript
// 通用创建
createUnifiedTimelineItem(params): UnifiedTimelineItem

// 特定类型创建
createVideoTimelineItem(params): UnifiedTimelineItem
createImageTimelineItem(params): UnifiedTimelineItem
createAudioTimelineItem(params): UnifiedTimelineItem
createTextTimelineItem(params): UnifiedTimelineItem

// 工具函数
cloneTimelineItem(sourceItem, overrides?): UnifiedTimelineItem
restoreTimelineItemFromData(data): UnifiedTimelineItem
```

## 🎨 状态上下文系统

### 上下文类型

```typescript
// 下载上下文
interface DownloadContext {
  stage: 'downloading'
  progress: { percent: number; detail?: string }
  downloadSpeed?: string
  downloadedBytes?: number
  totalBytes?: number
}

// 解析上下文
interface ParseContext {
  stage: 'parsing'
  progress: { percent: number; detail?: string }
  currentStep?: string
  totalSteps?: number
}

// 错误上下文
interface ErrorContext {
  stage: 'error'
  error: {
    code: string
    message: string
    recoverable: boolean
  }
}
```

### 上下文模板

```typescript
import { TIMELINE_CONTEXT_TEMPLATES } from '@/unified/timelineitem'

// 使用预定义模板
const downloadContext = TIMELINE_CONTEXT_TEMPLATES.downloadStart()
const errorContext = TIMELINE_CONTEXT_TEMPLATES.networkError('连接超时')

// 创建自定义上下文
const customContext = createDownloadContext(50, {
  speed: '2.5 MB/s',
  message: '正在下载视频文件...'
})
```

## 🔄 状态转换规则

```typescript
const VALID_TIMELINE_TRANSITIONS = {
  'loading': ['ready', 'error'],  // loading完成后变为就绪或错误
  'ready': ['loading', 'error'],  // 重新处理或出错
  'error': ['loading', 'ready']   // 重试或恢复
}
```

## 🎭 Sprite生命周期管理

时间轴项目的Sprite生命周期完全由状态驱动：

- `loading` 状态：无Sprite
- `ready` 状态：有Sprite，可用于渲染
- `error` 状态：无Sprite

## 📊 媒体状态映射

```typescript
const MEDIA_TO_TIMELINE_STATUS_MAP = {
  'pending': 'loading',           // 等待开始处理
  'asyncprocessing': 'loading',   // 下载/获取中
  'webavdecoding': 'loading',     // 解析中
  'ready': 'ready',               // 完全就绪
  'error': 'error',               // 各种错误状态
  'cancelled': 'error',           // 用户取消
  'missing': 'error'              // 文件缺失
}
```

## 🎯 设计优势

### 1. 架构显著简化
- **极致简化**：从6状态24种转换简化为3状态9种转换
- **逻辑统一**：所有"未完成"统一为loading，所有"不可用"统一为error
- **类型安全**：通过泛型接口确保每个状态都有准确的类型定义

### 2. 开发体验飞跃
- **类型维护成本大幅降低**：状态枚举6个→3个
- **Vue3响应式系统的完美支持**
- **智能提示**：IDE提供准确的属性和方法提示

### 3. 用户体验保持完整
- **进度展示**：通过上下文保持细致进度信息
- **错误引导**：通过错误上下文提供具体恢复路径
- **视觉一致性**：所有loading/error状态外观统一

## 📝 使用示例

详细的使用示例请参考 `examples.ts` 文件，包含：

1. 基础项目创建
2. 状态转换管理
3. 响应式监听
4. 事件系统使用
5. 类型安全的上下文处理
6. 批量操作
7. 完整工作流演示

## 🔗 相关文档

- [重构文档：10-统一时间轴项目设计-类型设计.md](../../../docs/重构文档/10-统一时间轴项目设计-类型设计.md)
- [重构文档：11-统一时间轴项目设计-扩展类型.md](../../../docs/重构文档/11-统一时间轴项目设计-扩展类型.md)
- [重构文档：12-统一时间轴项目设计-使用示例.md](../../../docs/重构文档/12-统一时间轴项目设计-使用示例.md)
