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
- ✅ 支持视频裁剪操作的撤销/重做

---

### 阶段5：完善所有核心操作支持（2-3天）

**目标**: 支持所有核心编辑操作的撤销/重做

#### 实现内容

##### 🔥 高优先级操作
- [x] **DuplicateTimelineItemCommand** - 复制时间轴项目 ✅
- [x] **AddTrackCommand** - 添加轨道 ✅
- [x] **RemoveTrackCommand** - 删除轨道 ✅
- [x] **AutoArrangeTrackCommand** - 单轨道自动排列 ✅

##### 🟡 中优先级操作
- [x] **RenameTrackCommand** - 重命名轨道 ✅
- [x] **ToggleTrackVisibilityCommand** - 切换轨道可见性 ✅
- [ ] **ToggleTrackMuteCommand** - 切换轨道静音
- [x] **ResizeTimelineItemCommand** - 时间范围调整（拖拽边缘） ✅

##### 🟢 低优先级操作
- [ ] **SetVideoResolutionCommand** - 修改视频分辨率
- [ ] **SetFrameRateCommand** - 修改帧率
- [ ] **RenameMediaItemCommand** - 重命名素材

#### 🚫 明确不支持的操作
- **删除素材** - 用警告对话框替代，显示受影响的时间轴项目数量
- **修改时间轴总时长** - 应基于内容自动计算，不需要手动修改
- **调整轨道高度** - 纯UI布局操作，不影响项目内容

#### 技术方案
```typescript
// 复制操作示例
class DuplicateTimelineItemCommand implements SimpleCommand {
  constructor(
    private originalItemId: string,
    private newItemData: TimelineItemData,
    private timelineModule: any,
    private webavModule: any
  ) {}

  async execute(): Promise<void> {
    // 从原始素材创建新的sprite和TimelineItem
    const newItem = await this.rebuildDuplicatedItem()
    this.timelineModule.addTimelineItem(newItem)
    this.webavModule.addSprite(newItem.sprite)
  }

  async undo(): Promise<void> {
    // 删除复制的项目
    this.timelineModule.removeTimelineItem(this.newItemData.id)
  }
}

// 轨道管理操作示例
class RemoveTrackCommand implements SimpleCommand {
  constructor(
    private trackId: number,
    private trackData: TrackData,
    private affectedItems: TimelineItemData[], // 保存被删除的项目信息
    private trackModule: any,
    private timelineModule: any
  ) {}

  async execute(): Promise<void> {
    // 删除轨道，连带删除该轨道上的所有时间轴项目
    this.trackModule.removeTrack(this.trackId)
  }

  async undo(): Promise<void> {
    // 重建轨道
    this.trackModule.addTrack(this.trackData)
    // 重建被删除的时间轴项目
    for (const itemData of this.affectedItems) {
      await this.timelineModule.rebuildTimelineItem(itemData)
    }
  }
}
```

#### 验证标准
- [ ] 所有高优先级操作都支持撤销/重做
- [ ] 操作描述清晰，用户能理解每个历史记录
- [ ] 复杂操作（如轨道删除）正确处理依赖关系
- [ ] 性能良好，不影响编辑流畅度

---

### 阶段6：添加命令合并功能（1-2天）

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

### 阶段7：添加依赖验证（1天）

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
| 5 | 完善所有核心操作支持 | 2-3天 | 🟡 计划中 | - |
| 6 | 命令合并功能 | 1-2天 | ⚪ 待开始 | - |
| 7 | 依赖验证 | 1天 | ⚪ 待开始 | - |
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
   private sprite: VideoVisibleSprite // 可能被销毁
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
- ✅ **SplitTimelineItemCommand类实现**：完整实现了视频裁剪操作的命令类
- ✅ **裁剪操作集成**：修改了ClipManagementToolbar.vue中的裁剪逻辑

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

