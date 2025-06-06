<template>
  <div class="canvas-video-renderer">
    <canvas ref="canvasRef" :width="canvasWidth" :height="canvasHeight" class="video-canvas" />
    <!-- 交互层 -->
    <div
      ref="interactionLayerRef"
      class="interaction-layer"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @wheel="onWheel"
      @click="onClick"
    >
      <!-- 选中片段的控制框 -->
      <div
        v-if="selectedClip && isClipVisible(selectedClip)"
        class="selection-box"
        :style="selectionBoxStyle"
      >
        <!-- 边框 -->
        <div class="selection-border"></div>

        <!-- 四个角的缩放手柄 -->
        <div class="resize-handle top-left" data-handle="top-left"></div>
        <div class="resize-handle top-right" data-handle="top-right"></div>
        <div class="resize-handle bottom-left" data-handle="bottom-left"></div>
        <div class="resize-handle bottom-right" data-handle="bottom-right"></div>

        <!-- 旋转手柄 -->
        <div class="rotate-handle" data-handle="rotate"></div>

        <!-- 中心拖拽区域 -->
        <div class="drag-area" data-handle="move"></div>

        <!-- 片段信息标签 -->
        <div class="clip-info-label">
          {{ selectedClip.name }}
        </div>
      </div>
    </div>

    <!-- 隐藏的视频元素用于渲染 -->
    <div class="hidden-videos">
      <video
        v-for="clip in activeClips"
        :key="clip.id"
        :ref="(el) => setVideoRef(clip.id, el)"
        :src="clip.url"
        muted
        preload="metadata"
        @loadedmetadata="onVideoLoaded(clip.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useVideoStore, type VideoClip } from '../stores/counter'

const videoStore = useVideoStore()

// Canvas引用
const canvasRef = ref<HTMLCanvasElement>()
const interactionLayerRef = ref<HTMLDivElement>()
let ctx: CanvasRenderingContext2D | null = null

// 视频元素引用映射
const videoElements = new Map<string, HTMLVideoElement>()
const loadedVideos = new Set<string>()

// 交互状态
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const dragStartTransform = ref({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 })
const currentHandle = ref<string | null>(null)
const hasDragged = ref(false) // 标记是否发生了实际的拖拽

// 获取当前选中的片段
const selectedClip = computed(() => {
  if (!videoStore.selectedClipId) return null
  return videoStore.clips.find((clip) => clip.id === videoStore.selectedClipId) || null
})

// Canvas尺寸
const canvasWidth = computed(() => videoStore.videoResolution.width)
const canvasHeight = computed(() => videoStore.videoResolution.height)

// 检查片段是否在当前时间可见
const isClipVisible = (clip: VideoClip) => {
  const currentTime = videoStore.currentTime
  const clipStart = clip.timelinePosition
  const clipEnd = clip.timelinePosition + clip.duration
  return currentTime >= clipStart && currentTime < clipEnd
}

