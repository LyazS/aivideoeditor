# 操作记录系统实现方案

## 📋 概述

本文档描述了视频编辑器操作记录系统（撤销/重做功能）的分阶段实现方案。采用渐进式开发策略，从最简单的功能开始，逐步扩展到完整的操作历史管理系统。

## 🎯 设计原则

- **渐进式开发**: 从简单到复杂，每个阶段都有可测试的功能
- **风险可控**: 问题在早期发现和解决
- **用户优先**: 优先实现用户最常用的操作
- **架构兼容**: 与现有模块化架构无缝集成

## 🚀 分阶段实现计划

### 阶段1：最简单的撤销/重做框架（1-2天）

**目标**: 实现基础历史记录系统，只支持添加时间轴项目

#### 实现内容
- [x] 创建基础Command接口和HistoryManager ✅
- [x] 实现AddTimelineItemCommand ✅
- [x] 添加撤销/重做UI按钮 ✅
- [x] 集成到现有videoStore中 ✅

#### 技术方案
```typescript
// 支持异步的Command接口
interface SimpleCommand {
  id: string
  description: string
  execute(): void | Promise<void>
  undo(): void | Promise<void>
}

// 支持异步的HistoryManager
class SimpleHistoryManager {
  private commands: SimpleCommand[] = []
  private currentIndex = -1

  async executeCommand(command: SimpleCommand): Promise<void>
  async undo(): Promise<boolean>
  async redo(): Promise<boolean>
  canUndo(): boolean
  canRedo(): boolean
}

// 实现"从源头重建"原则的命令示例
class AddTimelineItemCommand implements SimpleCommand {
  constructor(
    private originalData: {
      mediaItemId: string
      timeRange: TimeRange
      transformProperties: TransformData
      // 重建所需的完整元数据
    }
  ) {}

  async execute(): Promise<void> {
    // 每次都从原始素材重新创建
    const mediaItem = getMediaItem(this.originalData.mediaItemId)
    const newSprite = await createSpriteFromMediaItem(mediaItem)
    applyTransform(newSprite, this.originalData.transformProperties)

    const newTimelineItem = createTimelineItem(newSprite, this.originalData)
    addToTimeline(newTimelineItem)
    addToCanvas(newSprite)
  }

  async undo(): Promise<void> {
    // 移除并清理资源
    removeFromTimeline(this.originalData.id)
    removeFromCanvas(this.originalData.id)
  }
}
```

#### 文件结构
```
frontend/src/stores/modules/
├── historyModule.ts          # 历史管理模块
└── commands/
    └── timelineCommands.ts   # 时间轴命令实现
```

#### 验证标准
- ✅ 能够撤销/重做添加时间轴项目的操作
- ✅ UI按钮状态正确反映可撤销/重做状态
- ✅ 不影响现有功能的正常使用
- ✅ 重做时正确重建sprite，避免"Reader is closed"错误
- ✅ 支持异步命令执行

---

### 阶段2：扩展到删除操作（1天）

**目标**: 添加删除时间轴项目的撤销/重做支持

#### 实现内容
- [ ] 实现RemoveTimelineItemCommand
- [ ] 处理WebAV sprite的清理和恢复
- [ ] 保存完整的TimelineItem数据用于恢复

#### 技术重点
```typescript
class RemoveTimelineItemCommand implements SimpleCommand {
  constructor(
    private timelineItemId: string,
    private timelineItemSnapshot: TimelineItemSnapshot, // 保存完整数据
    private timelineModule: any,
    private webavModule: any
  ) {}
  
  execute() {
    // 删除时间轴项目和sprite
  }
  
  undo() {
    // 重新创建TimelineItem和sprite
  }
}
```

#### 验证标准
- ✅ 能够撤销/重做删除时间轴项目的操作
- ✅ 撤销删除后sprite正确恢复到canvas
- ✅ 所有属性（位置、大小、旋转等）正确恢复
- ✅ UI中的删除操作（工具栏和时间轴）都使用带历史记录的方法
- ✅ 遵循"从源头重建"原则，保存完整的重建元数据
- ✅ 支持异步操作，正确处理WebAV资源生命周期

