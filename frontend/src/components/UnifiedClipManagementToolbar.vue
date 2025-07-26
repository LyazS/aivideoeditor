<template>
  <!-- 工具栏 -->
  <div class="clip-management-toolbar">
    <!-- 历史管理工具栏 -->
    

    <!-- 调试按钮放在最右边 -->
    <div class="toolbar-section debug-section">
      <HoverButton @click="debugTimeline" title="在控制台打印时间轴配置信息">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"
            />
          </svg>
        </template>
        调试
      </HoverButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUnifiedStore } from '@/stores/unifiedStore'
import HoverButton from '@/components/HoverButton.vue'

// 获取统一存储
const unifiedStore = useUnifiedStore()

/**
 * 调试时间轴方法 - 打印时间轴项目的详细信息
 */
function debugTimeline() {
  console.group('🔍 [调试] 时间轴项目信息')

  try {
    // 获取时间轴项目列表
    const timelineItems = unifiedStore.timelineItems
    const tracks = unifiedStore.tracks
    const mediaItems = unifiedStore.mediaItems

    console.log('📊 总体统计:')
    console.log(`  - 时间轴项目数量: ${timelineItems.length}`)
    console.log(`  - 轨道数量: ${tracks.length}`)
    console.log(`  - 媒体项目数量: ${mediaItems.length}`)

    // 打印轨道信息
    console.group('🎬 轨道信息:')
    tracks.forEach((track, index) => {
      console.log(`轨道 ${index + 1}:`, {
        id: track.id,
        name: track.name,
        type: track.type,
        status: track.status,
        isVisible: track.isVisible,
        isMuted: track.isMuted,
        height: track.height,
        order: track.order,
        color: track.color,
        description: track.description,
        createdAt: track.createdAt,
        updatedAt: track.updatedAt
      })
    })
    console.groupEnd()

    // 打印时间轴项目详细信息
    console.group('📽️ 时间轴项目详细信息:')
    timelineItems.forEach((item, index) => {
      console.group(`项目 ${index + 1}: ${item.config.name}`)

      // 基础信息
      console.log('基础信息:', {
        id: item.id,
        mediaItemId: item.mediaItemId,
        trackId: item.trackId,
        mediaType: item.mediaType,
        timelineStatus: item.timelineStatus
      })

      // 时间范围
      console.log('时间范围:', {
        timelineStartTime: item.timeRange.timelineStartTime,
        timelineEndTime: item.timeRange.timelineEndTime,
        duration: item.timeRange.timelineEndTime - item.timeRange.timelineStartTime
      })

      // 配置信息
      console.log('配置信息:', {
        name: item.config.name,
        mediaConfig: item.config.mediaConfig,
        animation: item.config.animation
      })

      // 状态上下文
      if (item.statusContext) {
        console.log('状态上下文:', item.statusContext)
      }

      // 精灵对象信息
      if (item.sprite) {
        console.log('精灵对象:', {
          type: item.sprite.constructor.name,
          visible: 'visible' in item.sprite ? item.sprite.visible : 'N/A',
          opacity: 'opacity' in item.sprite ? item.sprite.opacity : 'N/A',
          zIndex: 'zIndex' in item.sprite ? item.sprite.zIndex : 'N/A'
        })
      } else {
        console.log('精灵对象: 未创建')
      }

      // 关联的媒体项目信息
      const relatedMediaItem = mediaItems.find(media => media.id === item.mediaItemId)
      if (relatedMediaItem) {
        console.log('关联媒体项目:', {
          id: relatedMediaItem.id,
          name: relatedMediaItem.name,
          mediaStatus: relatedMediaItem.mediaStatus,
          mediaType: relatedMediaItem.mediaType,
          sourceType: relatedMediaItem.source?.type || 'unknown',
          sourceStatus: relatedMediaItem.source?.status || 'unknown',
          sourceProgress: relatedMediaItem.source?.progress || 0,
          webavObjects: {
            hasMP4Clip: !!relatedMediaItem.webav?.mp4Clip,
            hasImgClip: !!relatedMediaItem.webav?.imgClip,
            hasAudioClip: !!relatedMediaItem.webav?.audioClip,
            thumbnailUrl: relatedMediaItem.webav?.thumbnailUrl,
            originalWidth: relatedMediaItem.webav?.originalWidth,
            originalHeight: relatedMediaItem.webav?.originalHeight
          },
          duration: relatedMediaItem.duration,
          createdAt: relatedMediaItem.createdAt
        })
      } else {
        console.warn('⚠️ 未找到关联的媒体项目:', item.mediaItemId)
      }

      // 关联的轨道信息
      const relatedTrack = tracks.find(track => track.id === item.trackId)
      if (relatedTrack) {
        console.log('关联轨道:', {
          id: relatedTrack.id,
          name: relatedTrack.name,
          type: relatedTrack.type,
          status: relatedTrack.status,
          isVisible: relatedTrack.isVisible,
          isMuted: relatedTrack.isMuted
        })
      } else if (item.trackId) {
        console.warn('⚠️ 未找到关联的轨道:', item.trackId)
      } else {
        console.log('关联轨道: 未分配')
      }

      console.groupEnd()
    })
    console.groupEnd()

    // 打印项目配置信息
    console.group('⚙️ 项目配置信息:')
    console.log('当前项目:', {
      id: unifiedStore.currentProjectId,
      name: unifiedStore.currentProjectName,
      status: unifiedStore.projectStatus,
      hasProject: unifiedStore.hasCurrentProject,
      isSaving: unifiedStore.isSaving,
      isLoading: unifiedStore.isLoading,
      lastSaved: unifiedStore.lastSaved
    })
    console.log('播放配置:', {
      currentFrame: unifiedStore.currentFrame,
      isPlaying: unifiedStore.isPlaying,
      playbackRate: unifiedStore.playbackRate,
      formattedCurrentTime: unifiedStore.formattedCurrentTime,
      playbackRateText: unifiedStore.playbackRateText
    })
    console.log('视频配置:', {
      videoResolution: unifiedStore.videoResolution,
      frameRate: unifiedStore.frameRate,
      timelineDurationFrames: unifiedStore.timelineDurationFrames,
      proportionalScale: unifiedStore.proportionalScale
    })
    console.log('WebAV状态:', {
      isWebAVReady: unifiedStore.isWebAVReady,
      webAVError: unifiedStore.webAVError,
      hasAVCanvas: !!unifiedStore.avCanvas
    })
    console.groupEnd()

    // 统计信息
    console.group('📈 统计分析:')
    const statusStats = timelineItems.reduce((stats, item) => {
      stats[item.timelineStatus] = (stats[item.timelineStatus] || 0) + 1
      return stats
    }, {} as Record<string, number>)

    const typeStats = timelineItems.reduce((stats, item) => {
      stats[item.mediaType] = (stats[item.mediaType] || 0) + 1
      return stats
    }, {} as Record<string, number>)

    console.log('状态分布:', statusStats)
    console.log('类型分布:', typeStats)

    const trackAssignments = timelineItems.reduce((assignments, item) => {
      const trackName = item.trackId ?
        (tracks.find(t => t.id === item.trackId)?.name || `未知轨道(${item.trackId})`) :
        '未分配'
      assignments[trackName] = (assignments[trackName] || 0) + 1
      return assignments
    }, {} as Record<string, number>)

    console.log('轨道分配:', trackAssignments)
    console.groupEnd()

  } catch (error) {
    console.error('❌ 调试时间轴时发生错误:', error)
  }

  console.groupEnd()
}
</script>