// 计算选中片段的控制框样式
const selectionBoxStyle = computed(() => {
  if (!selectedClip.value || !canvasRef.value || !interactionLayerRef.value) return {}

  const clip = selectedClip.value
  const canvas = canvasRef.value
  const interactionLayer = interactionLayerRef.value

  // 获取canvas和交互层的位置信息
  const canvasRect = canvas.getBoundingClientRect()
  const layerRect = interactionLayer.getBoundingClientRect()

  // 计算canvas在交互层中的相对位置
  const canvasOffsetX = canvasRect.left - layerRect.left
  const canvasOffsetY = canvasRect.top - layerRect.top

  // 计算canvas的显示尺寸
  const canvasDisplayWidth = canvasRect.width
  const canvasDisplayHeight = canvasRect.height

  // 计算缩放比例（canvas实际尺寸 vs 显示尺寸）
  const scaleX = canvasDisplayWidth / canvasWidth.value
  const scaleY = canvasDisplayHeight / canvasHeight.value

  // 计算视频片段的变换后尺寸
  const { transform } = clip

  // 获取视频元素以计算原始尺寸
  const videoElement = videoElements.get(clip.id)
  if (!videoElement) return {}

  // 计算基础尺寸（缩放1.0时的尺寸）
  const canvasAspectRatio = canvasWidth.value / canvasHeight.value
  const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight

  let baseWidth, baseHeight
  if (videoAspectRatio > canvasAspectRatio) {
    baseHeight = canvasHeight.value
    baseWidth = baseHeight * videoAspectRatio
  } else {
    baseWidth = canvasWidth.value
    baseHeight = baseWidth / videoAspectRatio
  }

  // 应用用户缩放
  const videoWidth = baseWidth * transform.scaleX
  const videoHeight = baseHeight * transform.scaleY

  // 转换到显示坐标系
  const displayWidth = videoWidth * scaleX
  const displayHeight = videoHeight * scaleY

  // 计算在canvas中的中心位置（考虑位置偏移）
  const canvasCenterX = canvasDisplayWidth / 2 + transform.x * scaleX
  const canvasCenterY = canvasDisplayHeight / 2 + transform.y * scaleY

  // 转换到交互层坐标系
  const centerX = canvasOffsetX + canvasCenterX
  const centerY = canvasOffsetY + canvasCenterY

  return {
    position: 'absolute' as const,
    left: `${centerX - displayWidth / 2}px`,
    top: `${centerY - displayHeight / 2}px`,
    width: `${displayWidth}px`,
    height: `${displayHeight}px`,
    transform: `rotate(${transform.rotation}deg)`,
    transformOrigin: 'center center',
  }
})

// 鼠标事件处理
const onMouseDown = (event: MouseEvent) => {
  if (!selectedClip.value || !interactionLayerRef.value) return

  const target = event.target as HTMLElement
  const handle = target.getAttribute('data-handle')

  if (handle) {
    isDragging.value = true
    currentHandle.value = handle
    hasDragged.value = false // 重置拖拽标记
    dragStartPos.value = { x: event.clientX, y: event.clientY }

    // 保存开始时的变换状态
    const transform = selectedClip.value.transform
    dragStartTransform.value = {
      x: transform.x,
      y: transform.y,
      scaleX: transform.scaleX,
      scaleY: transform.scaleY,
      rotation: transform.rotation,
    }

    event.preventDefault()
    event.stopPropagation()
  }
}

const onMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !selectedClip.value || !currentHandle.value) return

  const deltaX = event.clientX - dragStartPos.value.x
  const deltaY = event.clientY - dragStartPos.value.y

  // 如果鼠标移动超过一定距离，标记为已拖拽
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
    hasDragged.value = true
  }

  // 根据不同的手柄类型执行不同的操作
  switch (currentHandle.value) {
    case 'move':
      handleMove(deltaX, deltaY)
      break
    case 'top-left':
    case 'top-right':
    case 'bottom-left':
    case 'bottom-right':
      handleResize(currentHandle.value, deltaX, deltaY, videoStore.proportionalScale)
      break
    case 'rotate':
      handleRotate(deltaX, deltaY)
      break
  }
}

const onMouseUp = () => {
  // 延迟重置状态，让onClick能够检查是否发生了拖拽
  setTimeout(() => {
    isDragging.value = false
    currentHandle.value = null
    hasDragged.value = false
  }, 0)
}

const onMouseLeave = () => {
  isDragging.value = false
  currentHandle.value = null
  hasDragged.value = false
}

const onWheel = (event: WheelEvent) => {
  if (!selectedClip.value) return

  event.preventDefault()

  // 滚轮缩放
  const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1
  const transform = selectedClip.value.transform

  const newScaleX = Math.max(0.1, Math.min(10, transform.scaleX * scaleFactor))
  const newScaleY = Math.max(0.1, Math.min(10, transform.scaleY * scaleFactor))

  videoStore.updateClipTransform(selectedClip.value.id, {
    scaleX: newScaleX,
    scaleY: newScaleY,
  })
}