---

### 阶段3：添加移动操作（1天）

**目标**: 支持时间轴项目位置移动的撤销/重做

#### 实现内容
- [ ] 实现MoveTimelineItemCommand
- [ ] 记录位置变化（旧位置→新位置）
- [ ] 支持轨道间移动的撤销/重做

#### 技术方案
```typescript
class MoveTimelineItemCommand implements SimpleCommand {
  constructor(
    private timelineItemId: string,
    private oldPosition: number,
    private newPosition: number,
    private oldTrackId?: number,
    private newTrackId?: number
  ) {}
}
```

#### 验证标准
- ✅ 能够撤销/重做时间轴项目的拖拽移动
- ✅ 支持同轨道内位置移动
- ✅ 支持跨轨道移动的撤销/重做
- ✅ 智能检测位置和轨道变化，避免无意义的历史记录
- ✅ UI中的拖拽操作使用带历史记录的移动方法
- ✅ 移动命令包含详细的描述信息

---

### 阶段4：添加属性变更操作（2天）

**目标**: 支持变换属性的撤销/重做

#### 实现内容
- [ ] 实现UpdateTransformCommand
- [ ] 支持位置、大小、旋转、透明度变更
- [ ] 每次属性变更作为独立命令（暂不合并）

#### 技术方案
```typescript
class UpdateTransformCommand implements SimpleCommand {
  constructor(
    private timelineItemId: string,
    private propertyType: 'position' | 'size' | 'rotation' | 'opacity',
    private oldValue: any,
    private newValue: any
  ) {}
}
```

#### 验证标准
- ✅ 能够撤销/重做属性面板中的变换属性修改
- ✅ 支持所有变换属性类型（位置、大小、旋转、透明度、层级、时长、倍速）
- ✅ 属性变更后WebAV渲染正确更新
- ✅ 智能检测属性变化，避免无意义的历史记录
- ✅ 详细的命令描述信息，显示具体的属性变化
- ✅ 属性面板操作使用带历史记录的更新方法
- ✅ 视频支持时长和倍速的撤销/重做
- ✅ 图片支持时长的撤销/重做

---

### 阶段5：添加命令合并功能（1-2天）

**目标**: 实现连续相同操作的合并

#### 实现内容
- [ ] 扩展Command接口，添加canMerge和merge方法
- [ ] 在HistoryManager中实现合并逻辑
- [ ] 重点处理变换属性的连续修改

#### 技术方案
```typescript
interface Command extends SimpleCommand {
  canMerge?(other: Command): boolean
  merge?(other: Command): Command
  timestamp: number
}

class UpdateTransformCommand implements Command {
  canMerge(other: Command): boolean {
    return other instanceof UpdateTransformCommand &&
           other.targetId === this.targetId &&
           other.propertyType === this.propertyType &&
           (other.timestamp - this.timestamp) < 1000 // 1秒内
  }
  
  merge(other: UpdateTransformCommand): Command {
    return new UpdateTransformCommand({
      ...this.data,
      newValue: other.data.newValue,
      timestamp: other.timestamp
    })
  }
}
```

#### 验证标准
- ✅ 连续拖拽调整位置时，撤销一次回到拖拽前状态
- ✅ 不同类型操作不会被错误合并
- ✅ 合并逻辑不影响系统性能

---

### 阶段6：添加依赖验证（1天）

**目标**: 处理素材删除对历史记录的影响

#### 实现内容
- [ ] 为Command添加validateDependencies方法
- [ ] 在执行撤销/重做前检查依赖
- [ ] 实现简单的错误提示机制

#### 技术方案
```typescript
interface Command {
  validateDependencies?(): boolean
}

class BaseCommand implements Command {
  validateDependencies(): boolean {
    const mediaItem = videoStore.getMediaItem(this.mediaItemId)
    return mediaItem && mediaItem.status !== 'missing'
  }
}

// 在HistoryManager中
undo(): boolean {
  const command = this.getCurrentCommand()
  if (!command.validateDependencies?.()) {
    showToast('无法撤销：相关素材已被删除')
    return false
  }
  // 执行撤销...
}
```

