/**
 * 添加轨道命令
 * 支持添加轨道的撤销/重做操作
 * 采用简单的添加/删除逻辑，不涉及WebAV对象重建
 */

import { generateCommandId } from '../../../utils/idGenerator'
import { ref, type Ref } from 'vue'
import type { SimpleCommand } from './types'

// ==================== 新架构类型导入 ====================
import type { UnifiedTrackData, UnifiedTrackType } from '../../track/TrackTypes'
import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData'
import type { MediaType, MediaTypeOrUnknown } from '../../mediaitem/types'

/**
 * 添加轨道命令
 * 支持添加轨道的撤销/重做操作
 * 采用简单的添加/删除逻辑，不涉及WebAV对象重建
 */
export class AddTrackCommand implements SimpleCommand {
  public readonly id: string
  public readonly description: string
  private newTrackId: string | undefined = undefined // 新创建的轨道ID
  private trackData: UnifiedTrackData // 保存轨道数据

  constructor(
    private trackType: UnifiedTrackType, // 轨道类型
    private trackName: string | undefined, // 轨道名称（可选）
    private position: number | undefined, // 插入位置（可选）
    private trackModule: {
      addTrack: (
        type: UnifiedTrackType,
        name?: string,
        position?: number,
        id?: string,
      ) => UnifiedTrackData
      removeTrack: (
        trackId: string,
        timelineItems: Ref<UnifiedTimelineItemData<MediaType>[]>,
        removeTimelineItemCallback?: (id: string) => void,
      ) => void
      getTrack: (trackId: string) => UnifiedTrackData | undefined
    },
  ) {
    this.id = generateCommandId()
    this.description = `添加轨道: ${trackName || `${trackType}轨道`}${position !== undefined ? ` (位置: ${position})` : ''}`

    // 预先计算新轨道ID（模拟trackModule的逻辑）
    // 注意：这里我们无法直接访问tracks数组，所以在execute时会获取实际的轨道数据
    this.newTrackId = undefined // 将在execute时设置
    this.trackData = {
      id: '',
      name: '',
      type: trackType,
      isVisible: true,
      isMuted: false,
      height: 80,
    }
  }

  /**
   * 执行命令：添加轨道
   */
  async execute(): Promise<void> {
    try {
      console.log(`🔄 执行添加轨道操作...`)

      // 调用trackModule的addTrack方法，传入位置参数
      const newTrack = this.trackModule.addTrack(
        this.trackType,
        this.trackName,
        this.position,
        this.newTrackId,
      )

      // 保存轨道数据用于撤销
      this.newTrackId = newTrack.id
      this.trackData = { ...newTrack }

      console.log(
        `✅ 已添加轨道: ${newTrack.name} (ID: ${newTrack.id}, 类型: ${newTrack.type}, 位置: ${this.position ?? '末尾'})`,
      )
    } catch (error) {
      console.error(`❌ 添加轨道失败: ${this.trackName || `${this.trackType}轨道`}`, error)
      throw error
    }
  }

  /**
   * 撤销命令：删除添加的轨道
   */
  async undo(): Promise<void> {
    try {
      console.log(`🔄 撤销添加轨道操作：删除轨道 ${this.trackData.name}...`)

      // 删除添加的轨道
      // 注意：这里传入空的timelineItems和回调，因为新添加的轨道上不应该有任何项目
      if (this.newTrackId) {
        this.trackModule.removeTrack(this.newTrackId, ref([]), undefined)
        console.log(`↩️ 已撤销添加轨道: ${this.trackData.name}`)
      } else {
        throw new Error(`无法撤销添加轨道操作：轨道ID不存在 (轨道名称: ${this.trackData.name})`)
      }
    } catch (error) {
      console.error(`❌ 撤销添加轨道失败: ${this.trackData.name}`, error)
      throw error
    }
  }
}
