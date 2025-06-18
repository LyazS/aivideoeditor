import type { Operation, CompositeOperation, ExecutionStrategy } from '../types'
import type { OperationContext, TimelineItemData, TrackData, TransformData, Position } from '../context'
import { CompositeOperationImpl } from '../base'
import { generateId } from '../utils'
import {
  AddTimelineItemOperation,
  RemoveTimelineItemOperation,
  MoveTimelineItemOperation,
  TransformTimelineItemOperation,
  AddTrackOperation,
  RemoveTrackOperation,
  RenameTrackOperation,
  VolumeChangeOperation,
  MuteToggleOperation,
  AutoArrangeOperation,
  BatchDeleteOperation,
  BatchMoveOperation,
  BatchTransformOperation
} from '../implementations'
import type {
  AddTimelineItemData,
  MoveTimelineItemData,
  TransformTimelineItemData,
  AddTrackData,
  RenameTrackData,
  VolumeChangeData,
  MuteToggleData
} from '../implementations'

/**
 * 操作工厂 - 负责创建各种操作
 * 提供统一的操作创建接口，封装复杂的操作构建逻辑
 */
export class OperationFactory {
  constructor(private context: OperationContext) {}

  // ==================== 时间轴项目操作 ====================

  /**
   * 创建添加时间轴项目操作
   */
  createTimelineItemAdd(itemData: TimelineItemData): Operation {
    return new AddTimelineItemOperation(itemData, this.context)
  }

  /**
   * 创建删除时间轴项目操作
   */
  createTimelineItemRemove(itemId: string): Operation {
    return new RemoveTimelineItemOperation(itemId, this.context)
  }

  /**
   * 创建移动时间轴项目操作
   */
  createTimelineItemMove(
    itemId: string,
    from: Position,
    to: Position
  ): Operation {
    const moveData: MoveTimelineItemData = {
      itemId,
      from,
      to
    }
    return new MoveTimelineItemOperation(moveData, this.context)
  }

  /**
   * 创建变换属性操作
   */
  createTimelineItemTransform(
    itemId: string,
    oldTransform: TransformData,
    newTransform: TransformData
  ): Operation {
    const transformData: TransformTimelineItemData = {
      itemId,
      oldTransform,
      newTransform
    }
    return new TransformTimelineItemOperation(transformData, this.context)
  }

  // ==================== 轨道操作 ====================

  /**
   * 创建添加轨道操作
   */
  createTrackAdd(name?: string): Operation {
    const trackData: AddTrackData = {
      name,
      isVisible: true,
      isMuted: false
    }
    return new AddTrackOperation(trackData, this.context)
  }

  /**
   * 创建删除轨道操作
   */
  createTrackRemove(trackId: number): Operation {
    return new RemoveTrackOperation(trackId, this.context)
  }

  /**
   * 创建重命名轨道操作
   */
  createTrackRename(trackId: number, oldName: string, newName: string): Operation {
    const renameData: RenameTrackData = {
      trackId,
      oldName,
      newName
    }
    return new RenameTrackOperation(renameData, this.context)
  }

  // ==================== 音频操作 ====================

  /**
   * 创建音量变化操作
   */
  createVolumeChange(itemId: string, oldVolume: number, newVolume: number): Operation {
    const volumeData: VolumeChangeData = {
      itemId,
      oldVolume,
      newVolume
    }
    return new VolumeChangeOperation(volumeData, this.context)
  }

  /**
   * 创建静音切换操作
   */
  createMuteToggle(itemId: string, oldMuteState: boolean, newMuteState: boolean): Operation {
    const muteData: MuteToggleData = {
      itemId,
      oldMuteState,
      newMuteState
    }
    return new MuteToggleOperation(muteData, this.context)
  }

  // ==================== 复合操作 ====================

  /**
   * 创建自动排列操作
   * 将自动排列分解为多个移动操作
   */
  createAutoArrange(trackId: number): CompositeOperation {
    return new AutoArrangeOperation(trackId, this.context)
  }

  /**
   * 创建批量删除操作
   */
  createBatchDelete(itemIds: string[]): CompositeOperation {
    return new BatchDeleteOperation(itemIds, this.context)
  }

  /**
   * 创建批量移动操作
   */
  createBatchMove(moves: Array<{ itemId: string; from: Position; to: Position }>): CompositeOperation {
    return new BatchMoveOperation(moves, this.context)
  }

  /**
   * 创建批量变换操作
   */
  createBatchTransform(transforms: Array<{
    itemId: string;
    oldTransform: TransformData;
    newTransform: TransformData
  }>): CompositeOperation {
    return new BatchTransformOperation(transforms, this.context)
  }
}
