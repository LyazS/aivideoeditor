/**
 * 操作系统测试文件
 * 用于验证新的操作系统功能
 */

import { createOperationSystem } from '../index'
import type { TimelineItemData, TransformData } from '../context'

/**
 * 模拟模块数据
 */
function createMockModules() {
  const mockTimelineItems = new Map()
  const mockTracks = new Map()
  const mockMediaItems = new Map()
  const mockSprites = new Set()

  return {
    timelineModule: {
      addTimelineItem: (item: any) => {
        mockTimelineItems.set(item.id, item)
        console.log('Mock: 添加时间轴项目', item.id)
      },
      removeTimelineItem: (itemId: string) => {
        mockTimelineItems.delete(itemId)
        console.log('Mock: 删除时间轴项目', itemId)
      },
      getTimelineItem: (itemId: string) => {
        return mockTimelineItems.get(itemId)
      },
      timelineItems: { value: Array.from(mockTimelineItems.values()) },
      setupBidirectionalSync: (item: any) => {
        console.log('Mock: 设置双向同步', item.id)
      }
    },

    webavModule: {
      addSprite: (sprite: any) => {
        mockSprites.add(sprite)
        console.log('Mock: 添加sprite到画布')
        return true
      },
      removeSprite: (sprite: any) => {
        mockSprites.delete(sprite)
        console.log('Mock: 从画布移除sprite')
        return true
      },
      avCanvas: { value: { /* mock canvas */ } }
    },

    trackModule: {
      addTrack: (name?: string) => {
        const id = Date.now()
        const track = { id, name: name || `轨道 ${id}`, isVisible: true, isMuted: false }
        mockTracks.set(id, track)
        console.log('Mock: 添加轨道', track)
        return track
      },
      removeTrack: (trackId: number) => {
        mockTracks.delete(trackId)
        console.log('Mock: 删除轨道', trackId)
      },
      getTrack: (trackId: number) => {
        return mockTracks.get(trackId)
      },
      tracks: { value: Array.from(mockTracks.values()) },
      renameTrack: (trackId: number, newName: string) => {
        const track = mockTracks.get(trackId)
        if (track) {
          track.name = newName
          console.log('Mock: 重命名轨道', trackId, newName)
        }
      }
    },

    mediaModule: {
      getMediaItem: (mediaItemId: string) => {
        return mockMediaItems.get(mediaItemId)
      },
      addMediaItem: (item: any) => {
        mockMediaItems.set(item.id, item)
        console.log('Mock: 添加媒体项目', item.id)
      },
      removeMediaItem: (mediaItemId: string) => {
        mockMediaItems.delete(mediaItemId)
        console.log('Mock: 删除媒体项目', mediaItemId)
      },
      mediaItems: { value: Array.from(mockMediaItems.values()) }
    }
  }
}

/**
 * 创建测试用的媒体项目
 */
function createTestMediaItem(id: string, type: 'video' | 'image') {
  return {
    id,
    name: `测试${type}`,
    mediaType: type,
    isReady: true,
    mp4Clip: type === 'video' ? { /* mock MP4Clip */ } : null,
    imgClip: type === 'image' ? { /* mock ImgClip */ } : null,
    duration: type === 'video' ? 10 : undefined,
    thumbnailUrl: 'mock-thumbnail.jpg'
  }
}

/**
 * 创建测试用的时间轴项目数据
 */
function createTestTimelineItemData(id: string, mediaItemId: string, trackId: number): TimelineItemData {
  return {
    id,
    mediaItemId,
    trackId,
    mediaType: 'video',
    timeRange: {
      timelineStartTime: 0,
      timelineEndTime: 10000000 // 10秒，以微秒为单位
    },
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    volume: 1.0,
    isMuted: false
  }
}

/**
 * 运行操作系统测试
 */
