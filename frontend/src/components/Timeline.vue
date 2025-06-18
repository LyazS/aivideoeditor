<template>
  <div class="timeline">
    <!-- 顶部区域：轨道管理器头部 + 时间刻度 -->
    <div class="timeline-header">
      <div class="track-manager-header">
        <h3>轨道</h3>
        <button class="add-track-btn" @click="addNewTrack" title="添加新轨道">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
          </svg>
        </button>
      </div>
      <div class="timeline-scale">
        <TimeScale />
      </div>
    </div>

    <!-- 主体区域：每个轨道一行，包含左侧控制和右侧内容 -->
    <div class="timeline-body" ref="timelineBody">
      <!-- 每个轨道一行 -->
      <div
        v-for="track in tracks"
        :key="track.id"
        class="track-row"
        :style="{ height: track.height + 'px' }"
      >
        <!-- 左侧轨道控制 -->
        <div class="track-controls">
          <!-- 轨道名称 -->
          <div class="track-name">
            <input
              v-if="editingTrackId === track.id"
              v-model="editingTrackName"
              @blur="finishRename"
              @keyup.enter="finishRename"
              @keyup.escape="cancelRename"
              class="track-name-input"
              :ref="
                (el) => {
                  /* @ts-ignore */
                  if (editingTrackId === track.id) nameInput = el as HTMLInputElement
                }
              "
            />
            <span
              v-else
              @dblclick="startRename(track)"
              class="track-name-text"
              :title="'双击编辑轨道名称'"
            >
              {{ track.name }}
            </span>
          </div>

          <!-- 控制按钮 -->
          <div class="track-buttons">
            <!-- 自动排列轨道片段 -->
            <button
              class="track-btn arrange-btn"
              :disabled="getClipsForTrack(track.id).length === 0"
              @click="autoArrangeTrack(track.id)"
              :title="
                getClipsForTrack(track.id).length === 0 ? '该轨道没有片段' : '自动排列该轨道的片段'
              "
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z"
                />
              </svg>
            </button>

            <!-- 可见性切换 -->
            <button
              class="track-btn"
              :class="{ active: track.isVisible }"
              @click="toggleVisibility(track.id)"
              :title="track.isVisible ? '隐藏轨道' : '显示轨道'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  v-if="track.isVisible"
                  d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"
                />
                <path
                  v-else
                  d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.09L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.76,7.13 11.37,7 12,7Z"
                />
              </svg>
            </button>

            <!-- 静音切换 -->
            <button
              class="track-btn"
              :class="{ active: !track.isMuted }"
              @click="toggleMute(track.id)"
              :title="track.isMuted ? '取消静音' : '静音'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  v-if="!track.isMuted"
                  d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"
                />
                <path
                  v-else
                  d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z"
                />
              </svg>
            </button>

            <!-- 删除轨道 -->
            <button
              v-if="tracks.length > 1"
              class="track-btn delete-btn"
              @click="removeTrack(track.id)"
              title="删除轨道"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- 右侧轨道内容区域 -->
        <div
          class="track-content"
          :class="{ 'track-hidden': !track.isVisible }"
          :data-track-id="track.id"
          @dragover="handleDragOver"
          @drop="handleDrop"
          @click="handleTimelineClick"
          @wheel="handleWheel"
        >
          <!-- 该轨道的时间轴项目 -->
          <VideoClip
            v-for="item in getClipsForTrack(track.id)"
            :key="item.id"
            :timeline-item="item"
            :track="track"
            :timeline-width="timelineWidth"
            :total-duration="videoStore.totalDuration"
            @update-position="handleTimelineItemPositionUpdate"
            @remove="handleTimelineItemRemove"
          />
        </div>
      </div>

      <!-- 时间轴背景网格 -->
      <div class="timeline-grid">
        <div
          v-for="line in gridLines"
          :key="line.time"
          class="grid-line"
          :class="{ 'frame-line': line.isFrame }"
          :style="{ left: 200 + videoStore.timeToPixel(line.time, timelineWidth) + 'px' }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, markRaw, reactive } from 'vue'
