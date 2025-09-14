# ScriptExecutor - 脚本执行器

ScriptExecutor 是一个安全的JavaScript代码执行环境，专门用于音视频编辑场景。它在Web Worker沙箱中执行用户脚本，并将函数调用转换为操作配置。

## 主要特性

- 🛡️ **安全沙箱执行**: 使用Web Worker隔离执行环境
- ⚡ **异步执行**: 非阻塞主线程，支持超时控制
- 🔄 **操作转换**: 自动将函数调用转换为标准化的操作配置
- 📋 **类型安全**: TypeScript支持，完整的类型定义
- 🔧 **可扩展**: 易于添加新的API函数

## 快速开始

```typescript
import { ScriptExecutor } from '@/agent'

// 创建执行器实例
const executor = new ScriptExecutor()

// 定义用户脚本
const userScript = `
addTrack('video')
addTimelineItem({
  mediaItemId: 'video-1',
  trackId: 'track-1',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:10.00'
  }
})
createKeyframe('video-1', '00:00:05.00')
`

// 执行脚本
try {
  const operations = await executor.executeScript(userScript)
  console.log('生成的操作配置:', operations)
} catch (error) {
  console.error('脚本执行失败:', error)
}
```

## 可用API函数

### 时间轴项目操作
```javascript
addTimelineItem(item)           // 添加时间轴项目
rmTimelineItem(id)              // 移除时间轴项目
mvTimelineItem(id, position, trackId?)  // 移动时间轴项目
```

### 轨道操作
```javascript
addTrack(type?, position?)      // 添加轨道 (type: 'video' | 'audio')
rmTrack(id)                     // 移除轨道
renameTrack(id, name)           // 重命名轨道
```

### 文本操作
```javascript
updateTextContent(id, text, style?)     // 更新文本内容
updateTextStyle(id, style)              // 更新文本样式
```

### 关键帧操作
```javascript
createKeyframe(id, position)                    // 创建关键帧
deleteKeyframe(id, position)                    // 删除关键帧
updateKeyframeProperty(id, position, property, value)  // 更新关键帧属性
clearAllKeyframes(id)                           // 清除所有关键帧
```

### 其他操作
```javascript
splitTimelineItem(id, position)         // 分割时间轴项目
cpTimelineItem(id, position, trackId?)  // 复制时间轴项目
resizeTimelineItem(id, timeRange)       // 调整时间轴项目大小
updateTimelineItemTransform(id, transform)  // 更新项目变换
autoArrangeTrack(id)                    // 自动排列轨道
toggleTrackVisibility(id, visible)      // 切换轨道可见性
toggleTrackMute(id, muted)              // 切换轨道静音
```

## 使用示例

### 基础编辑操作
```javascript
// 添加视频轨道
addTrack('video')

// 添加音频轨道
addTrack('audio')

// 导入视频片段
addTimelineItem({
  mediaItemId: 'video-1',
  trackId: 'video-track-1',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:08.00'
  }
})

// 导入音频
addTimelineItem({
  mediaItemId: 'audio-1',
  trackId: 'audio-track-1',
  timeRange: {
    start: '00:00:00.00',
    end: '00:00:05.00'
  }
})
```

### 文本处理
```javascript
// 添加文本项目
addTimelineItem({
  mediaItemId: 'text-1',
  trackId: 'video-track-1',
  timeRange: {
    start: '00:00:02.00',
    end: '00:00:08.00'
  }
})

// 更新文本内容
updateTextContent('text-1', '欢迎使用本系统', {
  fontSize: 24,
  color: '#ffffff',
  backgroundColor: 'rgba(0,0,0,0.5)',
  fontFamily: 'Arial'
})
```

### 关键帧动画
```javascript
// 创建淡入效果
createKeyframe('video-1', '00:00:00.00')
updateKeyframeProperty('video-1', '00:00:00.00', 'opacity', 0)

createKeyframe('video-1', '00:00:01.00')
updateKeyframeProperty('video-1', '00:00:01.00', 'opacity', 1)

// 创建缩放动画
createKeyframe('video-1', '00:00:02.00')
updateKeyframeProperty('video-1', '00:00:02.00', 'scale', 1)

createKeyframe('video-1', '00:00:04.00')
updateKeyframeProperty('video-1', '00:00:04.00', 'scale', 1.5)
```

## 返回的操作配置

每个函数调用都会生成一个操作配置对象，格式如下：

```typescript
interface OperationConfig {
  type: string        // 操作类型
  params: any         // 操作参数
  timestamp: number   // 时间戳
  id: string          // 唯一ID
}
```

### 示例输出
```json
[
  {
    "type": "addTrack",
    "params": { "type": "video", "position": undefined },
    "timestamp": 1694681234567,
    "id": "op_1694681234567_abc123"
  },
  {
    "type": "addTimelineItem",
    "params": {
      "mediaItemId": "video-1",
      "trackId": "track-1",
      "timeRange": {
        "start": "00:00:00.00",
        "end": "00:00:10.00"
      }
    },
    "timestamp": 1694681234568,
    "id": "op_1694681234568_def456"
  }
]
```

## 错误处理

ScriptExecutor 提供了完善的错误处理机制：

```typescript
try {
  const operations = await executor.executeScript(userScript)
  // 处理成功结果
} catch (error) {
  if (error.message.includes('执行超时')) {
    // 处理超时错误
  } else if (error.message.includes('语法错误')) {
    // 处理语法错误
  } else {
    // 处理其他错误
  }
}
```

## 安全特性

### Web Worker隔离
- 用户脚本在独立的Worker线程中执行
- 无法访问主线程的全局变量和DOM
- 意外错误不会导致主线程崩溃

### 超时控制
```typescript
// 默认5秒超时
const executor = new ScriptExecutor()

// 自定义超时时间（毫秒）
const customExecutor = new ScriptExecutor(10000) // 10秒
```

### 内存管理
- Worker执行完成后自动清理资源
- 支持手动终止Worker
- 防止内存泄漏

## 开发测试

项目包含测试功能，可以通过创建简单的测试脚本来验证功能。

## 扩展开发

要添加新的API函数，需要在以下地方修改：

1. **ScriptExecutorTypes.ts** - 添加函数签名到 `ExecutionAPI` 接口
2. **ScriptExecutor.ts** - 在 `createExecutionAPI()` 方法中实现函数逻辑
3. **Worker代码** - 在 `createAPI()` 方法中添加对应的Worker端实现

## 注意事项

1. **参数验证**: ScriptExecutor 不验证参数的正确性，使用时需要确保参数有效
2. **执行时间**: 复杂脚本可能需要更长的超时时间
3. **浏览器兼容性**: 需要现代浏览器支持 Web Workers
4. **内存使用**: 大量操作可能会占用较多内存，建议定期清理

## 相关文档

- [执行系统设计文档](../../../docs/ExecutionSystemDesign.md) - 完整的执行系统架构
- [类型定义文件](./ScriptExecutorTypes.ts) - 详细的类型定义
- [模块索引](./index.ts) - Agent模块系统