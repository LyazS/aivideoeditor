# 简化版操作记录系统设计

## 🎯 设计原则

- **简单优先**：避免过度抽象，保持代码简洁
- **实用导向**：只实现真正需要的功能
- **易于理解**：新团队成员能快速上手
- **渐进增强**：可以逐步添加复杂功能

## 🏗️ 核心架构（3层设计）

### 1. 操作接口（简化版）

```typescript
/**
 * 简化的操作接口
 */
interface Operation {
  id: string
  type: string
  description: string
  
  execute(): Promise<void>
  undo(): Promise<void>
}

/**
 * 操作基类
 */
abstract class BaseOperation implements Operation {
  readonly id = generateId()
  
  constructor(
    public readonly type: string,
    public readonly description: string
  ) {}
  
  abstract execute(): Promise<void>
  abstract undo(): Promise<void>
}
```

### 2. 具体操作实现

```typescript
/**
 * 添加时间轴项目操作
 */
class AddTimelineItemOperation extends BaseOperation {
  private addedItem?: TimelineItem
  
  constructor(private itemData: TimelineItemData) {
    super('timeline.add', `添加项目: ${itemData.name}`)
  }
  
  async execute(): Promise<void> {
    // 从源头重建
    const sprite = await createSpriteFromMediaItem(this.itemData.mediaItemId)
    const timelineItem = createTimelineItem(sprite, this.itemData)
    
    // 添加到系统
    timelineStore.addItem(timelineItem)
    canvasStore.addSprite(sprite)
    
    this.addedItem = timelineItem
  }
  
  async undo(): Promise<void> {
    if (this.addedItem) {
      canvasStore.removeSprite(this.addedItem.sprite)
      timelineStore.removeItem(this.addedItem.id)
      
      // 清理资源
      if (this.addedItem.sprite?.destroy) {
        this.addedItem.sprite.destroy()
      }
    }
  }
}

/**
 * 批量操作（复合操作的简化版）
 */
class BatchOperation extends BaseOperation {
  private executedOps: Operation[] = []
  
  constructor(
    private operations: Operation[],
    description: string
  ) {
    super('batch', description)
  }
  
  async execute(): Promise<void> {
    for (const op of this.operations) {
      await op.execute()
      this.executedOps.push(op)
    }
  }
  
  async undo(): Promise<void> {
    // 逆序撤销
    for (let i = this.executedOps.length - 1; i >= 0; i--) {
      await this.executedOps[i].undo()
    }
    this.executedOps = []
  }
}
```

### 3. 历史管理器（简化版）

```typescript
/**
 * 简化的历史管理器
 */
class SimpleHistoryManager {
  private history: Operation[] = []
  private currentIndex = -1
  private maxSize = 50 // 减少内存使用
  
  /**
   * 执行操作
   */
  async execute(operation: Operation): Promise<void> {
    try {
      await operation.execute()
      
      // 清理分支历史
      this.history.splice(this.currentIndex + 1)
      
      // 添加到历史
      this.history.push(operation)
      this.currentIndex++
      
      // 限制历史大小
      if (this.history.length > this.maxSize) {
        this.history.shift()
        this.currentIndex--
      }
      
    } catch (error) {
      console.error('Operation failed:', error)
      throw error
    }
  }
  
  /**
   * 撤销
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) return false
    
    try {
      const operation = this.history[this.currentIndex]
      await operation.undo()
      this.currentIndex--
      return true
    } catch (error) {
      console.error('Undo failed:', error)
      return false
    }
  }
  
  /**
   * 重做
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) return false
    
    try {
      this.currentIndex++
      const operation = this.history[this.currentIndex]
      await operation.execute()
      return true
    } catch (error) {
      console.error('Redo failed:', error)
      this.currentIndex--
      return false
    }
  }
  
  canUndo(): boolean {
    return this.currentIndex >= 0
  }
  
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }
  
  clear(): void {
    this.history = []
    this.currentIndex = -1
  }
  
  getStatus() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      historySize: this.history.length,
      currentIndex: this.currentIndex
    }
  }
}
```

## 🔧 使用方式

### 1. 初始化

```typescript
// 在 videoStore 中初始化
const historyManager = new SimpleHistoryManager()

// 导出给组件使用
export const useHistory = () => {
  return {
    execute: historyManager.execute.bind(historyManager),
    undo: historyManager.undo.bind(historyManager),
    redo: historyManager.redo.bind(historyManager),
    canUndo: computed(() => historyManager.canUndo()),
    canRedo: computed(() => historyManager.canRedo())
  }
}
```

### 2. 创建操作

```typescript
// 简单的工厂函数（不需要复杂的工厂类）
export function createAddItemOperation(itemData: TimelineItemData) {
  return new AddTimelineItemOperation(itemData)
}

export function createRemoveItemOperation(itemId: string) {
  return new RemoveTimelineItemOperation(itemId)
}

export function createBatchOperation(operations: Operation[], description: string) {
  return new BatchOperation(operations, description)
}
```

### 3. 在组件中使用

```typescript
// 在 Vue 组件中
const { execute, undo, redo, canUndo, canRedo } = useHistory()

// 执行操作
async function addTimelineItem(itemData: TimelineItemData) {
  const operation = createAddItemOperation(itemData)
  await execute(operation)
}

// 批量操作
async function batchDelete(itemIds: string[]) {
  const deleteOps = itemIds.map(id => createRemoveItemOperation(id))
  const batchOp = createBatchOperation(deleteOps, `删除 ${itemIds.length} 个项目`)
  await execute(batchOp)
}
```

## 📁 文件结构（简化版）

```
frontend/src/stores/operations/
├── types.ts              # 基础类型定义
├── BaseOperation.ts      # 操作基类
├── HistoryManager.ts     # 历史管理器
├── operations/           # 具体操作实现
│   ├── TimelineOperations.ts
│   ├── TrackOperations.ts
│   └── BatchOperations.ts
├── factories.ts          # 简单的工厂函数
└── index.ts              # 导出
```

## 🚀 渐进增强策略

如果后续需要更复杂的功能，可以逐步增强：

### 阶段1：基础版本（当前）
- 基本的撤销/重做
- 简单的批量操作
- 清晰的操作描述

### 阶段2：增强版本
- 操作合并机制
- 更智能的批量操作
- 操作依赖验证

### 阶段3：高级版本
- 并行执行策略
- 操作序列化
- 协作编辑支持

## 💡 实施建议

1. **先实现简化版**：满足当前需求，快速上线
2. **收集反馈**：观察实际使用中的痛点
3. **按需增强**：根据实际需求逐步添加复杂功能
4. **保持简洁**：避免为了技术而技术

这个简化版本能够满足90%的使用场景，同时保持代码的简洁和可维护性。