const onClick = (event: MouseEvent) => {
  if (!interactionLayerRef.value || !canvasRef.value) return

  // 如果刚刚完成了拖拽操作，不处理选择
  if (hasDragged.value) {
    return
  }

  // 如果点击的是控制手柄，不处理选择
  const target = event.target as HTMLElement
  if (target.getAttribute('data-handle')) return

  // 获取点击位置相对于交互层和canvas的坐标
  const canvasRect = canvasRef.value.getBoundingClientRect()
  const layerRect = interactionLayerRef.value.getBoundingClientRect()

  // 点击位置相对于交互层
  const clickX = event.clientX - layerRect.left
  const clickY = event.clientY - layerRect.top

  // 计算canvas在交互层中的偏移
  const canvasOffsetX = canvasRect.left - layerRect.left
  const canvasOffsetY = canvasRect.top - layerRect.top

  // 点击位置相对于canvas
  const canvasClickX = clickX - canvasOffsetX
  const canvasClickY = clickY - canvasOffsetY

  // 检查点击是否在canvas范围内
  if (
    canvasClickX < 0 ||
    canvasClickX > canvasRect.width ||
    canvasClickY < 0 ||
    canvasClickY > canvasRect.height
  ) {
    // 点击在canvas外部，取消选择
    videoStore.selectClip(null)
    return
  }

  // 转换为canvas坐标系
  const scaleX = canvasRect.width / canvasWidth.value
  const scaleY = canvasRect.height / canvasHeight.value

  const canvasX = canvasClickX / scaleX
  const canvasY = canvasClickY / scaleY

  // 检查是否点击了某个视频片段
  const clickedClip = findClipAtPosition(canvasX, canvasY)

  if (clickedClip) {
    videoStore.selectClip(clickedClip.id)
  } else {
    // 点击空白区域取消选择
    videoStore.selectClip(null)
  }
}

// 查找指定位置的视频片段
const findClipAtPosition = (canvasX: number, canvasY: number): VideoClip | null => {
  // 只检查当前时间可见的片段，按z-index从高到低排序
  const sortedClips = [...activeClips.value].sort((a, b) => b.zIndex - a.zIndex)

  for (const clip of sortedClips) {
    if (isPointInClip(canvasX, canvasY, clip)) {
      return clip
    }
  }

  return null
}