#### 验证标准
- ✅ 删除素材后，相关历史操作不能执行
- ✅ 给出清晰的错误提示信息
- ✅ UI按钮状态正确反映操作可用性

---

### 阶段7：完善所有操作类型（2-3天）

**目标**: 支持所有用户操作的撤销/重做

#### 实现内容
- [ ] 实现轨道管理相关命令
  - [ ] AddTrackCommand
  - [ ] RemoveTrackCommand  
  - [ ] RenameTrackCommand
  - [ ] ToggleTrackVisibilityCommand
- [ ] 实现素材管理相关命令
  - [ ] AddMediaItemCommand
  - [ ] RemoveMediaItemCommand
  - [ ] RenameMediaItemCommand
- [ ] 实现复杂操作命令
  - [ ] SplitTimelineItemCommand
  - [ ] UpdatePlaybackSpeedCommand

#### 验证标准
- ✅ 所有主要用户操作都支持撤销/重做
- ✅ 复杂操作（如分割）的撤销逻辑正确
- ✅ 系统稳定性不受影响

---

### 阶段8：性能优化和完善（1-2天）

**目标**: 优化性能，完善用户体验

#### 实现内容
- [ ] 限制历史记录数量（默认50条）
- [ ] 实现内存使用优化
- [ ] 添加快捷键支持（Ctrl+Z / Ctrl+Y）
- [ ] 完善UI反馈和状态显示
- [ ] 添加历史面板（可选）

#### 性能优化策略
```typescript
class HistoryManager {
  private maxHistorySize = 50
  
  private trimHistory() {
    if (this.commands.length > this.maxHistorySize) {
      const removeCount = this.commands.length - this.maxHistorySize
      this.commands.splice(0, removeCount)
      this.currentIndex -= removeCount
    }
  }
}
```

#### 验证标准
- ✅ 系统运行流畅，无明显性能影响
- ✅ 内存使用控制在合理范围
- ✅ 用户体验良好，操作直观

## 🏗️ 技术架构

### 核心组件

#### HistoryManager
- 管理命令历史栈
- 执行撤销/重做逻辑
- 处理命令合并
- 内存管理和性能优化

#### Command接口体系
```typescript
interface Command {
  id: string
  type: string
  description: string
  timestamp: number
  execute(): Promise<void> | void
  undo(): Promise<void> | void
  canMerge?(other: Command): boolean
  merge?(other: Command): Command
  validateDependencies?(): boolean
}

// 基础命令实现示例（遵循"从源头重建"原则）
abstract class BaseCommand implements Command {
  public readonly id: string
  public readonly timestamp: number

  constructor(
    protected originalData: any, // 保存重建所需的完整元数据
    public readonly type: string,
    public readonly description: string
  ) {
    this.id = generateCommandId()
    this.timestamp = Date.now()
  }

  // 每个具体命令都必须实现完整的重建逻辑
  abstract execute(): Promise<void>
  abstract undo(): Promise<void>

  // 验证重建所需的依赖是否存在
  validateDependencies(): boolean {
    return this.checkMediaItemExists(this.originalData.mediaItemId)
  }
}
```

#### 与现有架构集成
```typescript
// 在videoStore中集成
const historyModule = createHistoryModule()

// 包装现有操作函数（支持异步）
const addTimelineItemWithHistory = async (timelineItem: TimelineItem) => {
  // 保存重建所需的完整元数据
  const originalData = {
    mediaItemId: timelineItem.mediaItemId,
    timeRange: { ...timelineItem.timeRange },
    transformProperties: {
      position: { ...timelineItem.position },
      size: { ...timelineItem.size },
      rotation: timelineItem.rotation,
      zIndex: timelineItem.zIndex,
      opacity: timelineItem.opacity,
    },
    trackId: timelineItem.trackId,
    mediaType: timelineItem.mediaType,
  }

  const command = new AddTimelineItemCommand(originalData, timelineModule, webavModule)
  await historyModule.executeCommand(command)
}
```

