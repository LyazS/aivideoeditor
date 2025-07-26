# 新旧Store架构对比分析

## 概述

本文档详细分析了新架构 `frontend/src/stores/unifiedStore.ts` 与旧架构 `frontend/src/stores/videoStore.ts` 的差异，重点关注新架构缺少的模块和功能。

## 架构设计理念对比

### 旧架构：双重类型系统
```typescript
// 旧架构：两套独立的类型系统
LocalMediaItem              // 本地已处理完成的媒体
AsyncProcessingMediaItem    // 异步处理中的媒体

LocalTimelineItem           // 本地时间轴项目  
AsyncProcessingTimelineItem // 异步处理时间轴项目
```

**特点：**
- 类型分离，处理逻辑复杂
- 需要在不同类型间转换
- 状态管理分散

### 新架构：统一类型系统
```typescript
// 新架构：统一类型，通过状态区分
UnifiedMediaItemData {
}

UnifiedTimelineItem {
}
```

**特点：**
- 统一类型系统，消除双重类型复杂性
- 通过状态字段区分处理阶段
- 状态管理集中化

## 模块对比分析

### ✅ 新架构已有的模块

| 新架构模块 | 旧架构对应模块 | 状态 |
|-----------|---------------|------|
| UnifiedMediaModule | mediaModule | ✅ 已实现，功能更强 |
| UnifiedTrackModule | trackModule | ✅ 已实现，接口兼容 |
| UnifiedTimelineModule | timelineModule | ✅ 已实现，统一类型 |
| UnifiedProjectModule | projectModule | ✅ 已实现，功能增强 |
| UnifiedViewportModule | viewportModule | ✅ 已实现，接口一致 |
| UnifiedHistoryModule | historyModule | ✅ 已实现，架构升级 |
| UnifiedSelectionModule | selectionModule | ✅ 已实现，多选支持 |
| configModule | configModule | ✅ 保持不变 |
| playbackModule | playbackModule | ✅ 保持不变 |
| webavModule | webavModule | ✅ 保持不变 |
| notificationModule | notificationModule | ✅ 保持不变 |

### ✅ 新架构已统一处理的功能

#### 1. 异步处理管理
**旧架构：**
```typescript
asyncProcessingItems: Ref<AsyncProcessingMediaItem[]>
addAsyncProcessingItem()
updateAsyncProcessingItem()
removeAsyncProcessingItem()
```

**新架构：**
```typescript
// 通过统一类型的状态管理
UnifiedMediaItemData.mediaStatus // 包含所有处理状态
UnifiedMediaItemActions.transitionTo() // 统一状态转换
UnifiedMediaItemQueries.isProcessing() // 状态查询
```

#### 2. 基础工具函数
- ✅ `frameToPixel` / `pixelToFrame` 坐标转换
- ✅ `findTimelineItemBySprite` 查找功能
- ✅ `autoArrangeTimelineItems` / `autoArrangeTrackItems` 自动排列
- ✅ `expandTimelineIfNeededFrames` 时间轴扩展
- ✅ 完整的工具函数库 (`frontend/src/stores/utils/`)

#### 3. 项目恢复基础功能
- ✅ `restoreMediaItems` (在UnifiedProjectModule中)
- ✅ `restoreTracks` (在UnifiedTrackModule中)  
- ✅ `rebuildTimelineItemSprites` (在webavModule中)

#### 4. 命令系统框架
- ✅ `UnifiedCommand` 接口定义
- ✅ `UnifiedTimelineCommand` 基类
- ✅ `UnifiedBatchCommand` 批量命令
- ✅ 完整的撤销/重做机制

#### 5. 片段操作功能
- ✅ `clipOperationsModule` 已实现
- ✅ `updateTimelineItemPlaybackRate` 等方法

## ❌ 新架构缺少的功能

### 1. 具体命令类实现（最重要）

新架构有完整的命令框架，但缺少具体的业务命令实现：

```typescript
// 需要实现的具体命令类
class UnifiedAddTimelineItemCommand extends UnifiedTimelineCommand
class UnifiedRemoveTimelineItemCommand extends UnifiedTimelineCommand  
class UnifiedMoveTimelineItemCommand extends UnifiedTimelineCommand
class UnifiedUpdateTransformCommand extends UnifiedTimelineCommand
class UnifiedSplitTimelineItemCommand extends UnifiedTimelineCommand
class UnifiedDuplicateTimelineItemCommand extends UnifiedTimelineCommand
class UnifiedAddTrackCommand extends UnifiedTimelineCommand
class UnifiedRemoveTrackCommand extends UnifiedTimelineCommand
class UnifiedRenameTrackCommand extends UnifiedTimelineCommand
class UnifiedToggleTrackVisibilityCommand extends UnifiedTimelineCommand
class UnifiedToggleTrackMuteCommand extends UnifiedTimelineCommand
class UnifiedResizeTimelineItemCommand extends UnifiedTimelineCommand
class UnifiedAddTextItemCommand extends UnifiedTimelineCommand
```

