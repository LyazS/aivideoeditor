# 现代化操作记录系统设计方案

## 📋 概述

本文档描述了视频编辑器现代化操作记录系统的完整设计方案。采用全新的架构设计，提供统一的操作抽象、灵活的执行策略、强大的组合能力和完善的错误处理机制。

## 🎯 设计原则

- **统一抽象**: 所有操作都实现同一个Operation接口，原子操作和复合操作在接口层面完全一致
- **灵活执行**: 支持顺序、并行、事务三种执行策略，适应不同业务场景
- **强大组合**: 支持无限嵌套的复合操作，可以构建复杂的业务逻辑
- **完善错误处理**: 详细的操作结果反馈，事务模式支持自动回滚
- **高性能**: 支持操作合并、并行执行和智能内存管理
- **可观测性**: 完整的元数据追踪和历史监听机制

## 🏗️ 核心架构设计

### 1. 统一操作接口

```typescript
/**
 * 操作接口 - 统一的操作抽象
 * 所有操作（原子操作和复合操作）都实现此接口
 */
interface Operation {
  readonly id: string              // 唯一标识符
  readonly type: string            // 操作类型（如 timeline.item.add）
  readonly description: string     // 人类可读的描述
  readonly timestamp: number       // 创建时间戳
  readonly metadata: Record<string, any> // 操作元数据

  execute(): Promise<OperationResult>     // 执行操作
  undo(): Promise<OperationResult>        // 撤销操作
  canMerge?(other: Operation): boolean    // 是否可以与其他操作合并
  merge?(other: Operation): Operation     // 合并操作
  validate?(): Promise<boolean>           // 验证操作是否可执行
}

/**
 * 操作结果
 * 提供详细的执行反馈信息
 */
interface OperationResult {
  success: boolean                 // 是否成功
  data?: any                      // 返回数据
  error?: string                  // 错误信息
  affectedEntities?: string[]     // 受影响的实体ID列表
  metadata?: Record<string, any>  // 结果元数据
}

/**
 * 复合操作接口
 * 包含多个子操作的复合操作
 */
interface CompositeOperation extends Operation {
  readonly operations: Operation[]        // 子操作列表
  readonly strategy: ExecutionStrategy    // 执行策略
}

/**
 * 执行策略枚举
 */
enum ExecutionStrategy {
  SEQUENTIAL = 'sequential',      // 顺序执行（默认）
  PARALLEL = 'parallel',         // 并行执行
  TRANSACTIONAL = 'transactional' // 事务执行（全成功或全失败）
}
```

### 2. 操作分类体系

```typescript
/**
 * 原子操作基类
 * 不可再分的最小操作单元
 */
abstract class AtomicOperation implements Operation {
  readonly id = generateId()
  readonly timestamp = Date.now()

  constructor(
    public readonly type: string,
    public readonly description: string,
    public readonly metadata: Record<string, any> = {}
  ) {}

  abstract execute(): Promise<OperationResult>
  abstract undo(): Promise<OperationResult>

  async validate(): Promise<boolean> {
    return true // 默认总是有效，子类可以重写
  }
}

/**
 * 复合操作实现
 * 管理多个子操作的执行和撤销
 */
class CompositeOperationImpl extends AtomicOperation implements CompositeOperation {
  constructor(
    public readonly operations: Operation[],
    public readonly strategy: ExecutionStrategy,
    description: string,
    metadata: Record<string, any> = {}
  ) {
    super('composite', description, {
      ...metadata,
      strategy,
      operationCount: operations.length
    })
  }

  async execute(): Promise<OperationResult> {
    switch (this.strategy) {
      case ExecutionStrategy.SEQUENTIAL:
        return this.executeSequential()
      case ExecutionStrategy.PARALLEL:
        return this.executeParallel()
      case ExecutionStrategy.TRANSACTIONAL:
        return this.executeTransactional()
    }
  }

  async undo(): Promise<OperationResult> {
    // 总是按逆序撤销，确保依赖关系正确
    const results: OperationResult[] = []
    for (let i = this.operations.length - 1; i >= 0; i--) {
      const result = await this.operations[i].undo()
      results.push(result)
      if (!result.success && this.strategy === ExecutionStrategy.TRANSACTIONAL) {
        break // 事务模式下遇到失败就停止
      }
    }

    return {
      success: results.every(r => r.success),
      data: results,
      affectedEntities: results.flatMap(r => r.affectedEntities || [])
    }
  }
}
```

### 3. 执行策略详解

#### 顺序执行（Sequential）
```typescript
private async executeSequential(): Promise<OperationResult> {
  const results: OperationResult[] = []
  for (const op of this.operations) {
    const result = await op.execute()
    results.push(result)
    if (!result.success) break // 遇到失败就停止
  }

  return {
    success: results.every(r => r.success),
    data: results,
    affectedEntities: results.flatMap(r => r.affectedEntities || [])
  }
}
```
**适用场景**: 有依赖关系的操作，如先删除项目再删除轨道

#### 并行执行（Parallel）
```typescript
private async executeParallel(): Promise<OperationResult> {
  const results = await Promise.allSettled(
    this.operations.map(op => op.execute())
  )

  const successResults = results
    .filter((r): r is PromiseFulfilledResult<OperationResult> => r.status === 'fulfilled')
    .map(r => r.value)

  return {
    success: results.every(r => r.status === 'fulfilled' && r.value.success),
    data: successResults,
    affectedEntities: successResults.flatMap(r => r.affectedEntities || [])
  }
}
```
**适用场景**: 独立的操作，如批量移动多个不相关的项目

#### 事务执行（Transactional）
```typescript
private async executeTransactional(): Promise<OperationResult> {
  const executedOps: Operation[] = []

  try {
    for (const op of this.operations) {
      const result = await op.execute()
      if (!result.success) {
        throw new Error(`Operation failed: ${result.error}`)
      }
      executedOps.push(op)
    }

    return { success: true, affectedEntities: [] }
  } catch (error) {
    // 自动回滚已执行的操作
    for (let i = executedOps.length - 1; i >= 0; i--) {
      await executedOps[i].undo()
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```
**适用场景**: 需要原子性的操作，如批量导入素材（要么全成功要么全失败）

## 🎯 具体操作实现

### 1. 时间轴项目操作