### 数据流设计
```
用户操作 → 保存元数据 → Command创建 → HistoryManager → 异步执行 → 从源头重建
                                                    ↓
撤销操作 ← 清理资源 ← Command.undo() ← HistoryManager ← 用户触发撤销
                                                    ↓
重做操作 → 重新从源头创建 → Command.execute() → HistoryManager ← 用户触发重做
```

### 重建流程详解
```
重做操作触发
    ↓
获取保存的元数据
    ↓
从MediaItem重新创建Clip
    ↓
创建新的Sprite实例
    ↓
应用保存的变换属性
    ↓
创建新的TimelineItem
    ↓
添加到时间轴和画布
    ↓
设置双向数据同步
```

## 📊 进度跟踪

| 阶段 | 功能 | 预计时间 | 状态 | 完成日期 |
|------|------|----------|------|----------|
| 1 | 基础撤销/重做框架 | 1-2天 | ✅ 已完成 | 2025-06-17 |
| 2 | 删除操作支持 | 1天 | ✅ 已完成 | 2025-06-17 |
| 3 | 移动操作支持 | 1天 | ✅ 已完成 | 2025-06-17 |
| 4 | 属性变更支持 | 2天 | ✅ 已完成 | 2025-06-17 |
| 5 | 命令合并功能 | 1-2天 | 🟡 计划中 | - |
| 6 | 依赖验证 | 1天 | ⚪ 待开始 | - |
| 7 | 完整操作支持 | 2-3天 | ⚪ 待开始 | - |
| 8 | 性能优化 | 1-2天 | ⚪ 待开始 | - |

**总计预估时间**: 9-13天

## 🧪 测试策略

### 单元测试
- 每个Command类的execute/undo方法
- HistoryManager的核心逻辑
- 命令合并逻辑

### 集成测试  
- 与现有videoStore的集成
- WebAV对象的状态恢复
- 复杂操作序列的撤销/重做

### 用户测试
- 常见操作流程的撤销/重做
- 边界情况处理
- 性能和内存使用

## 📝 开发注意事项

### 核心设计原则

#### 🎯 "从源头重建"原则
**最重要的架构原则**：每次命令执行都应该从原始素材完全重新创建所有对象，而不是重用已存在的对象引用。

1. **保存元数据，不保存对象引用**
   ```typescript
   // ✅ 正确：保存重建所需的原始数据
   private originalData = {
     mediaItemId: string,
     timeRange: TimeRange,
     transformProperties: TransformData,
     // 所有重建所需的序列化数据
   }

   // ❌ 错误：保存对象引用
   private sprite: CustomVisibleSprite // 可能被销毁
   ```

2. **每次execute都完全重建**
   ```typescript
   execute(): void {
     // 从原始素材重新创建sprite
     const mediaItem = getMediaItem(this.originalData.mediaItemId)
     const newSprite = await createSpriteFromMediaItem(mediaItem)

     // 应用保存的变换属性
     applyTransformToSprite(newSprite, this.originalData)

     // 创建新的timelineItem并添加到系统
     const newTimelineItem = createTimelineItem(newSprite, this.originalData)
     addToTimeline(newTimelineItem)
     addToCanvas(newSprite)
   }
   ```

3. **简化命令逻辑**
   - 不区分首次执行和重做
   - 每次执行都是完整的操作重现
   - 避免复杂的状态管理

#### 🚫 常见错误和教训

1. **错误：重用已销毁的对象**
   - **问题**：WebAV对象有生命周期，撤销时会被销毁，重做时重用会导致"Reader is closed"等错误
   - **解决**：每次都从原始素材重新创建

2. **错误：不完整的状态保存**
   - **问题**：只保存部分信息，重建时缺少关键数据
   - **解决**：保存重建所需的完整元数据