### 2. 带历史记录的高级操作API

新架构缺少用户直接调用的高级操作方法：

```typescript
// 缺少的高级API方法
addTimelineItemWithHistory()
addTextItemWithHistory()
removeTimelineItemWithHistory()
moveTimelineItemWithHistory()
updateTimelineItemTransformWithHistory()
splitTimelineItemAtTimeWithHistory()
duplicateTimelineItemWithHistory()
addTrackWithHistory()
removeTrackWithHistory()
renameTrackWithHistory()
autoArrangeTrackWithHistory()
toggleTrackVisibilityWithHistory()
toggleTrackMuteWithHistory()
resizeTimelineItemWithHistory()
batchDeleteTimelineItems()
```

### 3. 业务逻辑封装

#### 变换属性处理逻辑
```typescript
// 缺少的业务逻辑函数
checkTransformChanges(oldTransform, newTransform) // 检查变换是否有实际变化
determinePropertyType(transform) // 确定属性类型（position/size/rotation等）
```

#### 复杂业务验证
- 时间范围验证逻辑
- 轨道约束检查
- 媒体类型兼容性验证

### 4. 完整的项目恢复流程

虽然有基础恢复方法，但可能缺少完整的恢复流程编排：

```typescript
// 可能需要补充的恢复流程
restoreTimelineItems() // 完整的时间轴项目恢复流程
rebuildTimelineItemSprites() // 完整的sprite重建流程
restoreProjectState() // 完整的项目状态恢复
```

## 优先级分析

### 🔴 高优先级（核心功能）
1. **具体命令类实现** - 撤销/重做功能的核心
2. **带历史记录的操作API** - 用户操作的直接接口
3. **变换属性处理逻辑** - 编辑功能的基础

### 🟡 中优先级（增强功能）
1. **完整的项目恢复流程** - 项目加载的完整性
2. **复杂业务验证** - 数据一致性保障

### 🟢 低优先级（优化功能）
1. **性能优化相关** - 用户体验提升
2. **调试和监控工具** - 开发体验改善

## 迁移建议

### 阶段1：核心命令实现
1. 实现具体的命令类
2. 基于统一类型系统重写命令逻辑
3. 确保撤销/重做功能正常

### 阶段2：API层补充
1. 实现带历史记录的高级操作方法
2. 保持与旧架构的API兼容性
3. 提供平滑的迁移路径

### 阶段3：业务逻辑完善
1. 补充变换属性处理逻辑
2. 完善项目恢复流程
3. 添加业务验证逻辑

## 总结

新架构的设计理念先进，通过统一类型系统消除了旧架构双重类型的复杂性。**主要缺少的是在统一类型基础上的具体业务实现**，而不是架构设计问题。

**核心差距：**
- ✅ 架构设计：完整且先进
- ✅ 底层功能：基本完备
- ❌ 业务实现：需要补充具体的命令类和高级API
- ❌ 逻辑封装：需要补充复杂的业务逻辑

新架构为视频编辑器提供了更好的基础，需要的是在这个优秀架构上补充具体的业务实现。

## 技术实现细节

### 命令系统实现示例

#### 旧架构命令实现
```typescript
// 旧架构：基于LocalTimelineItem的命令
class AddTimelineItemCommand {
  constructor(
    private timelineItem: LocalTimelineItem,
    private timelineModule: TimelineModule,
    private webavModule: WebAVModule,
    private mediaModule: MediaModule
  ) {}

  async execute() {
    // 直接操作LocalTimelineItem
    this.timelineModule.addTimelineItem(this.timelineItem)
    await this.webavModule.addSprite(this.timelineItem.sprite)
  }
}
```