```typescript
/**
 * 时间轴项目操作类
 * 处理时间轴项目的增删改查操作
 */
class TimelineItemOperation extends AtomicOperation {
  constructor(
    type: 'add' | 'remove' | 'move' | 'transform' | 'split' | 'duplicate',
    private itemData: TimelineItemData,
    private context: OperationContext
  ) {
    super(
      `timeline.item.${type}`,
      `${type} timeline item: ${itemData.name}`,
      {
        itemId: itemData.id,
        itemType: itemData.type,
        trackId: itemData.trackId
      }
    )
  }

  async execute(): Promise<OperationResult> {
    const operationType = this.type.split('.')[2]

    switch (operationType) {
      case 'add':
        return this.executeAdd()
      case 'remove':
        return this.executeRemove()
      case 'move':
        return this.executeMove()
      case 'transform':
        return this.executeTransform()
      case 'split':
        return this.executeSplit()
      case 'duplicate':
        return this.executeDuplicate()
      default:
        return { success: false, error: `Unknown operation type: ${operationType}` }
    }
  }

  async undo(): Promise<OperationResult> {
    const operationType = this.type.split('.')[2]

    switch (operationType) {
      case 'add':
        return this.undoAdd()
      case 'remove':
        return this.undoRemove()
      case 'move':
        return this.undoMove()
      case 'transform':
        return this.undoTransform()
      case 'split':
        return this.undoSplit()
      case 'duplicate':
        return this.undoDuplicate()
      default:
        return { success: false, error: `Unknown operation type: ${operationType}` }
    }
  }

  private async executeAdd(): Promise<OperationResult> {
    try {
      // 从源头重建：从原始素材重新创建sprite和timelineItem
      const sprite = await this.context.createSprite(this.itemData)
      const timelineItem = this.context.createTimelineItem(sprite, this.itemData)

      // 添加到系统
      this.context.timeline.addItem(timelineItem)
      this.context.canvas.addSprite(sprite)

      return {
        success: true,
        data: { timelineItem, sprite },
        affectedEntities: [timelineItem.id],
        metadata: { operation: 'add', itemType: this.itemData.type }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async undoAdd(): Promise<OperationResult> {
    try {
      // 移除并清理资源
      const timelineItem = this.context.timeline.getItem(this.itemData.id)
      if (timelineItem) {
        this.context.canvas.removeSprite(timelineItem.sprite)
        this.context.timeline.removeItem(this.itemData.id)

        // 清理sprite资源
        if (timelineItem.sprite && typeof timelineItem.sprite.destroy === 'function') {
          timelineItem.sprite.destroy()
        }
      }

      return {
        success: true,
        affectedEntities: [this.itemData.id],
        metadata: { operation: 'undo_add' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 其他操作方法的实现...
  private async executeMove(): Promise<OperationResult> {
    // 实现移动逻辑
    return { success: true }
  }

  private async executeTransform(): Promise<OperationResult> {
    // 实现变换逻辑
    return { success: true }
  }

  // ... 更多方法实现
}
```

### 2. 轨道操作

```typescript
/**
 * 轨道操作类
 * 处理轨道的增删改查和状态切换操作
 */
class TrackOperation extends AtomicOperation {
  constructor(
    type: 'add' | 'remove' | 'rename' | 'toggle_visibility' | 'toggle_mute' | 'reorder',
    private trackData: TrackData,
    private context: OperationContext
  ) {
    super(
      `track.${type}`,
      `${type} track: ${trackData.name}`,
      {
        trackId: trackData.id,
        trackName: trackData.name
      }
    )
  }

  async execute(): Promise<OperationResult> {
    const operationType = this.type.split('.')[1]

    switch (operationType) {
      case 'add':
        return this.executeAdd()
      case 'remove':
        return this.executeRemove()
      case 'rename':
        return this.executeRename()
      case 'toggle_visibility':
        return this.executeToggleVisibility()
      case 'toggle_mute':
        return this.executeToggleMute()
      case 'reorder':
        return this.executeReorder()
      default:
        return { success: false, error: `Unknown track operation: ${operationType}` }
    }
  }

  async undo(): Promise<OperationResult> {
    // 实现对应的撤销逻辑
    return { success: true }
  }

  private async executeAdd(): Promise<OperationResult> {
    try {
      const track = this.context.tracks.createTrack(this.trackData)

      return {
        success: true,
        data: { track },
        affectedEntities: [track.id.toString()],
        metadata: { operation: 'add_track', trackName: track.name }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async executeRemove(): Promise<OperationResult> {
    try {
      // 获取轨道上的所有项目
      const affectedItems = this.context.timeline.getItemsInTrack(this.trackData.id)

      // 删除轨道上的所有项目
      for (const item of affectedItems) {
        this.context.timeline.removeItem(item.id)
        this.context.canvas.removeSprite(item.sprite)
      }

      // 删除轨道
      this.context.tracks.removeTrack(this.trackData.id)

      return {
        success: true,
        affectedEntities: [
          this.trackData.id.toString(),
          ...affectedItems.map(item => item.id)
        ],
        metadata: {
          operation: 'remove_track',
          trackName: this.trackData.name,
          removedItemCount: affectedItems.length
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // 其他轨道操作方法...
}
```

## 🏭 操作工厂设计

### 操作工厂类