3. **错误：复杂的执行逻辑**
   - **问题**：用标志位区分不同执行场景，增加复杂性和bug风险
   - **解决**：统一的重建逻辑，简单可靠

### 技术实现要点

1. **WebAV对象处理**: 由于WebAV对象不能序列化且有生命周期，必须保存重建所需的元数据
2. **Vue响应式**: 使用markRaw()避免WebAV对象被Vue响应式包装
3. **异步支持**: 重建过程涉及异步操作，命令接口需要支持Promise
4. **内存管理**: 及时清理不再需要的历史记录和WebAV资源
5. **错误处理**: 完善的异常捕获和用户提示
6. **性能影响**: 最小化对现有功能的性能影响

## 🎯 成功标准

- ✅ 所有主要用户操作支持撤销/重做
- ✅ 系统稳定性和性能不受影响
- ✅ 用户体验直观友好
- ✅ 代码架构清晰可维护
- ✅ 充分的测试覆盖
- ✅ 遵循"从源头重建"原则，避免对象重用问题
- ✅ 支持异步操作，处理WebAV资源生命周期
- ✅ 完善的错误处理和资源清理

## 📚 实战经验教训

### 阶段2开发总结

#### 实现内容
- ✅ **RemoveTimelineItemCommand类实现**：完整实现了删除时间轴项目的命令类
- ✅ **"从源头重建"原则应用**：保存完整的重建元数据，撤销时从原始素材重新创建
- ✅ **UI集成**：修改了ClipManagementToolbar.vue和Timeline.vue中的删除逻辑
- ✅ **videoStore集成**：添加了removeTimelineItemWithHistory方法

#### 关键技术实现

1. **完整的元数据保存**
   ```typescript
   // 保存重建所需的完整元数据，而不是对象引用
   this.originalTimelineItemData = {
     id: timelineItem.id,
     mediaItemId: timelineItem.mediaItemId,
     trackId: timelineItem.trackId,
     mediaType: timelineItem.mediaType,
     timeRange: { /* 深拷贝时间范围 */ },
     position: { /* 深拷贝位置 */ },
     size: { /* 深拷贝大小 */ },
     rotation: timelineItem.rotation,
     zIndex: timelineItem.zIndex,
     opacity: timelineItem.opacity,
     thumbnailUrl: timelineItem.thumbnailUrl,
   }
   ```

2. **异步重建逻辑**
   ```typescript
   private async rebuildTimelineItem(): Promise<TimelineItem> {
     // 1. 获取原始素材
     // 2. 从原始素材重新创建sprite
     // 3. 设置时间范围和变换属性
     // 4. 创建新的TimelineItem
     // 5. 返回完整的重建对象
   }
   ```

3. **UI层面的集成**
   - 修改删除函数为异步函数
   - 使用带历史记录的删除方法
   - 添加错误处理和回退机制

#### 验证结果
- ✅ 删除操作可以正确撤销和重做
- ✅ 撤销后所有属性完整恢复
- ✅ WebAV sprite正确重建和添加到画布
- ✅ 支持异步操作，无"Reader is closed"错误
- ✅ UI操作流畅，用户体验良好

---

### 阶段3开发总结

#### 实现内容
- ✅ **MoveTimelineItemCommand类实现**：完整实现了移动时间轴项目的命令类
- ✅ **智能变化检测**：自动检测位置和轨道变化，避免创建无意义的历史记录
- ✅ **UI集成**：修改了Timeline.vue中的移动处理逻辑
- ✅ **videoStore集成**：添加了moveTimelineItemWithHistory方法

#### 关键技术实现

1. **智能变化检测**
   ```typescript
   // 检查是否有实际变化
   const positionChanged = Math.abs(oldPosition - newPosition) > 0.001 // 允许1毫秒的误差
   const trackChanged = oldTrackId !== finalNewTrackId

   if (!positionChanged && !trackChanged) {
     console.log('⚠️ 位置和轨道都没有变化，跳过移动操作')
     return
   }
   ```