// 检查点是否在视频片段内
const isPointInClip = (canvasX: number, canvasY: number, clip: VideoClip): boolean => {
  const videoElement = videoElements.get(clip.id)
  if (!videoElement) return false

  const { transform } = clip
  const centerX = canvasWidth.value / 2 + transform.x
  const centerY = canvasHeight.value / 2 + transform.y

  // 计算基础尺寸
  const canvasAspectRatio = canvasWidth.value / canvasHeight.value
  const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight

  let baseWidth, baseHeight
  if (videoAspectRatio > canvasAspectRatio) {
    baseHeight = canvasHeight.value
    baseWidth = baseHeight * videoAspectRatio
  } else {
    baseWidth = canvasWidth.value
    baseHeight = baseWidth / videoAspectRatio
  }

  // 应用缩放
  const videoWidth = baseWidth * transform.scaleX
  const videoHeight = baseHeight * transform.scaleY

  // 如果没有旋转，使用简单的矩形检测
  if (Math.abs(transform.rotation) < 0.1) {
    const left = centerX - videoWidth / 2
    const right = centerX + videoWidth / 2
    const top = centerY - videoHeight / 2
    const bottom = centerY + videoHeight / 2

    return canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom
  }

  // 有旋转时，将点击点转换到视频的本地坐标系
  const dx = canvasX - centerX
  const dy = canvasY - centerY

  // 反向旋转点击点
  const angle = (-transform.rotation * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos

  // 在本地坐标系中检测
  return Math.abs(localX) <= videoWidth / 2 && Math.abs(localY) <= videoHeight / 2
}

// 处理移动
const handleMove = (deltaX: number, deltaY: number) => {
  if (!selectedClip.value || !canvasRef.value) return

  const canvas = canvasRef.value
  const canvasRect = canvas.getBoundingClientRect()

  // 计算缩放比例（canvas实际尺寸 vs 显示尺寸）
  const scaleX = canvasRect.width / canvasWidth.value
  const scaleY = canvasRect.height / canvasHeight.value

  // 将显示坐标的移动量转换为canvas坐标
  const canvasDeltaX = deltaX / scaleX
  const canvasDeltaY = deltaY / scaleY

  const newX = dragStartTransform.value.x + canvasDeltaX
  const newY = dragStartTransform.value.y + canvasDeltaY

  videoStore.updateClipTransform(selectedClip.value.id, {
    x: newX,
    y: newY,
  })
}

// 处理缩放
const handleResize = (
  handle: string,
  deltaX: number,
  deltaY: number,
  proportional: boolean = false,
) => {
  if (!selectedClip.value || !canvasRef.value) return

  const canvas = canvasRef.value
  const canvasRect = canvas.getBoundingClientRect()

  // 计算缩放比例
  const scaleX = canvasRect.width / canvasWidth.value
  const scaleY = canvasRect.height / canvasHeight.value

  // 将显示坐标的移动量转换为canvas坐标
  const canvasDeltaX = deltaX / scaleX
  const canvasDeltaY = deltaY / scaleY

  // 获取视频元素以计算原始尺寸
  const videoElement = videoElements.get(selectedClip.value.id)
  if (!videoElement) return

  // 计算基础尺寸
  const canvasAspectRatio = canvasWidth.value / canvasHeight.value
  const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight

  let baseWidth, baseHeight
  if (videoAspectRatio > canvasAspectRatio) {
    baseHeight = canvasHeight.value
    baseWidth = baseHeight * videoAspectRatio
  } else {
    baseWidth = canvasWidth.value
    baseHeight = baseWidth / videoAspectRatio
  }

  // 根据手柄位置计算缩放变化
  let scaleChangeX = 0
  let scaleChangeY = 0

  switch (handle) {
    case 'top-left':
      scaleChangeX = -canvasDeltaX / baseWidth
      scaleChangeY = -canvasDeltaY / baseHeight
      break
    case 'top-right':
      scaleChangeX = canvasDeltaX / baseWidth
      scaleChangeY = -canvasDeltaY / baseHeight
      break
    case 'bottom-left':
      scaleChangeX = -canvasDeltaX / baseWidth
      scaleChangeY = canvasDeltaY / baseHeight
      break
    case 'bottom-right':
      scaleChangeX = canvasDeltaX / baseWidth
      scaleChangeY = canvasDeltaY / baseHeight
      break
  }

  let newScaleX, newScaleY

  if (proportional) {
    // 等比缩放：使用主要的缩放变化方向
    // 选择变化量较大的轴作为主导
    const absChangeX = Math.abs(scaleChangeX)
    const absChangeY = Math.abs(scaleChangeY)

    let uniformScaleChange
    if (absChangeX > absChangeY) {
      uniformScaleChange = scaleChangeX
    } else {
      uniformScaleChange = scaleChangeY
    }

    // 基于开始时的平均缩放值进行等比缩放
    const baseScale = (dragStartTransform.value.scaleX + dragStartTransform.value.scaleY) / 2
    const newUniformScale = Math.max(0.1, Math.min(10, baseScale + uniformScaleChange))

    newScaleX = newUniformScale
    newScaleY = newUniformScale
  } else {
    // 自由缩放
    newScaleX = Math.max(0.1, Math.min(10, dragStartTransform.value.scaleX + scaleChangeX))
    newScaleY = Math.max(0.1, Math.min(10, dragStartTransform.value.scaleY + scaleChangeY))
  }

  videoStore.updateClipTransform(selectedClip.value.id, {
    scaleX: newScaleX,
    scaleY: newScaleY,
  })
}

// 处理旋转
const handleRotate = (deltaX: number, _deltaY: number) => {
  if (!selectedClip.value || !canvasRef.value) return

  // 计算旋转角度（基于鼠标水平移动的距离）
  const rotationChange = deltaX * 0.5 // 调整旋转敏感度
  const newRotation = dragStartTransform.value.rotation + rotationChange

  // 限制旋转角度在-180到180度之间
  const clampedRotation = ((newRotation + 180) % 360) - 180

  videoStore.updateClipTransform(selectedClip.value.id, {
    rotation: clampedRotation,
  })
}

// 当前时间的活跃片段
const activeClips = computed(() => {
  const currentTime = videoStore.currentTime
  return videoStore.clips
    .filter((clip) => {
      const clipStart = clip.timelinePosition
      const clipEnd = clip.timelinePosition + clip.duration
      return currentTime >= clipStart && currentTime < clipEnd
    })
    .sort((a, b) => a.zIndex - b.zIndex) // 按层级排序
})

// 设置视频元素引用
const setVideoRef = (clipId: string, el: any) => {
  // 确保 el 是 HTMLVideoElement 类型
  const videoElement = el?.$el || el
  if (videoElement && videoElement instanceof HTMLVideoElement) {
    videoElements.set(clipId, videoElement)
  } else {
    videoElements.delete(clipId)
  }
}

// 视频加载完成
const onVideoLoaded = (clipId: string) => {
  loadedVideos.add(clipId)
  console.log(`视频 ${clipId} 加载完成`)
}

// 渲染帧
const renderFrame = () => {
  if (!ctx || !canvasRef.value) return

  // 清空画布
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)

  // 渲染每个活跃的视频片段
  for (const clip of activeClips.value) {
    const videoElement = videoElements.get(clip.id)
    if (!videoElement || !loadedVideos.has(clip.id)) continue

    // 计算视频在片段中的当前时间
    const clipRelativeTime = videoStore.currentTime - clip.timelinePosition
    const videoTime = clip.startTime + clipRelativeTime * (clip.playbackRate || 1)

    // 设置视频时间
    if (Math.abs(videoElement.currentTime - videoTime) > 0.1) {
      videoElement.currentTime = videoTime
    }

    // 应用变换并渲染
    renderVideoWithTransform(videoElement, clip)
  }
}