```typescript
/**
 * 操作工厂 - 负责创建各种操作
 * 提供统一的操作创建接口，封装复杂的操作构建逻辑
 */
class OperationFactory {
  constructor(private context: OperationContext) {}

  // ==================== 时间轴项目操作 ====================

  /**
   * 创建添加时间轴项目操作
   */
  createTimelineItemAdd(itemData: TimelineItemData): Operation {
    return new TimelineItemOperation('add', itemData, this.context)
  }

  /**
   * 创建删除时间轴项目操作
   */
  createTimelineItemRemove(itemId: string): Operation {
    const itemData = this.context.timeline.getItem(itemId)
    if (!itemData) {
      throw new Error(`Timeline item not found: ${itemId}`)
    }
    return new TimelineItemOperation('remove', itemData, this.context)
  }

  /**
   * 创建移动时间轴项目操作
   */
  createTimelineItemMove(
    itemId: string,
    from: { time: number; trackId?: number },
    to: { time: number; trackId?: number }
  ): Operation {
    const itemData = this.context.timeline.getItem(itemId)
    if (!itemData) {
      throw new Error(`Timeline item not found: ${itemId}`)
    }

    return new TimelineItemOperation('move', {
      ...itemData,
      moveFrom: from,
      moveTo: to
    }, this.context)
  }

  /**
   * 创建变换属性操作
   */
  createTimelineItemTransform(
    itemId: string,
    oldTransform: TransformData,
    newTransform: TransformData
  ): Operation {
    const itemData = this.context.timeline.getItem(itemId)
    if (!itemData) {
      throw new Error(`Timeline item not found: ${itemId}`)
    }

    return new TimelineItemOperation('transform', {
      ...itemData,
      oldTransform,
      newTransform
    }, this.context)
  }

  // ==================== 轨道操作 ====================

  /**
   * 创建添加轨道操作
   */
  createTrackAdd(name?: string): Operation {
    const trackData = {
      id: generateId(),
      name: name || `轨道 ${this.context.tracks.getNextTrackNumber()}`,
      isVisible: true,
      isMuted: false
    }

    return new TrackOperation('add', trackData, this.context)
  }

  /**
   * 创建删除轨道操作
   */
  createTrackRemove(trackId: number): Operation {
    const trackData = this.context.tracks.getTrack(trackId)
    if (!trackData) {
      throw new Error(`Track not found: ${trackId}`)
    }

    return new TrackOperation('remove', trackData, this.context)
  }

  // ==================== 复合操作 ====================

  /**
   * 创建自动排列操作
   * 将自动排列分解为多个移动操作
   */
  createAutoArrange(trackId: number): CompositeOperation {
    const items = this.context.timeline.getItemsInTrack(trackId)
    const moveOps = this.calculateAutoArrangeMoves(items)

    return new CompositeOperationImpl(
      moveOps,
      ExecutionStrategy.SEQUENTIAL,
      `自动排列轨道 ${trackId}`,
      {
        trackId,
        itemCount: items.length,
        operationType: 'auto_arrange'
      }
    )
  }

  /**
   * 创建批量删除操作
   */
  createBatchDelete(itemIds: string[]): CompositeOperation {
    const deleteOps = itemIds.map(id => this.createTimelineItemRemove(id))

    return new CompositeOperationImpl(
      deleteOps,
      ExecutionStrategy.TRANSACTIONAL, // 要么全删除，要么全不删除
      `批量删除 ${itemIds.length} 个项目`,
      {
        itemIds,
        itemCount: itemIds.length,
        operationType: 'batch_delete'
      }
    )
  }

  /**
   * 创建批量移动操作
   */
  createBatchMove(moves: Array<{ itemId: string; from: Position; to: Position }>): CompositeOperation {
    const moveOps = moves.map(move =>
      this.createTimelineItemMove(move.itemId, move.from, move.to)
    )

    return new CompositeOperationImpl(
      moveOps,
      ExecutionStrategy.PARALLEL, // 并行执行提高性能
      `批量移动 ${moves.length} 个项目`,
      {
        moveCount: moves.length,
        operationType: 'batch_move'
      }
    )
  }

  /**
   * 计算自动排列需要的移动操作
   */
  private calculateAutoArrangeMoves(items: TimelineItem[]): Operation[] {
    const moves: Operation[] = []
    let currentTime = 0

    // 按开始时间排序
    const sortedItems = [...items].sort((a, b) =>
      a.timeRange.timelineStartTime - b.timeRange.timelineStartTime
    )

    sortedItems.forEach(item => {
      const currentPos = item.timeRange.timelineStartTime / 1000000 // 转换为秒
      if (Math.abs(currentPos - currentTime) > 0.001) { // 允许1毫秒误差
        moves.push(this.createTimelineItemMove(
          item.id,
          { time: currentPos, trackId: item.trackId },
          { time: currentTime, trackId: item.trackId }
        ))
      }
      currentTime += item.duration
    })

    return moves
  }
}
```

## 📚 现代化历史管理器

### 历史管理器实现

```typescript
/**
 * 现代化历史管理器
 * 提供完整的操作历史管理功能
 */
class HistoryManager {
  private history: Operation[] = []
  private currentIndex = -1
  private maxHistorySize = 100
  private listeners: HistoryListener[] = []
  private mergeTimeWindow = 1000 // 1秒内的操作可以合并

  /**
   * 执行操作
   */
  async execute(operation: Operation): Promise<OperationResult> {
    // 1. 验证操作
    if (operation.validate && !(await operation.validate())) {
      return {
        success: false,
        error: 'Operation validation failed',
        metadata: { operationId: operation.id, operationType: operation.type }
      }
    }

    // 2. 执行操作
    const result = await operation.execute()

    if (result.success) {
      // 3. 清理分支历史（如果用户在历史中间执行了新操作）
      this.history.splice(this.currentIndex + 1)

      // 4. 尝试合并操作
      const merged = this.tryMergeWithLast(operation)
      if (!merged) {
        this.history.push(operation)
        this.currentIndex++
      }

      // 5. 限制历史大小
      this.trimHistory()

      // 6. 通知监听器
      this.notifyListeners('executed', operation, result)
    }

    return result
  }

  /**
   * 撤销操作
   */
  async undo(): Promise<OperationResult | null> {
    if (!this.canUndo()) {
      return {
        success: false,
        error: 'No operation to undo'
      }
    }

    const operation = this.history[this.currentIndex]

    // 验证依赖
    if (operation.validate && !(await operation.validate())) {
      return {
        success: false,
        error: 'Cannot undo: operation dependencies not met',
        metadata: { operationId: operation.id, operationType: operation.type }
      }
    }

    const result = await operation.undo()

    if (result.success) {
      this.currentIndex--
      this.notifyListeners('undone', operation, result)
    }

    return result
  }

  /**
   * 重做操作
   */
  async redo(): Promise<OperationResult | null> {
    if (!this.canRedo()) {
      return {
        success: false,
        error: 'No operation to redo'
      }
    }

    this.currentIndex++
    const operation = this.history[this.currentIndex]

    // 验证依赖
    if (operation.validate && !(await operation.validate())) {
      this.currentIndex-- // 回滚索引
      return {
        success: false,
        error: 'Cannot redo: operation dependencies not met',
        metadata: { operationId: operation.id, operationType: operation.type }
      }
    }

    const result = await operation.execute()

    if (result.success) {
      this.notifyListeners('redone', operation, result)
    } else {
      this.currentIndex-- // 回滚索引
    }

    return result
  }

  /**
   * 批量执行操作
   */
  async executeBatch(operations: Operation[], strategy: ExecutionStrategy = ExecutionStrategy.TRANSACTIONAL): Promise<OperationResult> {
    const batchOp = new CompositeOperationImpl(
      operations,
      strategy,
      `批量操作 (${operations.length} 个操作)`,
      { batchSize: operations.length, strategy }
    )

    return this.execute(batchOp)
  }

  /**
   * 获取历史摘要
   */
  getHistorySummary(): HistorySummary {
    return {
      total: this.history.length,
      current: this.currentIndex + 1,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      operations: this.history.map((op, index) => ({
        id: op.id,
        type: op.type,
        description: op.description,
        timestamp: op.timestamp,
        isCurrent: index === this.currentIndex,
        metadata: op.metadata
      }))
    }
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.history = []
    this.currentIndex = -1
    this.notifyListeners('cleared', null, { success: true })
  }

  /**
   * 添加历史监听器
   */
  addListener(listener: HistoryListener): void {
    this.listeners.push(listener)
  }

  /**
   * 移除历史监听器
   */
  removeListener(listener: HistoryListener): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  // ==================== 私有方法 ====================

  private tryMergeWithLast(operation: Operation): boolean {
    if (this.history.length === 0) return false

    const lastOp = this.history[this.currentIndex]

    // 检查是否可以合并
    if (lastOp.canMerge?.(operation)) {
      // 检查时间窗口
      const timeDiff = operation.timestamp - lastOp.timestamp
      if (timeDiff <= this.mergeTimeWindow) {
        const merged = lastOp.merge!(operation)
        this.history[this.currentIndex] = merged
        return true
      }
    }

    return false
  }

  private trimHistory(): void {
    if (this.history.length > this.maxHistorySize) {
      const removeCount = this.history.length - this.maxHistorySize
      this.history.splice(0, removeCount)
      this.currentIndex -= removeCount
    }
  }

  private notifyListeners(event: string, operation: Operation | null, result: OperationResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, operation, result)
      } catch (error) {
        console.error('History listener error:', error)
      }
    })
  }

  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }
}

/**
 * 历史监听器类型
 */
type HistoryListener = (
  event: string,
  operation: Operation | null,
  result: OperationResult
) => void

/**
 * 历史摘要接口
 */
interface HistorySummary {
  total: number
  current: number
  canUndo: boolean
  canRedo: boolean
  operations: Array<{
    id: string
    type: string
    description: string
    timestamp: number
    isCurrent: boolean
    metadata: Record<string, any>
  }>
}
```