import { useVideoStore } from '../stores/videoStore'
import { useWebAVControls, waitForWebAVReady, isWebAVReady } from '../composables/useWebAVControls'
import { VideoVisibleSprite } from '../utils/VideoVisibleSprite'
import { ImageVisibleSprite } from '../utils/ImageVisibleSprite'
import { webavToProjectCoords } from '../utils/coordinateTransform'
import {
  generateVideoThumbnail,
  generateImageThumbnail,
  canvasToBlob,
} from '../utils/thumbnailGenerator'
import type { TimelineItem } from '../types/videoTypes'
import VideoClip from './VideoClip.vue'
import TimeScale from './TimeScale.vue'

// Component name for Vue DevTools
defineOptions({
  name: 'TimelineEditor',
})

const videoStore = useVideoStore()
const webAVControls = useWebAVControls()

const timelineBody = ref<HTMLElement>()
const timelineWidth = ref(800)

const tracks = computed(() => videoStore.tracks)

// 编辑轨道名称相关
const editingTrackId = ref<number | null>(null)
const editingTrackName = ref('')
let nameInput: HTMLInputElement | null = null

// 获取指定轨道的时间轴项目
function getClipsForTrack(trackId: number) {
  return videoStore.getTimelineItemsForTrack(trackId)
}

// 轨道管理方法
async function addNewTrack() {
  try {
    const newTrackId = await videoStore.addTrackWithHistory()
    if (newTrackId) {
      console.log('✅ 轨道添加成功，新轨道ID:', newTrackId)
    } else {
      console.error('❌ 轨道添加失败')
    }
  } catch (error) {
    console.error('❌ 添加轨道时出错:', error)
  }
}

async function removeTrack(trackId: number) {
  if (tracks.value.length <= 1) {
    alert('至少需要保留一个轨道')
    return
  }

  if (confirm('确定要删除这个轨道吗？轨道上的所有片段也将被删除。')) {
    try {
      const success = await videoStore.removeTrackWithHistory(trackId)
      if (success) {
        console.log('✅ 轨道删除成功')
      } else {
        console.error('❌ 轨道删除失败')
      }
    } catch (error) {
      console.error('❌ 删除轨道时出错:', error)
    }
  }
}

async function toggleVisibility(trackId: number) {
  try {
    const success = await videoStore.toggleTrackVisibilityWithHistory(trackId)
    if (success) {
      console.log('✅ 轨道可见性切换成功')
    } else {
      console.error('❌ 轨道可见性切换失败')
    }
  } catch (error) {
    console.error('❌ 切换轨道可见性时出错:', error)
  }
}

async function toggleMute(trackId: number) {
  try {
    const success = await videoStore.toggleTrackMuteWithHistory(trackId)
    if (success) {
      console.log('✅ 轨道静音状态切换成功')
    } else {
      console.error('❌ 轨道静音状态切换失败')
    }
  } catch (error) {
    console.error('❌ 切换轨道静音状态时出错:', error)
  }
}

async function autoArrangeTrack(trackId: number) {
  try {
    const success = await videoStore.autoArrangeTrackWithHistory(trackId)
    if (success) {
      console.log('✅ 轨道自动排列成功')
    } else {
      console.error('❌ 轨道自动排列失败')
    }
  } catch (error) {
    console.error('❌ 自动排列轨道时出错:', error)
  }
}

async function startRename(track: { id: number; name: string }) {
  editingTrackId.value = track.id
  editingTrackName.value = track.name
  await nextTick()
  nameInput?.focus()
  nameInput?.select()
}

async function finishRename() {
  if (editingTrackId.value && editingTrackName.value.trim()) {
    try {
      const success = await videoStore.renameTrackWithHistory(
        editingTrackId.value,
        editingTrackName.value.trim(),
      )
      if (success) {
        console.log('✅ 轨道重命名成功')
      } else {
        console.error('❌ 轨道重命名失败')
      }
    } catch (error) {
      console.error('❌ 重命名轨道时出错:', error)
    }
  }
  editingTrackId.value = null
  editingTrackName.value = ''
}

function cancelRename() {
  editingTrackId.value = null
  editingTrackName.value = ''
}

