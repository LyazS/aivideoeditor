/**
 * 关键帧命令工具函数
 * 提供通过命令系统执行关键帧操作的高级接口
 */

import type { LocalTimelineItem, KeyframeCommandExecutor, BatchKeyframeOperation } from '../types'
import {
  CreateKeyframeCommand,
  DeleteKeyframeCommand,
  UpdatePropertyCommand,
  ClearAllKeyframesCommand,
  ToggleKeyframeCommand,
} from '../stores/modules/commands/keyframeCommands'

// ==================== 关键帧命令执行函数 ====================

/**
 * 通过命令系统创建关键帧
 * @param timelineItemId 时间轴项目ID
 * @param frame 帧数
 * @param executor 命令执行器
 */
export async function createKeyframeWithCommand(
  timelineItemId: string,
  frame: number,
  executor: KeyframeCommandExecutor,
): Promise<void> {
  const command = new CreateKeyframeCommand(
    timelineItemId,
    frame,
    executor.timelineModule,
    executor.webavAnimationManager,
    executor.playbackControls,
  )

  await executor.historyModule.executeCommand(command)
}

/**
 * 通过命令系统删除关键帧
 * @param timelineItemId 时间轴项目ID
 * @param frame 帧数
 * @param executor 命令执行器
 */
export async function deleteKeyframeWithCommand(
  timelineItemId: string,
  frame: number,
  executor: KeyframeCommandExecutor,
): Promise<void> {
  const command = new DeleteKeyframeCommand(
    timelineItemId,
    frame,
    executor.timelineModule,
    executor.webavAnimationManager,
    executor.playbackControls,
  )

  await executor.historyModule.executeCommand(command)
}

/**
 * 通过命令系统更新属性（智能处理关键帧）
 * @param timelineItemId 时间轴项目ID
 * @param frame 帧数
 * @param property 属性名
 * @param value 新值
 * @param executor 命令执行器
 */
export async function updatePropertyWithCommand(
  timelineItemId: string,
  frame: number,
  property: string,
  value: any,
  executor: KeyframeCommandExecutor,
): Promise<void> {
  const command = new UpdatePropertyCommand(
    timelineItemId,
    frame,
    property,
    value,
    executor.timelineModule,
    executor.webavAnimationManager,
    executor.playbackControls,
  )

  await executor.historyModule.executeCommand(command)
}

/**
 * 通过命令系统清除所有关键帧
 * @param timelineItemId 时间轴项目ID
 * @param executor 命令执行器
 */
export async function clearAllKeyframesWithCommand(
  timelineItemId: string,
  executor: KeyframeCommandExecutor,
): Promise<void> {
  const command = new ClearAllKeyframesCommand(
    timelineItemId,
    executor.timelineModule,
    executor.webavAnimationManager,
    executor.playbackControls,
  )

  await executor.historyModule.executeCommand(command)
}

/**
 * 通过命令系统切换关键帧
 * @param timelineItemId 时间轴项目ID
 * @param frame 帧数
 * @param executor 命令执行器
 */
export async function toggleKeyframeWithCommand(
  timelineItemId: string,
  frame: number,
  executor: KeyframeCommandExecutor,
): Promise<void> {
  const command = new ToggleKeyframeCommand(
    timelineItemId,
    frame,
    executor.timelineModule,
    executor.webavAnimationManager,
    executor.playbackControls,
  )

  await executor.historyModule.executeCommand(command)
}

// ==================== 命令执行器工厂函数 ====================

/**
 * 创建关键帧命令执行器
 * 从videoStore获取所需的模块依赖
 */
export async function createKeyframeCommandExecutor(): Promise<KeyframeCommandExecutor> {
  // 动态导入videoStore
  const { useVideoStore } = await import('../stores/videoStore')
  const videoStore = useVideoStore()

  // 动态导入WebAV动画管理器
  const { updateWebAVAnimation } = await import('./webavAnimationManager')

  // 动态导入WebAV控制器
  const { useWebAVControls } = await import('../composables/useWebAVControls')
  const webAVControls = useWebAVControls()

  return {
    timelineModule: {
      getTimelineItem: (id: string) => videoStore.getLocalTimelineItem(id),
    },
    webavAnimationManager: {
      updateWebAVAnimation: updateWebAVAnimation,
    },
    historyModule: {
      executeCommand: (command: any) => videoStore.executeCommand(command),
    },
    playbackControls: {
      seekTo: (frame: number) => webAVControls.seekTo(frame),
    },
  }
}

// ==================== 便捷函数 ====================

/**
 * 便捷函数：创建关键帧
 * 自动创建执行器并执行命令
 */
export async function createKeyframe(timelineItemId: string, frame: number): Promise<void> {
  const executor = await createKeyframeCommandExecutor()
  await createKeyframeWithCommand(timelineItemId, frame, executor)
}

/**
 * 便捷函数：删除关键帧
 * 自动创建执行器并执行命令
 */
export async function deleteKeyframe(timelineItemId: string, frame: number): Promise<void> {
  const executor = await createKeyframeCommandExecutor()
  await deleteKeyframeWithCommand(timelineItemId, frame, executor)
}

/**
 * 便捷函数：更新属性（智能处理关键帧）
 * 自动创建执行器并执行命令
 */
export async function updateProperty(
  timelineItemId: string,
  frame: number,
  property: string,
  value: any,
): Promise<void> {
  const executor = await createKeyframeCommandExecutor()
  await updatePropertyWithCommand(timelineItemId, frame, property, value, executor)
}

/**
 * 便捷函数：清除所有关键帧
 * 自动创建执行器并执行命令
 */