## 🔧 操作上下文设计

### 操作上下文类

```typescript
/**
 * 操作上下文
 * 提供操作执行所需的所有依赖和服务
 */
class OperationContext {
  constructor(
    public readonly timeline: TimelineService,
    public readonly canvas: CanvasService,
    public readonly tracks: TrackService,
    public readonly media: MediaService,
    public readonly webav: WebAVService
  ) {}

  /**
   * 从原始素材创建sprite
   * 注意：这里的"原始素材"指的是已经解析好的MP4Clip/ImgClip，而不是二进制文件
   * 通过克隆已有的Clip来避免重复解析，大大提升性能
   */
  async createSprite(itemData: TimelineItemData): Promise<VideoVisibleSprite | ImageVisibleSprite> {
    const mediaItem = this.media.getItem(itemData.mediaItemId)
    if (!mediaItem) {
      throw new Error(`Media item not found: ${itemData.mediaItemId}`)
    }

    // 检查素材是否已经解析完成
    if (!mediaItem.isReady) {
      throw new Error(`Media item is not ready: ${itemData.mediaItemId}`)
    }

    let sprite: VideoVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video') {
      if (!mediaItem.mp4Clip) {
        throw new Error(`MP4Clip not found for video: ${itemData.mediaItemId}`)
      }
      // 使用克隆方法，避免重新解析文件（性能优化）
      const clonedClip = await this.webav.cloneMP4Clip(mediaItem.mp4Clip)
      sprite = new VideoVisibleSprite(clonedClip)
    } else if (mediaItem.mediaType === 'image') {
      if (!mediaItem.imgClip) {
        throw new Error(`ImgClip not found for image: ${itemData.mediaItemId}`)
      }
      // 使用克隆方法，避免重新解析文件（性能优化）
      const clonedClip = await this.webav.cloneImgClip(mediaItem.imgClip)
      sprite = new ImageVisibleSprite(clonedClip)
    } else {
      throw new Error(`Unsupported media type: ${mediaItem.mediaType}`)
    }

    // 应用变换属性
    this.applyTransformToSprite(sprite, itemData)

    return sprite
  }

  /**
   * 创建时间轴项目
   */
  createTimelineItem(sprite: any, itemData: TimelineItemData): TimelineItem {
    const timelineItem: TimelineItem = {
      id: itemData.id,
      mediaItemId: itemData.mediaItemId,
      sprite: markRaw(sprite),
      trackId: itemData.trackId,
      mediaType: itemData.mediaType,
      timeRange: { ...itemData.timeRange },
      position: { ...itemData.position },
      size: { ...itemData.size },
      rotation: itemData.rotation,
      zIndex: itemData.zIndex,
      opacity: itemData.opacity,
      thumbnailUrl: itemData.thumbnailUrl,
      volume: itemData.volume || 1.0,
      isMuted: itemData.isMuted || false
    }

    return timelineItem
  }

  /**
   * 应用变换属性到sprite
   */
  private applyTransformToSprite(sprite: any, itemData: TimelineItemData): void {
    // 设置时间范围
    sprite.setTimeRange(itemData.timeRange)

    // 设置位置和大小
    sprite.rect = {
      x: itemData.position.x,
      y: itemData.position.y,
      w: itemData.size.width,
      h: itemData.size.height
    }

    // 设置其他属性
    sprite.rotation = itemData.rotation
    sprite.opacity = itemData.opacity
    sprite.zIndex = itemData.zIndex

    // 设置音频属性（如果是视频）
    if (itemData.mediaType === 'video' && 'setVolume' in sprite) {
      sprite.setVolume(itemData.volume || 1.0)
      sprite.setMuted(itemData.isMuted || false)
    }
  }
}

### 服务接口定义

```typescript
/**
 * 服务接口定义
 * 定义操作上下文所需的各种服务接口
 */
interface TimelineService {
  addItem(item: TimelineItem): void
  removeItem(itemId: string): void
  getItem(itemId: string): TimelineItem | undefined
  getItemsInTrack(trackId: number): TimelineItem[]
  updateItem(itemId: string, updates: Partial<TimelineItem>): void
}

interface CanvasService {
  addSprite(sprite: any): void
  removeSprite(sprite: any): void
  updateSprite(sprite: any): void
}

interface TrackService {
  createTrack(data: TrackData): Track
  removeTrack(trackId: number): void
  getTrack(trackId: number): Track | undefined
  getNextTrackNumber(): number
  updateTrack(trackId: number, updates: Partial<Track>): void
}

interface MediaService {
  getItem(mediaItemId: string): MediaItem | undefined
  addItem(item: MediaItem): void
  removeItem(mediaItemId: string): void
}

/**
 * 媒体项目接口
 */
interface MediaItem {
  id: string
  file: File
  name: string
  mediaType: 'video' | 'image'
  isReady: boolean
  mp4Clip?: MP4Clip | null
  imgClip?: ImgClip | null
  duration?: number
  thumbnailUrl?: string
}