// 网格线
const gridLines = computed(() => {
  const lines = []
  const pixelsPerSecond = (timelineWidth.value * videoStore.zoomLevel) / videoStore.totalDuration

  // 根据缩放级别决定网格间隔
  let interval = 5 // 默认每5秒一条网格线
  let frameInterval = 0 // 帧间隔
  let isFrameLevel = false

  if (pixelsPerSecond >= 100) {
    // 降低帧级别的阈值
    interval = 1 // 高缩放：每秒一条线
    frameInterval = 1 / videoStore.frameRate // 同时显示帧级别的线
    isFrameLevel = true
  } else if (pixelsPerSecond >= 50) {
    interval = 2 // 中等缩放：每2秒一条线
  } else if (pixelsPerSecond >= 50) {
    interval = 5 // 正常缩放：每5秒一条线
  } else {
    interval = 10 // 低缩放：每10秒一条线
  }

  // 计算可见时间范围
  const startTime = videoStore.scrollOffset / pixelsPerSecond
  const endTime = startTime + timelineWidth.value / pixelsPerSecond

  // 生成主网格线（秒级别）
  const startLine = Math.floor(startTime / interval) * interval
  const endLine = Math.ceil(endTime / interval) * interval

  for (let i = startLine; i <= Math.min(endLine, videoStore.totalDuration); i += interval) {
    if (i >= 0) {
      lines.push({ time: i, isFrame: false })
    }
  }

  // 在帧级别缩放时，添加帧网格线
  if (isFrameLevel && frameInterval > 0) {
    const frameStartTime = Math.floor(startTime / frameInterval) * frameInterval
    const frameEndTime = Math.ceil(endTime / frameInterval) * frameInterval

    for (
      let i = frameStartTime;
      i <= Math.min(frameEndTime, videoStore.totalDuration);
      i += frameInterval
    ) {
      if (i >= 0 && Math.abs(i % interval) > 0.001) {
        // 避免与主网格线重复
        lines.push({ time: i, isFrame: true })
      }
    }
  }

  return lines.sort((a, b) => a.time - b.time)
})