// 应用变换并渲染视频
const renderVideoWithTransform = (video: HTMLVideoElement, clip: VideoClip) => {
  if (!ctx) return

  const { transform } = clip
  const centerX = canvasWidth.value / 2
  const centerY = canvasHeight.value / 2

  // 保存当前状态
  ctx.save()

  // 设置透明度
  ctx.globalAlpha = transform.opacity

  // 移动到画布中心
  ctx.translate(centerX, centerY)

  // 应用位置偏移
  ctx.translate(transform.x, transform.y)

  // 应用旋转
  ctx.rotate((transform.rotation * Math.PI) / 180)

  // 计算缩放1.0时的基础尺寸 - 让视频片段能够完全覆盖画布（类似object-fit: cover）
  const canvasAspectRatio = canvasWidth.value / canvasHeight.value
  const videoAspectRatio = video.videoWidth / video.videoHeight

  let baseWidth, baseHeight

  if (videoAspectRatio > canvasAspectRatio) {
    // 视频比画布更宽，以高度为准进行缩放
    baseHeight = canvasHeight.value
    baseWidth = baseHeight * videoAspectRatio
  } else {
    // 视频比画布更高，以宽度为准进行缩放
    baseWidth = canvasWidth.value
    baseHeight = baseWidth / videoAspectRatio
  }

  // 应用用户设置的缩放
  const videoWidth = baseWidth * transform.scaleX
  const videoHeight = baseHeight * transform.scaleY

  // 绘制视频（以中心为原点）
  ctx.drawImage(video, -videoWidth / 2, -videoHeight / 2, videoWidth, videoHeight)

  // 恢复状态
  ctx.restore()
}