2. **详细的描述信息**
   ```typescript
   if (positionChanged && trackChanged) {
     this.description = `移动时间轴项目: ${mediaItem?.name} (位置: ${oldPosition}s→${newPosition}s, 轨道: ${oldTrackId}→${newTrackId})`
   } else if (positionChanged) {
     this.description = `移动时间轴项目: ${mediaItem?.name} (位置: ${oldPosition}s→${newPosition}s)`
   } else if (trackChanged) {
     this.description = `移动时间轴项目: ${mediaItem?.name} (轨道: ${oldTrackId}→${newTrackId})`
   }
   ```

3. **简化的命令逻辑**
   - 不需要"从源头重建"，因为移动操作不涉及WebAV对象的销毁和重建
   - 直接调用现有的updateTimelineItemPosition方法
   - 撤销时简单地移动回原位置

#### 验证结果
- ✅ 拖拽移动操作可以正确撤销和重做
- ✅ 支持同轨道内的时间位置移动
- ✅ 支持跨轨道移动的撤销/重做
- ✅ 智能过滤无变化的操作，避免历史记录污染
- ✅ UI操作流畅，用户体验良好

---

### 阶段4开发总结

#### 实现内容
- ✅ **UpdateTransformCommand类实现**：完整实现了变换属性更新的命令类
- ✅ **智能变化检测**：自动检测各种属性变化，设置合理的误差容忍度
- ✅ **详细描述生成**：根据变化的属性类型生成详细的描述信息
- ✅ **UI集成**：修改了PropertiesPanel.vue中的属性更新逻辑
- ✅ **videoStore集成**：添加了updateTimelineItemTransformWithHistory方法
- ✅ **时长和倍速支持**：扩展支持视频的时长和倍速，图片的时长撤销/重做

#### 关键技术实现

1. **智能变化检测**
   ```typescript
   function checkTransformChanges(oldTransform: any, newTransform: any): boolean {
     // 位置变化检测（0.1像素误差容忍）
     if (newTransform.position && oldTransform.position) {
       const positionChanged =
         Math.abs(oldTransform.position.x - newTransform.position.x) > 0.1 ||
         Math.abs(oldTransform.position.y - newTransform.position.y) > 0.1
       if (positionChanged) return true
     }

     // 旋转变化检测（约0.06度误差容忍）
     if (newTransform.rotation !== undefined && oldTransform.rotation !== undefined) {
       const rotationChanged = Math.abs(oldTransform.rotation - newTransform.rotation) > 0.001
       if (rotationChanged) return true
     }
     // ... 其他属性检测
   }
   ```

2. **详细的描述生成**
   ```typescript
   private generateDescription(mediaName: string): string {
     const changes: string[] = []

     if (this.newValues.position && this.oldValues.position) {
       changes.push(`位置: (${oldPos.x}, ${oldPos.y}) → (${newPos.x}, ${newPos.y})`)
     }

     if (this.newValues.rotation !== undefined && this.oldValues.rotation !== undefined) {
       const oldDegrees = (this.oldValues.rotation * 180 / Math.PI).toFixed(1)
       const newDegrees = (this.newValues.rotation * 180 / Math.PI).toFixed(1)
       changes.push(`旋转: ${oldDegrees}° → ${newDegrees}°`)
     }
     // ... 其他属性描述
   }
   ```

3. **属性类型识别**
   - 自动识别单一属性变更或多属性变更
   - 支持position、size、rotation、opacity、zIndex、duration、playbackRate等所有变换属性
   - 为后续的命令合并功能提供基础

4. **时长和倍速处理**
   ```typescript
   // 时长变化检测（0.1秒误差容忍）
   if (newTransform.duration !== undefined && oldTransform.duration !== undefined) {
     const durationChanged = Math.abs(oldTransform.duration - newTransform.duration) > 0.1
     if (durationChanged) return true
   }

   // 倍速变化检测（0.01倍速误差容忍）
   if (newTransform.playbackRate !== undefined && oldTransform.playbackRate !== undefined) {
     const playbackRateChanged = Math.abs(oldTransform.playbackRate - newTransform.playbackRate) > 0.01
     if (playbackRateChanged) return true
   }
   ```