6. **裁剪操作的复杂重建逻辑**
   ```typescript
   // 裁剪操作需要保存原始项目的完整信息，撤销时重建原始项目
   class SplitTimelineItemCommand implements SimpleCommand {
     constructor(
       private originalTimelineItemId: string,
       originalTimelineItem: TimelineItem,
       private splitTime: number
     ) {
       // 保存原始项目的完整重建元数据
       this.originalTimelineItemData = {
         id: originalTimelineItem.id,
         mediaItemId: originalTimelineItem.mediaItemId,
         timeRange: { ...originalTimelineItem.timeRange },
         position: { ...originalTimelineItem.position },
         // ... 所有属性的深拷贝
       }
     }

     async execute(): Promise<void> {
       // 执行分割：删除原始项目，创建两个新项目
       const { firstItem, secondItem } = await this.rebuildSplitItems()
       this.timelineModule.removeTimelineItem(this.originalTimelineItemId)
       this.timelineModule.addTimelineItem(firstItem)
       this.timelineModule.addTimelineItem(secondItem)
     }

     async undo(): Promise<void> {
       // 撤销分割：删除分割后的项目，重建原始项目
       this.timelineModule.removeTimelineItem(this.firstItemId)
       this.timelineModule.removeTimelineItem(this.secondItemId)
       const originalItem = await this.rebuildOriginalItem()
       this.timelineModule.addTimelineItem(originalItem)
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
- ✅ 视频裁剪操作可以正确撤销/重做，完整恢复原始项目
- ✅ 裁剪操作遵循"从源头重建"原则，确保数据一致性

---

## 📋 完整操作支持规划

### ✅ 已支持的操作
1. **AddTimelineItemCommand** - 添加时间轴项目
2. **RemoveTimelineItemCommand** - 删除时间轴项目
3. **MoveTimelineItemCommand** - 移动时间轴项目（位置和轨道）
4. **UpdateTransformCommand** - 更新变换属性（位置、大小、旋转、透明度、层级、时长、倍速）
5. **SplitTimelineItemCommand** - 分割时间轴项目（裁剪操作）

### 🔥 待实现的高优先级操作

#### 1. DuplicateTimelineItemCommand - 复制时间轴项目
- **触发位置**: VideoClip.vue右键菜单"复制"选项
- **实现复杂度**: 中等
- **技术要点**:
  - 从原始素材重新创建sprite
  - 生成新的唯一ID
  - 复制所有变换属性
  - 自动调整位置避免重叠

#### 2. AddTrackCommand - 添加轨道
- **触发位置**: Timeline.vue"添加轨道"按钮
- **实现复杂度**: 简单
- **技术要点**:
  - 保存新轨道的配置信息
  - 撤销时删除轨道及其所有项目

#### 3. RemoveTrackCommand - 删除轨道
- **触发位置**: Timeline.vue轨道删除按钮
- **实现复杂度**: 复杂
- **技术要点**:
  - 保存轨道信息和所有项目信息
  - 处理项目重新分配到其他轨道
  - 撤销时完整恢复轨道和项目

#### 4. AutoArrangeTrackCommand - 单轨道自动排列
- **触发位置**: Timeline.vue每个轨道的自动排列按钮
- **实现复杂度**: 中等
- **技术要点**:
  - 保存排列前所有项目的位置信息
  - 撤销时恢复原始位置

### 🟡 待实现的中优先级操作

#### 5. RenameTrackCommand - 重命名轨道
- **触发位置**: Timeline.vue轨道名称编辑
- **实现复杂度**: 简单
- **技术要点**: 保存旧名称和新名称

#### 6. ToggleTrackVisibilityCommand - 切换轨道可见性
- **触发位置**: Timeline.vue轨道可见性按钮
- **实现复杂度**: 简单
- **技术要点**: 保存可见性状态

#### 7. ToggleTrackMuteCommand - 切换轨道静音
- **触发位置**: Timeline.vue轨道静音按钮
- **实现复杂度**: 简单
- **技术要点**: 保存静音状态

#### 8. ResizeTimelineItemCommand - 时间范围调整
- **触发位置**: VideoClip.vue拖拽边缘调整长度
- **实现复杂度**: 中等
- **技术要点**:
  - 保存调整前的时间范围
  - 处理clipStartTime和clipEndTime的变化

### 🟢 待实现的低优先级操作

#### 9. SetVideoResolutionCommand - 修改视频分辨率
- **触发位置**: 配置面板
- **实现复杂度**: 中等
- **技术要点**: 影响所有sprite的坐标系统

#### 10. SetFrameRateCommand - 修改帧率
- **触发位置**: 配置面板
- **实现复杂度**: 简单
- **技术要点**: 保存帧率设置

#### 11. RenameMediaItemCommand - 重命名素材
- **触发位置**: 素材库素材名称编辑
- **实现复杂度**: 简单
- **技术要点**: 保存旧名称和新名称

### 🚫 明确不支持的操作及原因

#### 1. 删除素材操作
- **原因**: 删除素材会影响多个时间轴项目，撤销逻辑过于复杂
- **替代方案**: 删除前显示警告对话框，告知用户会影响哪些时间轴项目
- **实现建议**:
  ```typescript
  // 在删除确认对话框中显示
  const affectedItems = getTimelineItemsByMediaId(mediaItemId)
  const message = `删除此素材将影响 ${affectedItems.length} 个时间轴项目，确定要删除吗？`
  ```

#### 2. 修改时间轴总时长
- **原因**: 时间轴总时长应该根据内容自动调整，不应该手动修改
- **替代方案**: 基于最后一个时间轴项目的结束时间自动计算
- **实现建议**: 移除手动设置功能，改为自动计算

#### 3. 调整轨道高度
- **原因**: 这是纯粹的界面布局调整，不影响项目内容
- **替代方案**: 保持当前实现，不需要撤销功能
- **实现建议**: 继续作为即时生效的UI操作

### 📊 实现优先级建议

1. **第一批**: DuplicateTimelineItemCommand, AddTrackCommand, RemoveTrackCommand
   - 这些是用户最常用的操作
   - 实现后可以覆盖大部分编辑场景

2. **第二批**: AutoArrangeTrackCommand, RenameTrackCommand, ToggleTrackVisibilityCommand, ToggleTrackMuteCommand
   - 完善轨道管理功能
   - 提升用户体验

3. **第三批**: ResizeTimelineItemCommand, SetVideoResolutionCommand, SetFrameRateCommand, RenameMediaItemCommand
   - 补充完整性
   - 根据用户反馈决定是否实现

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