#### 新架构命令实现（需要补充）
```typescript
// 新架构：基于UnifiedTimelineItem的命令
class UnifiedAddTimelineItemCommand extends UnifiedTimelineCommand {
  constructor(
    private timelineItem: UnifiedTimelineItem,
    timelineModule: UnifiedTimelineModule,
    mediaModule: UnifiedMediaModule
  ) {
    super('timeline.add', [timelineItem.id], '添加时间轴项目', timelineModule, mediaModule)
  }

  async execute(): Promise<CommandResult> {
    try {
      // 基于统一类型的操作
      const result = this.timelineModule.addTimelineItem(this.timelineItem)
      if (result.success) {
        // 处理WebAV集成
        await this.handleWebAVIntegration()
        return this.createSuccessResult()
      }
      return this.createErrorResult('添加时间轴项目失败')
    } catch (error) {
      return this.createErrorResult(error.message)
    }
  }

  async undo(): Promise<CommandResult> {
    // 撤销逻辑
    const result = this.timelineModule.removeTimelineItem(this.timelineItem.id)
    return result.success ? this.createSuccessResult() : this.createErrorResult('撤销失败')
  }
}
```

### API层实现示例

#### 高级操作方法实现模式
```typescript
// 新架构需要补充的高级API
async function addTimelineItemWithHistory(timelineItem: UnifiedTimelineItem) {
  const command = new UnifiedAddTimelineItemCommand(
    timelineItem,
    unifiedTimelineModule,
    unifiedMediaModule
  )

  return await unifiedHistoryModule.executeCommand(command)
}

async function updateTimelineItemTransformWithHistory(
  timelineItemId: string,
  newTransform: UnifiedTransformData
) {
  // 1. 获取当前项目
  const item = unifiedTimelineModule.getTimelineItem(timelineItemId)
  if (!item) return { success: false, message: '项目不存在' }

  // 2. 检查变换是否有实际变化（需要实现）
  const oldTransform = extractCurrentTransform(item)
  if (!checkTransformChanges(oldTransform, newTransform)) {
    return { success: false, message: '没有变化' }
  }

  // 3. 创建并执行命令
  const command = new UnifiedUpdateTransformCommand(
    timelineItemId,
    oldTransform,
    newTransform,
    unifiedTimelineModule,
    unifiedMediaModule
  )

  return await unifiedHistoryModule.executeCommand(command)
}
```

### 业务逻辑封装示例

#### 变换属性处理
```typescript
// 需要补充的业务逻辑函数
function checkTransformChanges(
  oldTransform: UnifiedTransformData,
  newTransform: UnifiedTransformData
): boolean {
  // 位置变化检查
  if (newTransform.x !== undefined && oldTransform.x !== undefined) {
    if (Math.abs(oldTransform.x - newTransform.x) > 0.1) return true
  }

  // 大小变化检查
  if (newTransform.width !== undefined && oldTransform.width !== undefined) {
    if (Math.abs(oldTransform.width - newTransform.width) > 0.1) return true
  }

  // 其他属性检查...
  return false
}

function determinePropertyType(transform: UnifiedTransformData): PropertyType {
  const changedProperties = []

  if (transform.x !== undefined || transform.y !== undefined) {
    changedProperties.push('position')
  }
  if (transform.width !== undefined || transform.height !== undefined) {
    changedProperties.push('size')
  }
  // 其他属性判断...

  return changedProperties.length === 1 ? changedProperties[0] as PropertyType : 'multiple'
}
```

## 实现路径建议

### 第一步：命令类实现
1. 创建 `frontend/src/stores/modules/commands/UnifiedTimelineCommands.ts`
2. 实现核心命令类：Add、Remove、Move、UpdateTransform
3. 基于现有的 `UnifiedTimelineCommand` 基类

### 第二步：API层封装
1. 在 `unifiedStore.ts` 中添加带历史记录的方法
2. 保持与旧架构API的兼容性
3. 提供类型安全的接口

### 第三步：业务逻辑补充
1. 创建 `frontend/src/stores/utils/unifiedTransformUtils.ts`
2. 实现变换属性处理逻辑
3. 添加业务验证函数

### 第四步：测试和验证
1. 单元测试覆盖新实现的功能
2. 集成测试验证撤销/重做功能
3. 性能测试确保无回归

## 风险评估

### 🔴 高风险
- **命令系统兼容性**：新命令系统与现有UI组件的集成
- **状态同步**：统一类型状态与WebAV的同步

### 🟡 中风险
- **性能影响**：统一类型可能带来的性能开销
- **类型安全**：复杂的类型转换逻辑

### 🟢 低风险
- **API兼容性**：可以通过适配器模式解决
- **渐进迁移**：可以并行运行新旧系统

---

*文档创建时间：2025-01-26*
*分析范围：frontend/src/stores/ 目录下的新旧架构对比*
*最后更新：2025-01-26*