// 动画循环
let animationId: number | null = null

const startRenderLoop = () => {
  const render = () => {
    renderFrame()
    animationId = requestAnimationFrame(render)
  }
  render()
}

const stopRenderLoop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

// 监听当前时间变化
watch(
  () => videoStore.currentTime,
  () => {
    renderFrame()
  },
)

// 监听活跃片段变化
watch(
  activeClips,
  () => {
    renderFrame()
  },
  { deep: true },
)

// 监听画布尺寸变化
watch([canvasWidth, canvasHeight], () => {
  nextTick(() => {
    renderFrame()
  })
})

// 键盘事件处理
const onKeyDown = (event: KeyboardEvent) => {
  if (!selectedClip.value) return

  const step = event.shiftKey ? 10 : 1 // Shift键加速
  const transform = selectedClip.value.transform

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      videoStore.updateClipTransform(selectedClip.value.id, {
        x: transform.x - step,
      })
      break
    case 'ArrowRight':
      event.preventDefault()
      videoStore.updateClipTransform(selectedClip.value.id, {
        x: transform.x + step,
      })
      break
    case 'ArrowUp':
      event.preventDefault()
      videoStore.updateClipTransform(selectedClip.value.id, {
        y: transform.y - step,
      })
      break
    case 'ArrowDown':
      event.preventDefault()
      videoStore.updateClipTransform(selectedClip.value.id, {
        y: transform.y + step,
      })
      break
    case 'Delete':
    case 'Backspace':
      event.preventDefault()
      if (confirm('确定要删除这个视频片段吗？')) {
        videoStore.removeClip(selectedClip.value.id)
      }
      break
  }
}

// 组件挂载
onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d')
    // startRenderLoop()
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', onKeyDown)
})

// 组件卸载
onUnmounted(() => {
  // stopRenderLoop()
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.canvas-video-renderer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2a2a2a;
}

.video-canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background-color: #000;
}

.interaction-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 10;
}

.selection-box {
  pointer-events: none;
  z-index: 20;
}

.selection-border {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 2px solid #ff6b35;
  border-radius: 4px;
  pointer-events: none;
}

/* 缩放手柄 */
.resize-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #ff6b35;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: auto;
  cursor: pointer;
  z-index: 30;
}

.resize-handle:hover {
  background-color: #ff8c42;
  transform: scale(1.2);
}

.resize-handle.top-left {
  top: -6px;
  left: -6px;
  cursor: nw-resize;
}

.resize-handle.top-right {
  top: -6px;
  right: -6px;
  cursor: ne-resize;
}

.resize-handle.bottom-left {
  bottom: -6px;
  left: -6px;
  cursor: sw-resize;
}

.resize-handle.bottom-right {
  bottom: -6px;
  right: -6px;
  cursor: se-resize;
}

/* 旋转手柄 */
.rotate-handle {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 16px;
  background-color: #4caf50;
  border: 2px solid #fff;
  border-radius: 50%;
  pointer-events: auto;
  cursor: grab;
  z-index: 30;
}

.rotate-handle:hover {
  background-color: #66bb6a;
  transform: translateX(-50%) scale(1.2);
}

.rotate-handle:active {
  cursor: grabbing;
}

/* 拖拽区域 */
.drag-area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: move;
  z-index: 25;
}

.drag-area:hover {
  background-color: rgba(255, 107, 53, 0.1);
}

/* 片段信息标签 */
.clip-info-label {
  position: absolute;
  bottom: -30px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 35;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hidden-videos {
  position: absolute;
  top: -9999px;
  left: -9999px;
  visibility: hidden;
  pointer-events: none;
}

.hidden-videos video {
  width: 1px;
  height: 1px;
}
</style>