interface WebAVService {
  cloneMP4Clip(originalClip: MP4Clip): Promise<MP4Clip>
  cloneImgClip(originalClip: ImgClip): Promise<ImgClip>
  getCanvas(): AVCanvas | undefined
}
```

## 💡 使用示例

### 基本使用流程

```typescript
// 1. 初始化系统
const context = new OperationContext(
  timelineService,
  canvasService,
  trackService,
  mediaService,
  webavService
)

const factory = new OperationFactory(context)
const history = new HistoryManager()

// 2. 执行单个操作
const addOp = factory.createTimelineItemAdd(timelineItemData)
const result = await history.execute(addOp)

if (result.success) {
  console.log('操作执行成功:', result.data)
} else {
  console.error('操作执行失败:', result.error)
}

// 3. 执行复合操作
const autoArrangeOp = factory.createAutoArrange(trackId)
await history.execute(autoArrangeOp)

// 4. 批量操作
const batchDeleteOp = factory.createBatchDelete(['item1', 'item2', 'item3'])
await history.execute(batchDeleteOp)

// 5. 撤销/重做
const undoResult = await history.undo()
const redoResult = await history.redo()

// 6. 获取历史摘要
const summary = history.getHistorySummary()
console.log(`历史记录: ${summary.current}/${summary.total}`)
```

## 🚀 完全重构实现计划

### 重构策略

#### 🎯 重构原则
1. **彻底替换**：完全抛弃现有的 `SimpleCommand` 和 `SimpleHistoryManager`
2. **现代化架构**：采用文档中设计的完整架构
3. **一次性切换**：开发完成后一次性替换，避免维护两套系统
4. **完整测试**：确保新系统功能完备后再上线

### 阶段1：核心架构搭建（2-3天）

**目标**: 建立现代化操作记录系统的完整基础架构

#### 📁 文件结构设计
```
frontend/src/stores/operations/
├── types/
│   ├── Operation.ts              # 核心接口定义
│   ├── OperationResult.ts        # 操作结果类型
│   ├── ExecutionStrategy.ts      # 执行策略枚举
│   └── index.ts                  # 类型导出
├── base/
│   ├── AtomicOperation.ts        # 原子操作基类
│   ├── CompositeOperation.ts     # 复合操作实现
│   └── index.ts                  # 基类导出
├── context/
│   ├── OperationContext.ts       # 操作上下文
│   ├── ServiceInterfaces.ts      # 服务接口定义
│   ├── ServiceImplementations.ts # 服务实现适配器
│   └── index.ts                  # 上下文导出
├── history/
│   ├── HistoryManager.ts         # 现代化历史管理器
│   ├── HistoryTypes.ts           # 历史相关类型
│   └── index.ts                  # 历史管理导出
├── factory/
│   ├── OperationFactory.ts       # 操作工厂
│   └── index.ts                  # 工厂导出
├── implementations/
│   ├── timeline/
│   │   ├── TimelineItemOperations.ts  # 时间轴项目操作
│   │   ├── TimelineItemTypes.ts       # 时间轴操作类型
│   │   └── index.ts
│   ├── track/
│   │   ├── TrackOperations.ts          # 轨道操作
│   │   ├── TrackTypes.ts               # 轨道操作类型
│   │   └── index.ts
│   ├── composite/
│   │   ├── AutoArrangeOperation.ts     # 自动排列复合操作
│   │   ├── BatchOperations.ts          # 批量操作
│   │   └── index.ts
│   └── index.ts                        # 所有操作导出
├── utils/
│   ├── OperationUtils.ts         # 操作工具函数
│   ├── ValidationUtils.ts        # 验证工具
│   └── index.ts                  # 工具导出
└── index.ts                      # 整个操作系统导出
```

#### 🔧 核心组件设计
- [ ] **Operation接口体系** - 核心接口、原子操作基类、复合操作接口和实现
- [ ] **OperationContext** - 服务接口定义、服务实现适配器、统一的依赖注入容器
- [ ] **HistoryManager** - 现代化的历史管理器、支持操作合并、依赖验证、完整的监听器系统
- [ ] **OperationFactory** - 统一的操作创建接口、支持所有类型的操作创建、内置参数验证

#### 验证标准
- ✅ 核心接口设计完整且类型安全
- ✅ 基础架构可以支持简单的操作执行和撤销
- ✅ 代码结构清晰，易于扩展

### 阶段2：服务适配层实现（1-2天）

**目标**: 创建服务适配器，让新系统能够与现有的videoStore模块无缝集成

#### 🔌 适配器设计
需要适配的服务：
- [ ] **TimelineService** - 时间轴操作适配器
- [ ] **CanvasService** - WebAV画布操作适配器
- [ ] **TrackService** - 轨道管理适配器
- [ ] **MediaService** - 素材管理适配器
- [ ] **WebAVService** - WebAV对象管理适配器

#### 验证标准
- ✅ 所有服务适配器正常工作
- ✅ 与现有videoStore模块无缝集成
- ✅ 适配器接口设计合理

### 阶段3：基础操作实现（3-4天）

**目标**: 实现所有基础的原子操作

#### 📝 操作清单
**时间轴项目操作**：
- [ ] AddTimelineItemOperation
- [ ] RemoveTimelineItemOperation
- [ ] MoveTimelineItemOperation
- [ ] TransformTimelineItemOperation
- [ ] SplitTimelineItemOperation
- [ ] DuplicateTimelineItemOperation
- [ ] ResizeTimelineItemOperation

**轨道操作**：
- [ ] AddTrackOperation
- [ ] RemoveTrackOperation
- [ ] RenameTrackOperation
- [ ] ToggleTrackVisibilityOperation
- [ ] ToggleTrackMuteOperation

**音频操作**：
- [ ] VolumeChangeOperation
- [ ] MuteToggleOperation

#### 🔄 重建逻辑设计
每个操作都要实现"从源头重建"原则：
1. 保存重建所需的元数据
2. 从已解析的MP4Clip/ImgClip克隆创建
3. 应用所有变换属性
4. 正确处理资源清理

#### 验证标准
- ✅ 所有基础操作支持撤销/重做
- ✅ 操作描述清晰准确
- ✅ "从源头重建"逻辑正确实现

### 阶段4：复合操作实现（2-3天）

**目标**: 实现复杂的复合操作和不同执行策略

#### 🔧 复合操作类型
- [ ] **AutoArrangeOperation** - 自动排列（顺序执行）
- [ ] **BatchDeleteOperation** - 批量删除（事务执行）
- [ ] **BatchMoveOperation** - 批量移动（并行执行）
- [ ] **BatchTransformOperation** - 批量变换（并行执行）

#### ⚙️ 执行策略实现
- [ ] **Sequential** - 顺序执行，有依赖关系的操作
- [ ] **Parallel** - 并行执行，独立操作提升性能
- [ ] **Transactional** - 事务执行，全成功或全失败

#### 验证标准
- ✅ 复合操作可以作为整体撤销/重做
- ✅ 不同执行策略工作正常
- ✅ 事务操作支持自动回滚

### 阶段5：高级功能实现（2-3天）

**目标**: 实现操作合并、依赖验证等高级功能

#### 🚀 高级功能清单
- [ ] **操作合并机制** - 连续相似操作的智能合并、时间窗口控制、合并规则定义
- [ ] **依赖验证系统** - 操作前置条件检查、资源存在性验证、状态一致性检查
- [ ] **监听器系统** - 历史变化监听、操作执行监听、错误处理监听
- [ ] **批量执行功能** - 支持批量操作执行、不同策略的批量处理、批量操作的进度反馈

#### 验证标准
- ✅ 连续相似操作可以智能合并
- ✅ 依赖缺失时给出清晰提示
- ✅ 系统具有良好的容错能力

### 阶段6：UI集成和替换（1-2天）

**目标**: 完全替换videoStore中的历史记录相关代码

#### 🔄 替换步骤
- [ ] **移除旧代码** - 删除 `historyModule.ts`、删除 `commands/` 目录、清理videoStore中的历史包装方法
- [ ] **集成新系统** - 在videoStore中初始化新的操作系统、更新所有操作方法、确保响应式状态正确
- [ ] **UI组件更新** - 更新撤销/重做按钮、更新快捷键处理、更新错误提示

#### 验证标准
- ✅ 旧系统完全移除
- ✅ 新系统正常工作
- ✅ UI交互体验良好

### 阶段7：测试和优化（1-2天）

**目标**: 确保系统稳定性和性能

#### 🧪 测试策略
- [ ] **单元测试** - 每个操作类的测试、HistoryManager的测试、OperationFactory的测试
- [ ] **集成测试** - 完整操作流程测试、复合操作测试、错误恢复测试
- [ ] **性能测试** - 大量操作的性能测试、内存使用测试、并发操作测试

#### 验证标准
- ✅ 系统运行流畅，内存使用合理
- ✅ 用户体验直观友好
- ✅ 具有完善的可观测性

## 📊 完全重构进度跟踪

| 阶段 | 功能 | 预计时间 | 风险等级 | 状态 | 完成日期 |
|------|------|----------|----------|------|----------|
| 1 | 核心架构搭建 | 2-3天 | 🟡 中等 | ⚪ 待开始 | - |
| 2 | 服务适配层实现 | 1-2天 | 🟢 低 | ⚪ 待开始 | - |
| 3 | 基础操作实现 | 3-4天 | 🟡 中等 | ⚪ 待开始 | - |
| 4 | 复合操作实现 | 2-3天 | 🟠 较高 | ⚪ 待开始 | - |
| 5 | 高级功能实现 | 2-3天 | 🟠 较高 | ⚪ 待开始 | - |
| 6 | UI集成和替换 | 1-2天 | 🔴 高 | ⚪ 待开始 | - |
| 7 | 测试和优化 | 1-2天 | 🟢 低 | ⚪ 待开始 | - |

**总计预估时间**: 12-19天

### 🎯 关键决策点

#### 1. 数据迁移策略
**问题**：现有的历史记录如何处理？
**决策**：清空现有历史，从新系统开始记录

#### 2. 错误处理策略
**问题**：操作失败时如何处理？
**决策**：详细的错误反馈 + 用户友好的提示

#### 3. 性能优化策略
**问题**：如何确保新系统性能不下降？
**决策**：并行执行 + 操作合并 + 智能内存管理

#### 4. 向后兼容策略
**问题**：是否需要考虑API兼容性？
**决策**：完全重构，不考虑向后兼容

### 🚨 风险评估

#### 高风险项
1. **WebAV对象生命周期管理** - 需要仔细处理资源创建和销毁
2. **UI集成替换** - 可能影响现有功能的稳定性
3. **复合操作的复杂性** - 不同执行策略的协调

#### 风险缓解措施
1. **充分测试** - 每个阶段都要有完整的测试
2. **备份方案** - 保留旧代码作为回滚选项
3. **分支开发** - 在独立分支进行开发，确保主分支稳定

### 🎉 预期收益

#### 技术收益
- **更清晰的架构** - 统一的操作抽象
- **更好的扩展性** - 支持复杂的业务逻辑
- **更强的类型安全** - 完整的TypeScript支持
- **更高的性能** - 并行执行和智能优化

#### 用户体验收益
- **更智能的撤销/重做** - 支持复合操作
- **更好的错误处理** - 清晰的错误提示
- **更流畅的操作** - 性能优化带来的体验提升

## 🧪 测试策略

### 单元测试
- Operation接口的各种实现类
- HistoryManager的核心逻辑
- OperationFactory的操作创建
- 执行策略的正确性
- 操作合并和依赖验证逻辑

### 集成测试
- 与现有videoStore的集成
- WebAV对象的状态恢复
- 复合操作的完整执行流程
- 不同执行策略的协同工作
- 错误处理和恢复机制

### 性能测试
- 大量操作的执行性能
- 内存使用和垃圾回收
- 历史记录的存储和检索
- 并行操作的性能表现

### 用户测试
- 常见操作流程的撤销/重做
- 复杂操作序列的用户体验
- 错误情况下的用户反馈
- 快捷键和UI交互的流畅性

## 🎯 设计优势

### 1. **统一的抽象层**
- 所有操作都实现同一个Operation接口
- 原子操作和复合操作在使用上完全一致
- 简化了上层调用代码的复杂性

### 2. **灵活的执行策略**
- **顺序执行**: 适合有依赖关系的操作
- **并行执行**: 提高独立操作的性能
- **事务执行**: 保证操作的原子性

### 3. **强大的组合能力**
- 支持无限嵌套的复合操作
- 可以构建复杂的业务逻辑
- 易于扩展新的操作类型

### 4. **完善的错误处理**
- 详细的操作结果反馈
- 事务模式支持自动回滚
- 依赖验证机制

### 5. **高性能设计**
- 支持操作合并，减少历史记录冗余
- 并行执行能力，提高批量操作性能
- 智能内存管理，控制资源使用

### 6. **优秀的可观测性**
- 完整的操作元数据追踪
- 历史监听器机制
- 详细的执行结果反馈

### 7. **类型安全**
- 完整的TypeScript类型定义
- 编译时错误检查
- 更好的IDE支持和代码提示

## 📝 开发注意事项

### 核心设计原则

#### 🎯 "从源头重建"原则
**继续保持的重要原则**：每次操作执行都应该从已解析的素材（MP4Clip/ImgClip）完全重新创建所有对象。

**重要性能优化**：
- **源头** = 已解析并缓存在MediaItem中的MP4Clip/ImgClip
- **重建** = 克隆Clip + 创建新Sprite + 应用所有属性
- **不是** = 从二进制文件重新解析（这会很慢）

```typescript
// ✅ 正确的实现方式（性能优化版）
class TimelineItemOperation extends AtomicOperation {
  async execute(): Promise<OperationResult> {
    // 1. 从已解析的素材克隆创建（避免重新解析文件）
    const sprite = await this.context.createSprite(this.itemData)

    // 2. 应用所有属性
    this.context.applyTransformToSprite(sprite, this.itemData)

    // 3. 创建新的时间轴项目
    const timelineItem = this.context.createTimelineItem(sprite, this.itemData)

    // 4. 添加到系统
    this.context.timeline.addItem(timelineItem)
    this.context.canvas.addSprite(sprite)

    return { success: true, affectedEntities: [timelineItem.id] }
  }
}
```

#### 🔧 技术实现要点

1. **操作上下文**: 通过OperationContext提供所有必要的服务和依赖
2. **类型安全**: 充分利用TypeScript的类型系统
3. **异步处理**: 所有操作都支持异步执行
4. **资源管理**: 及时清理WebAV资源，避免内存泄漏
5. **错误恢复**: 完善的错误处理和恢复机制

## 🎯 成功标准

### 功能完整性
- ✅ 所有主要用户操作支持撤销/重做
- ✅ 复合操作可以作为整体撤销/重做
- ✅ 支持不同的执行策略（顺序、并行、事务）
- ✅ 操作合并功能正常工作
- ✅ 依赖验证机制有效

### 系统质量
- ✅ 系统稳定性和性能不受影响
- ✅ 内存使用控制在合理范围
- ✅ 错误处理完善，具有良好的容错能力
- ✅ 代码架构清晰，易于维护和扩展

### 用户体验
- ✅ 用户界面直观友好
- ✅ 操作反馈及时准确
- ✅ 快捷键支持完善
- ✅ 错误提示清晰有用

### 技术质量
- ✅ 充分的测试覆盖（单元、集成、性能）
- ✅ 完整的类型安全保障
- ✅ 良好的可观测性和调试能力
- ✅ 遵循现代化的设计模式和最佳实践

## � 迁移指南

### 从旧系统迁移到新系统

#### 第一步：准备工作
1. **备份现有代码**：确保可以回滚到当前工作状态
2. **分析现有操作**：梳理所有需要支持撤销/重做的操作
3. **设计服务接口**：定义OperationContext所需的各种服务

#### 第二步：核心架构迁移
1. **创建新的接口和类**：
   ```typescript
   // 创建新文件结构
   src/stores/modules/operations/
   ├── interfaces.ts          // Operation接口定义
   ├── base/                  // 基础类
   │   ├── AtomicOperation.ts
   │   └── CompositeOperation.ts
   ├── context/               // 操作上下文
   │   └── OperationContext.ts
   ├── factory/               // 操作工厂
   │   └── OperationFactory.ts
   ├── history/               // 历史管理
   │   └── HistoryManager.ts
   └── implementations/       // 具体操作实现
       ├── TimelineItemOperation.ts
       └── TrackOperation.ts
   ```

2. **逐步替换现有实现**：
   - 先实现一个简单操作（如添加时间轴项目）
   - 验证新系统工作正常
   - 逐步迁移其他操作

#### 第三步：UI层集成
1. **更新videoStore方法**：
   ```typescript
   // 旧方式
   function addTimelineItem(item: TimelineItem) {
     timelineModule.addTimelineItem(item)
   }

   // 新方式
   async function addTimelineItem(item: TimelineItem) {
     const operation = factory.createTimelineItemAdd(item)
     await history.execute(operation)
   }
   ```

2. **更新UI组件**：
   - 将同步调用改为异步调用
   - 添加适当的loading状态
   - 更新错误处理逻辑

### 迁移时间估算

| 阶段 | 工作内容 | 预计时间 |
|------|---------|----------|
| 准备工作 | 分析现有代码，设计新架构 | 1天 |
| 核心架构 | 实现基础类和接口 | 2-3天 |
| 基础操作 | 迁移时间轴和轨道操作 | 3-4天 |
| 复合操作 | 实现复杂的批量操作 | 2-3天 |
| 高级功能 | 操作合并、依赖验证等 | 2-3天 |
| 测试优化 | 完整测试和性能优化 | 1-2天 |

**总计**: 11-16天

### 风险评估

#### 高风险
- **WebAV对象生命周期管理**：需要仔细处理资源创建和销毁
- **异步操作复杂性**：可能影响UI响应性

#### 中风险
- **性能影响**：新系统可能比旧系统稍慢
- **内存使用**：历史记录可能增加内存消耗

#### 低风险
- **类型安全**：TypeScript提供良好的编译时检查
- **测试覆盖**：新架构更容易编写单元测试

## 📈 新系统优势对比

### 与旧系统对比

| 特性 | 旧系统 | 新系统 |
|------|--------|--------|
| **操作抽象** | 分散的Command类 | 统一的Operation接口 |
| **执行策略** | 仅支持顺序执行 | 支持顺序/并行/事务执行 |
| **操作组合** | 不支持 | 支持无限嵌套的复合操作 |
| **错误处理** | 基础的try-catch | 详细的OperationResult反馈 |
| **操作合并** | 不支持 | 智能操作合并机制 |
| **依赖验证** | 不支持 | 完整的依赖验证系统 |
| **类型安全** | 部分支持 | 完整的TypeScript类型安全 |
| **可观测性** | 基础日志 | 完整的监听器和元数据追踪 |
| **性能** | 一般 | 支持并行执行，性能更好 |
| **扩展性** | 较难扩展 | 高度可扩展的架构 |

### 实际收益

#### 开发效率提升
- **统一的开发模式**：所有操作都遵循相同的模式
- **更好的代码复用**：通过操作工厂和组合模式
- **更容易的测试**：清晰的接口和依赖注入

#### 用户体验改善
- **更智能的撤销/重做**：支持复杂操作的整体撤销
- **更好的错误提示**：详细的操作结果反馈
- **更流畅的操作**：并行执行提高性能

#### 系统稳定性
- **更强的类型安全**：减少运行时错误
- **更好的错误恢复**：事务模式支持自动回滚
- **更完善的资源管理**：避免内存泄漏

## 🎉 总结

### 现代化操作记录系统的核心价值

这个全新设计的操作记录系统代表了视频编辑器架构的重大升级，从传统的命令模式演进到现代化的操作抽象模式。

#### 🚀 技术创新点

1. **统一操作抽象**：所有操作都实现同一个Operation接口，消除了原子操作和复合操作之间的差异
2. **灵活执行策略**：支持顺序、并行、事务三种执行模式，适应不同的业务场景
3. **强大组合能力**：支持无限嵌套的复合操作，可以构建任意复杂的业务逻辑
4. **完善错误处理**：详细的操作结果反馈和自动回滚机制
5. **智能操作合并**：减少历史记录冗余，提升用户体验
6. **全面类型安全**：充分利用TypeScript的类型系统，减少运行时错误

#### 🎯 业务价值

1. **用户体验升级**：
   - 复杂操作可以整体撤销/重做
   - 智能的操作合并减少历史记录噪音
   - 清晰的错误提示和恢复机制

2. **开发效率提升**：
   - 统一的开发模式和工具链
   - 更容易的测试和调试
   - 高度可扩展的架构设计

3. **系统稳定性**：
   - 完整的类型安全保障
   - 事务模式确保数据一致性
   - 完善的资源管理机制

#### 🔮 未来扩展性

这个架构为未来的功能扩展奠定了坚实的基础：

- **协作编辑**：操作可以序列化，支持多用户协作
- **操作录制**：可以录制用户操作序列，支持宏功能
- **智能建议**：基于操作历史提供智能操作建议
- **性能优化**：并行执行和批量操作优化
- **云端同步**：操作历史可以同步到云端

### 实施建议

建议按照文档中的7个阶段进行完全重构：

1. **阶段1**：核心架构搭建，建立现代化基础
2. **阶段2**：服务适配层实现，连接现有系统
3. **阶段3**：基础操作实现，验证架构可行性
4. **阶段4**：复合操作实现，展现架构优势
5. **阶段5**：高级功能实现，完善用户体验
6. **阶段6**：UI集成和替换，完全切换到新系统
7. **阶段7**：测试和优化，确保生产就绪

这个现代化的操作记录系统将为视频编辑器带来质的飞跃，不仅解决了当前的撤销/重做需求，更为未来的功能扩展提供了强大的技术基础。

## 🔄 完全重构迁移指南

### 重构前准备工作

#### 第一步：代码备份和分析
1. **创建重构分支**：`git checkout -b feature/operation-system-rewrite`
2. **备份现有代码**：确保可以回滚到当前工作状态
3. **分析现有操作**：梳理所有需要支持撤销/重做的操作
4. **识别依赖关系**：分析操作之间的依赖关系

#### 第二步：设计验证
1. **验证架构设计**：确保新架构能满足所有需求
2. **确认接口设计**：验证服务接口的完整性
3. **制定测试策略**：确保每个阶段都有验证方法

### 完全重构执行步骤

#### 阶段1执行：核心架构搭建
1. **创建新目录结构**：按照文档中的文件结构创建目录
2. **实现核心接口**：Operation、OperationResult、ExecutionStrategy等
3. **实现基础类**：AtomicOperation、CompositeOperation
4. **创建历史管理器**：现代化的HistoryManager
5. **建立测试框架**：为后续开发提供测试基础

#### 阶段2执行：服务适配层
1. **定义服务接口**：TimelineService、CanvasService等
2. **实现适配器**：连接现有videoStore模块
3. **创建操作上下文**：OperationContext统一管理依赖
4. **验证适配器**：确保与现有系统正常交互

#### 阶段3执行：基础操作实现
1. **实现时间轴操作**：Add、Remove、Move、Transform等
2. **实现轨道操作**：Add、Remove、Rename、Toggle等
3. **实现音频操作**：Volume、Mute等
4. **创建操作工厂**：统一的操作创建接口
5. **单元测试**：每个操作都要有完整测试

#### 阶段4执行：复合操作实现
1. **实现自动排列**：AutoArrangeOperation
2. **实现批量操作**：BatchDelete、BatchMove等
3. **实现执行策略**：Sequential、Parallel、Transactional
4. **集成测试**：验证复合操作的正确性

#### 阶段5执行：高级功能实现
1. **操作合并机制**：智能合并相似操作
2. **依赖验证系统**：操作前置条件检查
3. **监听器系统**：历史变化监听
4. **批量执行功能**：支持批量操作

#### 阶段6执行：UI集成和替换
1. **移除旧代码**：
   ```bash
   # 删除旧的历史记录相关文件
   rm frontend/src/stores/modules/historyModule.ts
   rm -rf frontend/src/stores/modules/commands/
   ```

2. **更新videoStore**：
   ```typescript
   // 替换历史记录模块导入
   - import { createHistoryModule } from './modules/historyModule'
   + import { createOperationSystem } from './operations'

   // 更新初始化代码
   - const historyModule = createHistoryModule()
   + const operationSystem = createOperationSystem()
   ```

3. **更新所有操作方法**：将所有带History后缀的方法替换为新的操作系统调用

4. **更新UI组件**：
   - 更新撤销/重做按钮的状态绑定
   - 更新快捷键处理逻辑
   - 更新错误提示显示

#### 阶段7执行：测试和优化
1. **完整功能测试**：测试所有操作的撤销/重做
2. **性能测试**：确保性能不下降
3. **内存测试**：检查内存使用情况
4. **用户体验测试**：确保UI交互流畅

### 重构验证清单

#### 功能验证
- [ ] 所有基础操作支持撤销/重做
- [ ] 复合操作可以整体撤销/重做
- [ ] 不同执行策略正常工作
- [ ] 操作合并功能正常
- [ ] 错误处理完善

#### 性能验证
- [ ] 操作执行性能不下降
- [ ] 内存使用在合理范围
- [ ] UI响应性良好
- [ ] 大量操作时系统稳定

#### 用户体验验证
- [ ] 撤销/重做按钮状态正确
- [ ] 快捷键正常工作
- [ ] 错误提示清晰友好
- [ ] 操作描述准确

### 回滚策略

如果重构过程中遇到无法解决的问题：

1. **保留旧代码**：在删除旧代码前确保新系统完全可用
2. **分支管理**：使用Git分支管理，可以随时切换回主分支
3. **渐进回滚**：如果部分功能有问题，可以只回滚有问题的部分
4. **数据恢复**：确保用户数据不会因为重构而丢失

---

*本文档描述了现代化操作记录系统的完整设计方案，为视频编辑器的重构提供了详细的技术指导。*
