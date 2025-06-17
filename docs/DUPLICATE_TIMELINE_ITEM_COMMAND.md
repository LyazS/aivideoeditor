# DuplicateTimelineItemCommand 实现文档

## 📋 概述

DuplicateTimelineItemCommand 是操作记录系统中用于复制时间轴项目的命令类，支持撤销/重做功能。该命令遵循"从源头重建"原则，确保复制操作的可靠性和一致性。

## 🎯 功能特性

### 核心功能
- ✅ 支持视频和图片时间轴项目的复制
- ✅ 自动调整复制项目的时间位置，避免重叠
- ✅ 完整复制所有变换属性（位置、大小、旋转、透明度、层级）
- ✅ 支持撤销/重做操作
- ✅ 遵循"从源头重建"原则，确保数据一致性

### 技术特点
- ✅ 异步操作支持
- ✅ 完整的错误处理
- ✅ 自动设置双向数据同步
- ✅ 生成唯一的项目ID
- ✅ 详细的操作日志

## 🏗️ 架构设计

### 类结构
```typescript
export class DuplicateTimelineItemCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private originalTimelineItemData: any // 保存原始项目的重建元数据
  public readonly newTimelineItemId: string // 新创建的项目ID
}
```

### 核心方法
1. **execute()**: 执行复制操作
2. **undo()**: 撤销复制操作
3. **rebuildDuplicatedItem()**: 从原始素材重建复制的项目

## 🔄 "从源头重建"原则

### 数据保存策略
```typescript
// 保存原始项目的完整重建元数据
this.originalTimelineItemData = {
  mediaItemId: originalTimelineItem.mediaItemId,
  trackId: originalTimelineItem.trackId,
  mediaType: originalTimelineItem.mediaType,
  timeRange: { ...originalTimelineItem.timeRange },
  position: { ...originalTimelineItem.position },
  size: { ...originalTimelineItem.size },
  rotation: originalTimelineItem.rotation,
  zIndex: originalTimelineItem.zIndex,
  opacity: originalTimelineItem.opacity,
  thumbnailUrl: originalTimelineItem.thumbnailUrl,
}
```

### 重建流程
1. **获取原始素材**: 从MediaItem重新获取MP4Clip或ImgClip
2. **克隆Clip**: 使用WebAV的clone()方法创建新的Clip实例
3. **创建Sprite**: 根据媒体类型创建CustomVisibleSprite或ImageVisibleSprite
4. **设置时间范围**: 调整到新的时间位置
5. **应用变换属性**: 设置位置、大小、旋转等属性
6. **创建TimelineItem**: 创建完整的TimelineItem对象

## 📍 位置计算逻辑

### 自动位置调整
```typescript
// 计算新位置（在原项目后面，避免重叠）
const originalDuration = (timelineItem.timeRange.timelineEndTime - timelineItem.timeRange.timelineStartTime) / 1000000
const originalEndTime = timelineItem.timeRange.timelineEndTime / 1000000
const newPosition = originalEndTime + 0.1 // 在原项目结束后0.1秒的位置
```

### 时间范围设置
- **视频**: 保持原始的clipStartTime和clipEndTime，调整timelineStartTime和timelineEndTime
- **图片**: 保持原始的displayDuration，调整timelineStartTime和timelineEndTime

## 🔧 集成方式

### videoStore集成
```typescript
async function duplicateTimelineItemWithHistory(timelineItemId: string): Promise<string | null> {
  const command = new DuplicateTimelineItemCommand(
    timelineItemId,
    timelineItem,
    newPosition,
    {
      addTimelineItem: timelineModule.addTimelineItem,
      removeTimelineItem: timelineModule.removeTimelineItem,
      getTimelineItem: timelineModule.getTimelineItem,
      setupBidirectionalSync: timelineModule.setupBidirectionalSync,
    },
    {
      addSprite: webavModule.addSprite,
      removeSprite: webavModule.removeSprite,
    },
    {
      getMediaItem: mediaModule.getMediaItem,
    }
  )
  
  await historyModule.executeCommand(command)
  return command.newTimelineItemId
}
```

### UI组件集成
```typescript
// VideoClip.vue
async function duplicateClip() {
  const newItemId = await videoStore.duplicateTimelineItemWithHistory(props.timelineItem.id)
  if (newItemId) {
    console.log('✅ 时间轴项目复制成功，新项目ID:', newItemId)
  }
}
```

## 🧪 测试覆盖

### 测试用例
- ✅ 基本复制功能测试
- ✅ 撤销操作测试
- ✅ 视频和图片类型支持测试
- ✅ 错误处理测试（素材不存在、素材未准备好）
- ✅ 时间位置调整测试
- ✅ 属性复制完整性测试

### 测试文件
- `frontend/src/tests/duplicateTimelineItemCommand.test.ts`

## 🚀 使用示例

### 基本使用
```typescript
// 在VideoClip组件的右键菜单中
async function duplicateClip() {
  try {
    const newItemId = await videoStore.duplicateTimelineItemWithHistory(props.timelineItem.id)
    if (newItemId) {
      console.log('复制成功，新项目ID:', newItemId)
    }
  } catch (error) {
    console.error('复制失败:', error)
  }
}
```

### 撤销/重做
```typescript
// 撤销复制操作
await videoStore.undo()

// 重做复制操作
await videoStore.redo()
```

## ⚠️ 注意事项

### 依赖要求
1. **素材状态**: 原始素材必须已经解析完成（isReady = true）
2. **Clip可用性**: 对应的MP4Clip或ImgClip必须存在
3. **WebAV初始化**: WebAV系统必须已经初始化完成

### 错误处理
- 素材不存在时抛出错误
- 素材未准备好时抛出错误
- 不支持的媒体类型时抛出错误
- WebAV操作失败时抛出错误

### 性能考虑
- 复制操作涉及异步的Clip克隆，可能需要一定时间
- 大文件的复制可能会有明显的延迟
- 建议在UI中提供适当的加载状态提示

## 📈 后续优化方向

1. **批量复制**: 支持同时复制多个时间轴项目
2. **智能位置**: 更智能的位置计算，考虑轨道空间
3. **复制选项**: 提供复制选项（如是否复制变换属性）
4. **性能优化**: 优化大文件的复制性能
5. **用户体验**: 添加复制进度提示

## 📝 更新日志

### v1.0.0 (2025-06-17)
- ✅ 初始实现DuplicateTimelineItemCommand
- ✅ 支持视频和图片复制
- ✅ 集成到操作记录系统
- ✅ 添加完整的测试覆盖
- ✅ 更新UI组件使用新的复制方法