export async function runOperationSystemTest(): Promise<void> {
  console.log('🧪 开始操作系统测试...')

  try {
    // 1. 创建模拟模块
    const mockModules = createMockModules()

    // 2. 创建操作系统
    const operationSystem = createOperationSystem(mockModules)
    const systemManager = await operationSystem.initialize()

    console.log('✅ 操作系统创建成功')

    // 3. 准备测试数据
    const mediaItem = createTestMediaItem('media_1', 'video')
    mockModules.mediaModule.addMediaItem(mediaItem)

    const track = mockModules.trackModule.addTrack('测试轨道')
    const timelineItemData = createTestTimelineItemData('item_1', 'media_1', track.id)

    // 4. 测试基础操作
    console.log('\n📝 测试基础操作...')

    // 测试添加时间轴项目
    console.log('测试：添加时间轴项目')
    const addResult = await systemManager.addTimelineItem(timelineItemData)
    console.log('添加结果:', addResult.success ? '成功' : '失败', addResult.error || '')

    // 测试撤销
    console.log('\n测试：撤销操作')
    const undoResult = await systemManager.undo()
    console.log('撤销结果:', undoResult?.success ? '成功' : '失败')

    // 测试重做
    console.log('\n测试：重做操作')
    const redoResult = await systemManager.redo()
    console.log('重做结果:', redoResult?.success ? '成功' : '失败')

    // 5. 测试复合操作
    console.log('\n📝 测试复合操作...')

    // 添加更多项目用于测试
    const timelineItemData2 = createTestTimelineItemData('item_2', 'media_1', track.id)
    timelineItemData2.timeRange.timelineStartTime = 5000000 // 5秒开始
    timelineItemData2.timeRange.timelineEndTime = 15000000 // 15秒结束

    await systemManager.addTimelineItem(timelineItemData2)

    // 测试自动排列
    console.log('测试：自动排列轨道')
    const autoArrangeResult = await systemManager.autoArrange(track.id)
    console.log('自动排列结果:', autoArrangeResult.success ? '成功' : '失败')

    // 6. 测试变换操作
    console.log('\n📝 测试变换操作...')

    const oldTransform: TransformData = {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      opacity: 1
    }

    const newTransform: TransformData = {
      position: { x: 100, y: 50 },
      size: { width: 1280, height: 720 },
      opacity: 0.8
    }

    const transformResult = await systemManager.transformTimelineItem('item_1', oldTransform, newTransform)
    console.log('变换结果:', transformResult.success ? '成功' : '失败')

    // 7. 测试系统状态
    console.log('\n📊 系统状态报告:')
    const systemStatus = systemManager.getSystemStatus()
    console.log('系统状态:', JSON.stringify(systemStatus, null, 2))

    // 8. 测试性能报告
    console.log('\n📈 性能报告:')
    const performanceReport = systemManager.getPerformanceReport()
    console.log('性能报告:', JSON.stringify(performanceReport, null, 2))

    console.log('\n🎉 操作系统测试完成！')

  } catch (error) {
    console.error('❌ 操作系统测试失败:', error)
    throw error
  }
}

/**
 * 运行压力测试
 */
export async function runStressTest(): Promise<void> {
  console.log('🔥 开始压力测试...')

  try {
    const mockModules = createMockModules()
    const operationSystem = createOperationSystem(mockModules)
    const systemManager = await operationSystem.initialize()

    // 创建大量操作
    const operations = []
    for (let i = 0; i < 100; i++) {
      const mediaItem = createTestMediaItem(`media_${i}`, i % 2 === 0 ? 'video' : 'image')
      mockModules.mediaModule.addMediaItem(mediaItem)

      const track = mockModules.trackModule.addTrack(`轨道 ${i}`)
      const timelineItemData = createTestTimelineItemData(`item_${i}`, `media_${i}`, track.id)
      
      operations.push(systemManager.factory.createTimelineItemAdd(timelineItemData))
    }

    console.log(`创建了 ${operations.length} 个操作`)

    // 批量执行
    const startTime = performance.now()
    const batchResult = await systemManager.executeBatch(operations, 'sequential')
    const endTime = performance.now()

    console.log('批量执行结果:', batchResult.success ? '成功' : '失败')
    console.log(`执行时间: ${(endTime - startTime).toFixed(2)}ms`)
    console.log(`平均每个操作: ${((endTime - startTime) / operations.length).toFixed(2)}ms`)

    // 测试大量撤销
    console.log('\n测试大量撤销...')
    const undoStartTime = performance.now()
    let undoCount = 0
    while (systemManager.history.canUndo.value && undoCount < 50) {
      await systemManager.undo()
      undoCount++
    }
    const undoEndTime = performance.now()

    console.log(`撤销了 ${undoCount} 个操作`)
    console.log(`撤销时间: ${(undoEndTime - undoStartTime).toFixed(2)}ms`)

    console.log('\n🎉 压力测试完成！')

  } catch (error) {
    console.error('❌ 压力测试失败:', error)
    throw error
  }
}

/**
 * 在浏览器控制台中运行测试
 */
if (typeof window !== 'undefined') {
  (window as any).runOperationSystemTest = runOperationSystemTest
  (window as any).runStressTest = runStressTest
  console.log('🧪 测试函数已添加到全局作用域:')
  console.log('- runOperationSystemTest(): 运行基础功能测试')
  console.log('- runStressTest(): 运行压力测试')
}