5. **时长更新的特殊处理**
   ```typescript
   private updateTimelineItemDuration(timelineItemId: string, newDuration: number): void {
     // 对于视频，通过调整时间范围实现时长变化
     if (timelineItem.mediaType === 'video') {
       sprite.setTimeRange({
         clipStartTime: timeRange.clipStartTime || 0,
         clipEndTime: timeRange.clipEndTime || mediaItem.duration * 1000000,
         timelineStartTime: timeRange.timelineStartTime,
         timelineEndTime: newTimelineEndTime,
       })
     } else if (timelineItem.mediaType === 'image') {
       // 对于图片，直接更新显示时长
       sprite.setTimeRange({
         timelineStartTime: timeRange.timelineStartTime,
         timelineEndTime: newTimelineEndTime,
         displayDuration: newDuration * 1000000,
       })
     }
   }
   ```

#### 验证结果
- ✅ 属性面板中的所有变换属性修改都可以撤销/重做
- ✅ 支持位置、大小、旋转、透明度、层级、时长、倍速等所有属性类型
- ✅ 智能过滤微小变化，避免历史记录污染
- ✅ 详细的命令描述，用户可以清楚了解每次变更的内容
- ✅ UI操作流畅，用户体验良好
- ✅ 视频的时长和倍速修改可以正确撤销/重做
- ✅ 图片的时长修改可以正确撤销/重做

---

### 阶段1开发中遇到的关键问题

#### 问题1：重做时"Reader is closed"错误
**现象**：撤销操作正常，但重做时WebAV画布黑屏，控制台报"Reader is closed"错误

**原因分析**：
- 撤销时sprite被销毁，底层MP4Clip/ImgClip的Reader被关闭
- 重做时试图重用已销毁的sprite实例
- WebAV对象有严格的生命周期管理，不能简单重用

**错误的解决尝试**：
1. 用`isFirstExecution`标志区分首次执行和重做
2. 试图在重做时直接添加已存在的sprite到画布
3. 复杂的条件判断逻辑

**正确的解决方案**：
1. **保存完整的重建元数据**，而不是对象引用
2. **每次execute都从原始素材重新创建**所有对象
3. **简化命令逻辑**，不区分执行场景

#### 问题2：异步操作支持不足
**现象**：重建sprite需要异步操作，但原始Command接口是同步的

**解决方案**：
- 更新Command接口支持`Promise<void>`返回类型
- 所有相关的HistoryManager方法改为异步
- UI组件中的撤销/重做调用改为异步

#### 问题3：状态保存不完整
**现象**：重做后某些属性丢失或不正确

**解决方案**：
- 在命令构造函数中保存**所有**重建所需的数据
- 包括变换属性、时间范围、轨道信息等
- 使用深拷贝避免引用问题

### 核心设计原则总结

1. **"从源头重建"是王道**
   - 每次操作都从原始素材完全重新创建
   - 保存元数据，不保存对象引用
   - 简单、可靠、易维护

2. **WebAV对象的特殊性**
   - 有严格的生命周期管理
   - 不能序列化，不能简单重用
   - 必须通过clone()方法创建新实例

3. **异步操作是必需的**
   - 重建过程涉及文件读取、解析等异步操作
   - 命令系统必须支持异步
   - UI交互需要适当的loading状态

4. **完整性胜过优化**
   - 保存完整的重建信息，即使有些冗余
   - 简单的重建逻辑胜过复杂的优化
   - 可靠性比性能更重要

### 后续阶段的指导原则

基于阶段1的经验，后续阶段应该：

1. **严格遵循"从源头重建"原则**
2. **为每个命令设计完整的元数据结构**
3. **优先考虑异步操作支持**
4. **充分测试资源清理和重建逻辑**
5. **保持命令逻辑的简单性**

---

*本文档将随着开发进度持续更新*