function updateTimelineWidth() {
  if (timelineBody.value) {
    // 计算轨道内容区域的宽度（总宽度减去轨道控制区域的200px）
    timelineWidth.value = timelineBody.value.clientWidth - 200
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()

  // 检查拖拽数据类型
  const types = event.dataTransfer?.types || []
  if (types.includes('application/media-item')) {
    event.dataTransfer!.dropEffect = 'copy'
  } else if (types.includes('Files')) {
    // 文件拖拽，但我们不再支持直接文件拖拽
    event.dataTransfer!.dropEffect = 'none'
  } else {
    event.dataTransfer!.dropEffect = 'copy'
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  console.log('时间轴接收到拖拽事件')

  // 暂停播放以便进行编辑
  if (isWebAVReady() && videoStore.isPlaying) {
    webAVControls.pause()
  }

  // 检查是否是从素材库拖拽的素材
  const mediaItemData = event.dataTransfer?.getData('application/media-item')
  console.log('拖拽数据:', mediaItemData)

  if (mediaItemData) {
    // 处理素材库拖拽
    try {
      const mediaItem = JSON.parse(mediaItemData)
      console.log('解析的素材数据:', mediaItem)

      // 获取目标轨道ID
      const targetElement = event.target as HTMLElement
      const trackContent = targetElement.closest('.track-content')
      const targetTrackId = trackContent
        ? parseInt(trackContent.getAttribute('data-track-id') || '1')
        : 1
      console.log('目标轨道ID:', targetTrackId)

      // 计算拖拽位置对应的时间（考虑缩放和滚动偏移量）
      const trackContentRect = trackContent?.getBoundingClientRect()
      if (!trackContentRect) {
        console.error('无法获取轨道区域信息')
        return
      }

      const dropX = event.clientX - trackContentRect.left
      const dropTime = videoStore.pixelToTime(dropX, timelineWidth.value)
      console.log(`🎯 拖拽素材到时间轴: ${mediaItem.name}`)
      console.log(
        `📍 拖拽位置: ${dropX}px, 对应时间: ${dropTime.toFixed(2)}s, 目标轨道: ${targetTrackId}`,
      )

      // 如果拖拽位置超出当前时间轴长度，动态扩展时间轴
      videoStore.expandTimelineIfNeeded(dropTime + 10) // 预留10秒缓冲

      // 从素材库项创建媒体片段（视频或图片）
      await createMediaClipFromMediaItem(mediaItem, dropTime, targetTrackId)
    } catch (error) {
      console.error('Failed to parse media item data:', error)
      alert('拖拽数据格式错误')
    }
  } else {
    console.log('没有检测到素材库拖拽数据')
    // 不再支持直接拖拽文件
    alert('请先将视频或图片文件导入到素材库，然后从素材库拖拽到时间轴')
  }
}

// 从素材库项创建时间轴项目
async function createMediaClipFromMediaItem(
  mediaItem: {
    id: string
    url: string
    name: string
    duration: number
    mediaType: 'video' | 'image'
    fileInfo: {
      name: string
      type: string
      lastModified: number
    }
  },
  startTime: number,
  trackId: number = 1,
): Promise<void> {
  console.log('创建时间轴项目从素材库:', mediaItem)

  try {
    // 等待WebAV初始化完成
    console.log('等待WebAV初始化完成...')
    const isReady = await waitForWebAVReady(10000) // 等待最多10秒
    if (!isReady) {
      throw new Error('WebAV初始化超时，请稍后重试')
    }

    // 获取对应的MediaItem
    const storeMediaItem = videoStore.getMediaItem(mediaItem.id)
    if (!storeMediaItem) {
      throw new Error('找不到对应的素材项目')
    }

    // 检查素材是否已经解析完成
    if (!storeMediaItem.isReady) {
      throw new Error('素材还在解析中，请稍后再试')
    }

    let sprite: VideoVisibleSprite | ImageVisibleSprite

    if (mediaItem.mediaType === 'video') {
      // 处理视频
      if (!storeMediaItem.mp4Clip) {
        throw new Error('视频素材解析失败')
      }
      console.log('克隆MP4Clip并创建VideoVisibleSprite for mediaItem:', mediaItem.id)
      const clonedMP4Clip = await webAVControls.cloneMP4Clip(storeMediaItem.mp4Clip)
      sprite = new VideoVisibleSprite(clonedMP4Clip)
    } else if (mediaItem.mediaType === 'image') {
      // 处理图片
      if (!storeMediaItem.imgClip) {
        throw new Error('图片素材解析失败')
      }
      console.log('克隆ImgClip并创建ImageVisibleSprite for mediaItem:', mediaItem.id)
      const clonedImgClip = await webAVControls.cloneImgClip(storeMediaItem.imgClip)
      sprite = new ImageVisibleSprite(clonedImgClip)
    } else {
      throw new Error('不支持的媒体类型')
    }

    // 获取媒体的原始分辨率
    let originalResolution: { width: number; height: number }
    if (mediaItem.mediaType === 'video') {
      originalResolution = videoStore.getVideoOriginalResolution(mediaItem.id)
      console.log('视频原始分辨率:', originalResolution)
    } else {
      originalResolution = videoStore.getImageOriginalResolution(mediaItem.id)
      console.log('图片原始分辨率:', originalResolution)
    }

    // 设置初始尺寸为视频原始分辨率（缩放系数1.0）
    // sprite.rect.w/h 是在画布上的实际显示像素尺寸
    sprite.rect.w = originalResolution.width
    sprite.rect.h = originalResolution.height

    // 设置初始位置为画布中心
    // 使用WebAV坐标系（左上角原点），让视频居中显示
    const canvasWidth = videoStore.videoResolution.width
    const canvasHeight = videoStore.videoResolution.height
    sprite.rect.x = (canvasWidth - originalResolution.width) / 2
    sprite.rect.y = (canvasHeight - originalResolution.height) / 2

    console.log('初始化sprite尺寸和位置:', {
      原始分辨率: originalResolution,
      显示尺寸: { w: sprite.rect.w, h: sprite.rect.h },
      WebAV位置: { x: sprite.rect.x, y: sprite.rect.y },
      画布尺寸: { w: canvasWidth, h: canvasHeight },
    })

    // 设置时间范围 - 根据媒体类型使用不同的方法
    if (mediaItem.mediaType === 'video') {
      const timeRangeConfig = {
        clipStartTime: 0,
        clipEndTime: mediaItem.duration * 1000000, // 转换为微秒
        timelineStartTime: startTime * 1000000, // 转换为微秒
        timelineEndTime: (startTime + mediaItem.duration) * 1000000, // 转换为微秒
      }

      console.log('设置视频时间范围:', {
        ...timeRangeConfig,
        clipDuration: mediaItem.duration,
        startTime,
        endTime: startTime + mediaItem.duration,
      })
      ;(sprite as VideoVisibleSprite).setTimeRange(timeRangeConfig)
    } else {
      // 图片使用不同的时间范围设置
      const imageTimeRangeConfig = {
        timelineStartTime: startTime * 1000000, // 转换为微秒
        timelineEndTime: (startTime + mediaItem.duration) * 1000000, // 转换为微秒
        displayDuration: mediaItem.duration * 1000000, // 转换为微秒
      }

      console.log('设置图片时间范围:', {
        ...imageTimeRangeConfig,
        displayDuration: mediaItem.duration,
        startTime,
        endTime: startTime + mediaItem.duration,
      })
      ;(sprite as ImageVisibleSprite).setTimeRange(imageTimeRangeConfig)
    }

    // 注意：不再直接添加sprite到画布，让AddTimelineItemCommand统一处理

    // 生成时间轴clip的缩略图
    console.log('🖼️ 生成时间轴clip缩略图...')
    let thumbnailUrl: string | undefined
    try {
      if (mediaItem.mediaType === 'video' && storeMediaItem.mp4Clip) {
        const thumbnailCanvas = await generateVideoThumbnail(storeMediaItem.mp4Clip)
        thumbnailUrl = await canvasToBlob(thumbnailCanvas)
        console.log('✅ 时间轴视频缩略图生成成功')
      } else if (mediaItem.mediaType === 'image' && storeMediaItem.imgClip) {
        const thumbnailCanvas = await generateImageThumbnail(storeMediaItem.imgClip)
        thumbnailUrl = await canvasToBlob(thumbnailCanvas)
        console.log('✅ 时间轴图片缩略图生成成功')
      }
    } catch (error) {
      console.error('❌ 时间轴缩略图生成失败:', error)
      // 缩略图生成失败不影响TimelineItem创建
    }

    // 创建TimelineItem - 使用markRaw包装VideoVisibleSprite
    const timelineItemId = Date.now().toString() + Math.random().toString(36).substring(2, 11)

    // 将WebAV坐标系转换为项目坐标系（中心原点）
    const projectCoords = webavToProjectCoords(
      sprite.rect.x,
      sprite.rect.y,
      sprite.rect.w,
      sprite.rect.h,
      videoStore.videoResolution.width,
      videoStore.videoResolution.height,
    )

    const timelineItem: TimelineItem = reactive({
      id: timelineItemId,
      mediaItemId: mediaItem.id,
      trackId: trackId,
      mediaType: mediaItem.mediaType,
      timeRange: sprite.getTimeRange(), // 从sprite获取完整的timeRange（已经通过setTimeRange设置）
      sprite: markRaw(sprite), // 使用markRaw避免Vue响应式包装
      thumbnailUrl, // 添加缩略图URL
      // Sprite位置和大小属性（使用项目坐标系）
      position: {
        x: Math.round(projectCoords.x),
        y: Math.round(projectCoords.y),
      },
      size: {
        width: sprite.rect.w,
        height: sprite.rect.h,
      },
      // 其他sprite属性
      rotation: sprite.rect.angle || 0, // 从sprite获取旋转角度（弧度），默认为0
      zIndex: sprite.zIndex,
      opacity: sprite.opacity,
      // 音频属性（仅对视频有效）
      volume: mediaItem.mediaType === 'video' ? 1 : 1, // 默认音量为1
      isMuted: false, // 默认不静音
    })

    console.log('🔄 坐标系转换:', {
      WebAV坐标: { x: sprite.rect.x, y: sprite.rect.y },
      项目坐标: { x: timelineItem.position.x, y: timelineItem.position.y },
      尺寸: { w: sprite.rect.w, h: sprite.rect.h },
    })

    // 添加到store（使用带历史记录的方法）
    console.log(
      `📝 添加时间轴项目: ${mediaItem.name} -> 轨道${trackId}, 位置${Math.max(0, startTime).toFixed(2)}s`,
    )
    await videoStore.addTimelineItemWithHistory(timelineItem)

    console.log(`✅ 时间轴项目创建完成: ${timelineItem.id}`)
  } catch (error) {
    console.error('创建时间轴项目失败:', error)
    alert(`创建时间轴项目失败: ${(error as Error).message}`)
  }
}

async function handleTimelineItemPositionUpdate(
  timelineItemId: string,
  newPosition: number,
  newTrackId?: number,
) {
  try {
    // 使用带历史记录的移动方法
    await videoStore.moveTimelineItemWithHistory(timelineItemId, newPosition, newTrackId)
    console.log('✅ 时间轴项目移动成功')
  } catch (error) {
    console.error('❌ 移动时间轴项目失败:', error)
    // 如果历史记录移动失败，回退到直接移动
    videoStore.updateTimelineItemPosition(timelineItemId, newPosition, newTrackId)
  }
}

async function handleTimelineItemRemove(timelineItemId: string) {
  try {
    const item = videoStore.getTimelineItem(timelineItemId)
    if (item) {
      const mediaItem = videoStore.getMediaItem(item.mediaItemId)
      console.log(`🗑️ 准备从时间轴删除项目: ${mediaItem?.name || '未知'} (ID: ${timelineItemId})`)

      // 使用带历史记录的删除方法
      await videoStore.removeTimelineItemWithHistory(timelineItemId)
      console.log(`✅ 时间轴项目删除完成: ${timelineItemId}`)
    }
  } catch (error) {
    console.error('❌ 删除时间轴项目失败:', error)
    // 如果历史记录删除失败，回退到直接删除
    try {
      const item = videoStore.getTimelineItem(timelineItemId)
      if (item) {
        // 从WebAV画布移除VideoVisibleSprite
        const avCanvas = webAVControls.getAVCanvas()
        if (avCanvas) {
          avCanvas.removeSprite(item.sprite)
        }
        // 从store中移除TimelineItem
        videoStore.removeTimelineItem(timelineItemId)
      }
    } catch (fallbackError) {
      console.error('❌ 回退删除也失败:', fallbackError)
    }
  }
}

function handleTimelineClick(event: MouseEvent) {
  // 点击轨道内容空白区域取消选中
  const target = event.target as HTMLElement
  if (target.classList.contains('track-content')) {
    videoStore.selectTimelineItem(null)
  }
}

function handleWheel(event: WheelEvent) {
  if (event.altKey) {
    // Alt + 滚轮：缩放
    event.preventDefault()
    const zoomFactor = 1.1
    const rect = timelineBody.value?.getBoundingClientRect()
    if (!rect) {
      if (window.DEBUG_TIMELINE_ZOOM) {
        console.error('❌ 无法获取时间轴主体边界')
      }
      return
    }

    // 获取鼠标在时间轴上的位置（减去轨道控制区域的200px）
    const mouseX = event.clientX - rect.left - 200
    const mouseTime = videoStore.pixelToTime(mouseX, timelineWidth.value)

    // 缩放操作（精简调试信息）

    if (event.deltaY < 0) {
      // 向上滚动：放大
      videoStore.zoomIn(zoomFactor, timelineWidth.value)
    } else {
      // 向下滚动：缩小
      videoStore.zoomOut(zoomFactor, timelineWidth.value)
    }

    // 调整滚动偏移量，使鼠标位置保持在相同的时间点
    const newMousePixel = videoStore.timeToPixel(mouseTime, timelineWidth.value)
    const offsetAdjustment = newMousePixel - mouseX
    const newScrollOffset = videoStore.scrollOffset + offsetAdjustment

    videoStore.setScrollOffset(newScrollOffset, timelineWidth.value)
  } else if (event.shiftKey) {
    // Shift + 滚轮：水平滚动
    event.preventDefault()
    const scrollAmount = 50

    if (event.deltaY < 0) {
      // 向上滚动：向左滚动
      videoStore.scrollLeft(scrollAmount, timelineWidth.value)
    } else {
      // 向下滚动：向右滚动
      videoStore.scrollRight(scrollAmount, timelineWidth.value)
    }
  } else {
    // 普通滚轮：垂直滚动（让浏览器处理默认的滚动行为）
    // 不阻止默认行为，允许正常的垂直滚动
  }
}

function handleKeyDown(event: KeyboardEvent) {
  // 检查是否有修饰键，如果有则不处理（让全局快捷键处理）
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return
  }

  // 按 Escape 键取消选中
  if (event.key === 'Escape') {
    videoStore.selectTimelineItem(null)
  }
}

onMounted(() => {
  updateTimelineWidth()
  window.addEventListener('resize', updateTimelineWidth)
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTimelineWidth)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.timeline {
  flex: 1;
  background-color: var(--color-bg-secondary);
  border-radius: var(--border-radius-medium);
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}

.timeline-header {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-primary);
}

.track-manager-header {
  width: 200px;
  padding: var(--spacing-lg);
  background-color: var(--color-bg-tertiary);
  border-right: 1px solid var(--color-border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.track-manager-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.add-track-btn {
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--border-radius-medium);
  color: var(--color-text-primary);
  padding: var(--spacing-xs);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-fast);
}

.add-track-btn:hover {
  background: var(--color-accent-primary-hover);
}

.timeline-scale {
  flex: 1;
  background-color: var(--color-bg-primary);
}

.timeline-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.track-row {
  display: flex;
  border-bottom: 1px solid var(--color-border-primary);
  min-height: 80px;
}

.track-controls {
  width: 200px;
  background-color: var(--color-bg-tertiary);
  border-right: 1px solid var(--color-border-primary);
  padding: var(--spacing-md) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.track-content {
  flex: 1;
  position: relative;
  background-color: var(--color-bg-secondary);
  overflow: hidden;
}

.track-content:hover {
  background-color: var(--color-bg-tertiary);
}

/* 隐藏轨道样式 */
.track-content.track-hidden {
  background-color: var(--color-bg-quaternary);
  opacity: 0.6;
  position: relative;
}

.track-content.track-hidden::before {
  content: '轨道已隐藏';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  pointer-events: none;
  z-index: 1;
  background-color: rgba(0, 0, 0, 0.7);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-small);
  white-space: nowrap;
}

.track-content.track-hidden:hover {
  background-color: var(--color-bg-quaternary);
  opacity: 0.8;
}

.track-name {
  flex: 1;
}

.track-name-text {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  cursor: pointer;
  display: block;
  padding: 2px var(--spacing-xs);
  border-radius: 2px;
  transition: background-color var(--transition-fast);
}

.track-name-text:hover {
  background-color: var(--color-bg-quaternary);
}

.track-name-input {
  background: var(--color-bg-quaternary);
  border: 1px solid var(--color-border-secondary);
  border-radius: 2px;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  padding: 2px var(--spacing-xs);
  width: 100%;
}

.track-buttons {
  display: flex;
  gap: var(--spacing-xs);
  justify-content: flex-start;
}

/* 使用通用的 track-btn 样式 */

.track-btn.arrange-btn {
  background: var(--color-accent-secondary);
  color: var(--color-text-primary);
}

.track-btn.arrange-btn:hover:not(:disabled) {
  background: var(--color-accent-secondary-hover);
}

.track-btn.arrange-btn:disabled {
  background: var(--color-bg-quaternary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
  opacity: 0.5;
}

.timeline-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background-color: var(--color-bg-quaternary);
  opacity: 0.5;
}

.grid-line.frame-line {
  background-color: var(--color-border-secondary);
  opacity: 0.3;
  width: 1px;
}
</style>
