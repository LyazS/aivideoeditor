import type { Operation, CompositeOperation, OperationResult, ExecutionStrategy } from '../../types'
import type { OperationContext, Position } from '../../context'
import { CompositeOperationImpl } from '../../base'
import { OperationUtils } from '../../utils'

/**
 * 自动排列操作
 * 将轨道上的所有项目按时间顺序重新排列，消除间隙
 */
export class AutoArrangeOperation extends CompositeOperationImpl {
  constructor(
    private trackId: number,
    private context: OperationContext
  ) {
    // 获取轨道上的所有项目
    const items = context.timeline.getItemsInTrack(trackId)
    
    // 计算自动排列需要的移动操作
    const moveOperations = AutoArrangeOperation.calculateAutoArrangeMoves(items, context)

    super(
      moveOperations,
      'sequential', // 顺序执行，确保移动操作的正确性
      OperationUtils.formatOperationDescription('composite', {
        operationType: 'auto_arrange',
        trackId,
        itemCount: items.length
      }),
      {
        trackId,
        itemCount: items.length,
        operationType: 'auto_arrange',
        moveCount: moveOperations.length
      }
    )
  }

  /**
   * 计算自动排列需要的移动操作
   */
  private static calculateAutoArrangeMoves(items: any[], context: OperationContext): Operation[] {
    const moves: Operation[] = []
    let currentTime = 0

    // 按开始时间排序
    const sortedItems = [...items].sort((a, b) =>
      a.timeRange.timelineStartTime - b.timeRange.timelineStartTime
    )

    sortedItems.forEach(item => {
      const currentPos = item.timeRange.timelineStartTime / 1000000 // 转换为秒
      const duration = (item.timeRange.timelineEndTime - item.timeRange.timelineStartTime) / 1000000 // 转换为秒

      // 如果当前位置与目标位置不同，创建移动操作
      if (Math.abs(currentPos - currentTime) > 0.001) { // 允许1毫秒误差
        const from: Position = { time: currentPos, trackId: item.trackId }
        const to: Position = { time: currentTime, trackId: item.trackId }
        
        // 创建移动操作数据
        const moveData = {
          itemId: item.id,
          from,
          to
        }

        // 这里需要通过工厂创建移动操作，但由于循环依赖问题，
        // 我们暂时直接导入操作类
        const { MoveTimelineItemOperation } = require('../timeline/TimelineItemOperations')
        const moveOp = new MoveTimelineItemOperation(moveData, context)
        moves.push(moveOp)
      }
      
      currentTime += duration
    })

    return moves
  }

  async validate(): Promise<boolean> {
    // 验证轨道是否存在
    const track = this.context.tracks.getTrack(this.trackId)
    if (!track) {
      return false
    }

    // 验证所有子操作
    for (const operation of this.operations) {
      if (operation.validate && !(await operation.validate())) {
        return false
      }
    }

    return true
  }
}

/**
 * 批量删除操作
 * 删除多个时间轴项目，使用事务模式确保原子性
 */
export class BatchDeleteOperation extends CompositeOperationImpl {
  constructor(
    private itemIds: string[],
    private context: OperationContext
  ) {
    // 创建删除操作列表
    const { RemoveTimelineItemOperation } = require('../timeline/TimelineItemOperations')
    const deleteOperations = itemIds.map(itemId =>
      new RemoveTimelineItemOperation(itemId, context)
    )

    super(
      deleteOperations,
      'transactional', // 事务执行，要么全删除，要么全不删除
      OperationUtils.formatOperationDescription('composite', {
        operationType: 'batch_delete',
        itemCount: itemIds.length
      }),
      {
        itemIds,
        itemCount: itemIds.length,
        operationType: 'batch_delete'
      }
    )

    this.itemIds = itemIds
  }

  async validate(): Promise<boolean> {
    // 验证所有项目是否存在
    for (const itemId of this.itemIds) {
      const item = this.context.timeline.getItem(itemId)
      if (!item) {
        return false
      }
    }

    // 验证所有子操作
    for (const operation of this.operations) {
      if (operation.validate && !(await operation.validate())) {
        return false
      }
    }

    return true
  }
}

/**
 * 批量移动操作
 * 同时移动多个时间轴项目，使用并行执行提高性能
 */
export class BatchMoveOperation extends CompositeOperationImpl {
  constructor(
    private moves: Array<{ itemId: string; from: Position; to: Position }>,
    private context: OperationContext
  ) {
    // 创建移动操作列表
    const { MoveTimelineItemOperation } = require('../timeline/TimelineItemOperations')
    const moveOperations = moves.map(move =>
      new MoveTimelineItemOperation(move, context)
    )

    super(
      moveOperations,
      'parallel', // 并行执行提高性能
      OperationUtils.formatOperationDescription('composite', {
        operationType: 'batch_move',
        itemCount: moves.length
      }),
      {
        moveCount: moves.length,
        operationType: 'batch_move'
      }
    )

    this.moves = moves
  }

  async validate(): Promise<boolean> {
    // 验证所有项目是否存在
    for (const move of this.moves) {
      const item = this.context.timeline.getItem(move.itemId)
      if (!item) {
        return false
      }
    }

    // 验证所有子操作
    for (const operation of this.operations) {
      if (operation.validate && !(await operation.validate())) {
        return false
      }
    }

    return true
  }
}

/**
 * 批量变换操作
 * 同时变换多个时间轴项目的属性，使用并行执行提高性能
 */
export class BatchTransformOperation extends CompositeOperationImpl {
  constructor(
    private transforms: Array<{ 
      itemId: string; 
      oldTransform: any; 
      newTransform: any 
    }>,
    private context: OperationContext
  ) {
    // 创建变换操作列表
    const { TransformTimelineItemOperation } = require('../timeline/TransformOperations')
    const transformOperations = transforms.map(transform =>
      new TransformTimelineItemOperation(transform, context)
    )

    super(
      transformOperations,
      'parallel', // 并行执行提高性能
      OperationUtils.formatOperationDescription('composite', {
        operationType: 'batch_transform',
        itemCount: transforms.length
      }),
      {
        transformCount: transforms.length,
        operationType: 'batch_transform'
      }
    )

    this.transforms = transforms
  }

  async validate(): Promise<boolean> {
    // 验证所有项目是否存在
    for (const transform of this.transforms) {
      const item = this.context.timeline.getItem(transform.itemId)
      if (!item) {
        return false
      }
    }

    // 验证所有子操作
    for (const operation of this.operations) {
      if (operation.validate && !(await operation.validate())) {
        return false
      }
    }

    return true
  }
}