<style scoped>
.clip-management-toolbar {
  background-color: #333;
  padding: 8px 12px;
  border-bottom: 1px solid #444;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  border-radius: 4px 4px 0 0;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.debug-section {
  margin-left: auto;
}

.toolbar-label {
  font-size: 12px;
  color: #ccc;
  font-weight: 500;
}

.toolbar-btn {
  background-color: #555;
  color: #ccc;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s;
}

.toolbar-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn.debug-btn {
  background-color: #6c757d;
  border: 1px dashed #adb5bd;
}

.toolbar-btn.debug-btn:hover {
  background-color: #5a6268;
  border-color: #6c757d;
}

.toolbar-btn.split-btn {
  background-color: #555;
  color: #ccc;
}

.toolbar-btn.split-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn.delete-btn {
  background-color: #dc3545;
  color: white;
}

.toolbar-btn.delete-btn:hover {
  background-color: #c82333;
  color: white;
}

.toolbar-btn.undo-btn {
  background-color: #555;
  color: #ccc;
}

.toolbar-btn.undo-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn.redo-btn {
  background-color: #555;
  color: #ccc;
}

.toolbar-btn.redo-btn:hover {
  background-color: #666;
  color: white;
}

.toolbar-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.toolbar-btn:disabled:hover {
  background-color: #6c757d;
}

.toolbar-btn svg {
  width: 14px;
  height: 14px;
}

.overlap-warning {
  color: #ff6b6b;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

.split-hint {
  color: #ffd700;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