export async function clearAllKeyframes(timelineItemId: string): Promise<void> {
  const executor = await createKeyframeCommandExecutor()
  await clearAllKeyframesWithCommand(timelineItemId, executor)
}

/**
 * 便捷函数：切换关键帧
 * 自动创建执行器并执行命令
 */
export async function toggleKeyframe(timelineItemId: string, frame: number): Promise<void> {
  const executor = await createKeyframeCommandExecutor()
  await toggleKeyframeWithCommand(timelineItemId, frame, executor)
}

// ==================== 批量操作支持 ====================

/**
 * 智能批量关键帧命令
 * 在批量操作结束后智能选择播放头位置，避免频繁跳动
 */
class SmartBatchKeyframeCommand {
  public readonly id: string
  public readonly description: string
  private subCommands: any[] = []
  private playbackControls?: { seekTo: (frame: number) => void }

  constructor(
    description: string,
    commands: any[],
    playbackControls?: { seekTo: (frame: number) => void },
  ) {
    this.id = `smart_batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    this.description = description
    this.subCommands = [...commands]
    this.playbackControls = playbackControls
  }

  /**
   * 批量执行：依次执行所有子命令，但禁用子命令的播放头控制
   */
  async execute(): Promise<void> {
    // 临时禁用子命令的播放头控制
    const originalPlaybackControls = this.subCommands.map((cmd) => {
      const original = cmd.playbackControls
      cmd.playbackControls = undefined
      return original
    })

    try {
      // 执行所有子命令
      for (const command of this.subCommands) {
        await command.execute()
      }

      // 智能选择播放头位置
      this.smartSeekAfterBatch()
    } finally {
      // 恢复子命令的播放头控制
      this.subCommands.forEach((cmd, index) => {
        cmd.playbackControls = originalPlaybackControls[index]
      })
    }
  }

  /**
   * 批量撤销：逆序撤销所有子命令，但禁用子命令的播放头控制
   */
  async undo(): Promise<void> {
    // 临时禁用子命令的播放头控制
    const originalPlaybackControls = this.subCommands.map((cmd) => {
      const original = cmd.playbackControls
      cmd.playbackControls = undefined
      return original
    })

    try {
      // 逆序撤销所有子命令
      for (let i = this.subCommands.length - 1; i >= 0; i--) {
        await this.subCommands[i].undo()
      }

      // 智能选择播放头位置
      this.smartSeekAfterBatch()
    } finally {
      // 恢复子命令的播放头控制
      this.subCommands.forEach((cmd, index) => {
        cmd.playbackControls = originalPlaybackControls[index]
      })
    }
  }

  /**
   * 智能选择播放头位置
   * 根据批量操作的类型和涉及的帧位置选择最合适的播放头位置
   */
  private smartSeekAfterBatch(): void {
    if (!this.playbackControls) return

    // 收集所有涉及的帧位置
    const frames: number[] = []
    for (const cmd of this.subCommands) {
      if (cmd.frame !== undefined) {
        frames.push(cmd.frame)
      }
    }

    if (frames.length === 0) return

    // 选择策略：跳转到最后一个操作的帧位置
    // 这样用户可以看到最后一个操作的效果
    const targetFrame = frames[frames.length - 1]
    this.playbackControls.seekTo(targetFrame)

    console.log('🎯 智能批量操作播放头控制:', {
      totalOperations: this.subCommands.length,
      involvedFrames: frames,
      targetFrame,
    })
  }
}

/**
 * 执行批量关键帧操作
 * @param operations 操作列表
 */
export async function executeBatchKeyframeOperations(
  operations: BatchKeyframeOperation[],
): Promise<void> {
  const executor = await createKeyframeCommandExecutor()

  // 创建子命令，但不传递播放头控制器（由批量命令统一管理）
  const commands = []

  for (const op of operations) {
    switch (op.type) {
      case 'create':
        if (op.frame !== undefined) {
          commands.push(
            new CreateKeyframeCommand(
              op.timelineItemId,
              op.frame,
              executor.timelineModule,
              executor.webavAnimationManager,
              executor.playbackControls, // 这里传递，但会在批量执行时临时禁用
            ),
          )
        }
        break
      case 'delete':
        if (op.frame !== undefined) {
          commands.push(
            new DeleteKeyframeCommand(
              op.timelineItemId,
              op.frame,
              executor.timelineModule,
              executor.webavAnimationManager,
              executor.playbackControls,
            ),
          )
        }
        break
      case 'update':
        if (op.frame !== undefined && op.property && op.value !== undefined) {
          commands.push(
            new UpdatePropertyCommand(
              op.timelineItemId,
              op.frame,
              op.property,
              op.value,
              executor.timelineModule,
              executor.webavAnimationManager,
              executor.playbackControls,
            ),
          )
        }
        break
      case 'clear':
        commands.push(
          new ClearAllKeyframesCommand(
            op.timelineItemId,
            executor.timelineModule,
            executor.webavAnimationManager,
            executor.playbackControls,
          ),
        )
        break
      case 'toggle':
        if (op.frame !== undefined) {
          commands.push(
            new ToggleKeyframeCommand(
              op.timelineItemId,
              op.frame,
              executor.timelineModule,
              executor.webavAnimationManager,
              executor.playbackControls,
            ),
          )
        }
        break
    }
  }

  if (commands.length > 0) {
    const batchCommand = new SmartBatchKeyframeCommand(
      '批量关键帧操作',
      commands,
      executor.playbackControls,
    )
    await executor.historyModule.executeCommand(batchCommand)
  }
}
