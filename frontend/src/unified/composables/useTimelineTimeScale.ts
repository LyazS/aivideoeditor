import { ref, computed, type Ref } from 'vue'
import { useUnifiedStore } from '@/unified/unifiedStore'
import { calculateVisibleFrameRange } from '@/unified/utils/coordinateUtils'
import { framesToTimecode } from '@/unified/utils/timeUtils'
import { useTimelineWheelHandler, TimelineWheelSource } from './useTimelineWheelHandler'

/**
 * 时间刻度层级接口
 */
interface TimeScaleLevel {
  level: number;                    // 层级编号
  majorInterval: number;           // 主刻度间隔（帧数）
  minorInterval: number;           // 次刻度间隔（帧数）
  unit: 'minutes' | 'seconds' | 'frames';  // 单位类型
  displayName: string;             // 显示名称
}

/**
 * 时间刻度层级配置
 * 按照设计文档定义15个层级
 */
const TIME_SCALE_LEVELS: TimeScaleLevel[] = [
  // 分钟级别 - 每个主刻度间隔有10个次刻度间隔
  { level: 1, majorInterval: 54000, minorInterval: 5400, unit: 'minutes', displayName: '30分钟' },   // 30分钟/3分钟
  { level: 2, majorInterval: 18000, minorInterval: 1800, unit: 'minutes', displayName: '10分钟' },   // 10分钟/1分钟
  { level: 3, majorInterval: 9000, minorInterval: 900, unit: 'minutes', displayName: '5分钟' },    // 5分钟/0.5分钟
  { level: 4, majorInterval: 5400, minorInterval: 540, unit: 'minutes', displayName: '3分钟' },      // 3分钟/0.3分钟
  { level: 5, majorInterval: 3600, minorInterval: 360, unit: 'minutes', displayName: '2分钟' },       // 2分钟/0.2分钟
  { level: 6, majorInterval: 1800, minorInterval: 180, unit: 'minutes', displayName: '1分钟' },       // 1分钟/0.1分钟
  
  // 秒级别 - 每个主刻度间隔有10个次刻度间隔
  { level: 7, majorInterval: 900, minorInterval: 90, unit: 'seconds', displayName: '30秒' },         // 30秒/3秒
  { level: 8, majorInterval: 300, minorInterval: 30, unit: 'seconds', displayName: '10秒' },        // 10秒/1秒
  { level: 9, majorInterval: 150, minorInterval: 15, unit: 'seconds', displayName: '5秒' },          // 5秒/0.5秒
  { level: 10, majorInterval: 90, minorInterval: 9, unit: 'seconds', displayName: '3秒' },          // 3秒/0.3秒
  { level: 11, majorInterval: 60, minorInterval: 6, unit: 'seconds', displayName: '2秒' },           // 2秒/0.2秒
  { level: 12, majorInterval: 30, minorInterval: 3, unit: 'seconds', displayName: '1秒' },         // 1秒/0.1秒
  
  // 帧级别 - 保持不变
  { level: 13, majorInterval: 15, minorInterval: 3, unit: 'frames', displayName: '15帧' },           // 15帧/5帧
  { level: 14, majorInterval: 10, minorInterval: 2, unit: 'frames', displayName: '10帧' },          // 10帧/5帧
  { level: 15, majorInterval: 5, minorInterval: 1, unit: 'frames', displayName: '5帧' },            // 5帧/1帧
];

/**
 * 选择时间刻度层级
 * 根据缩放级别选择合适的时间刻度层级
 * 支持 zoomLevel 范围 0.1 - 100
 */
function selectTimeScaleLevel(zoomLevel: number): TimeScaleLevel {
  // 将 zoomLevel (0.1 - 100) 映射到层级 (1 - 15)
  // 使用对数缩放，将 0.1-100 映射到 0-3 范围
  const normalizedZoom = Math.log10(zoomLevel) + 1; // 0.1->-1, 1->0, 10->1, 100->2
  const levelIndex = Math.floor((normalizedZoom / 3) * 14); // 映射到 0-14 范围
  const clampedIndex = Math.max(0, Math.min(14, levelIndex));
  
  const selectedLevel = TIME_SCALE_LEVELS[clampedIndex];
  
  return selectedLevel;
}

/**
 * 计算刻度间隔
 * 根据设计文档的固定像素间隔原则计算主次刻度的像素间隔
 * 优化：使用单一循环替代两个while循环，修正索引计算
 */
function calculateScaleIntervals(
  containerWidth: number,
  totalDurationFrames: number,
  zoomLevel: number
): {
  currentLevel: TimeScaleLevel;
  majorIntervalPixels: number;
  minorIntervalPixels: number;
} {
  const pixelsPerFrame = (containerWidth * zoomLevel) / totalDurationFrames;
  let currentLevel = selectTimeScaleLevel(zoomLevel);
  
  // 修正索引计算：数组索引 = 层级编号 - 1
  let currentIndex = currentLevel.level - 1;
  
  // 计算主刻度像素间隔
  let majorIntervalPixels = currentLevel.majorInterval * pixelsPerFrame;
  
  // 优化：使用单一循环处理层级调整，避免两个循环互相干扰
  while (true) {
    // 如果间隔超过200px且可以向下调整
    if (majorIntervalPixels > 200 && currentIndex < TIME_SCALE_LEVELS.length - 1) {
      currentIndex++;
    }
    // 如果间隔小于100px且可以向上调整
    else if (majorIntervalPixels < 100 && currentIndex > 0) {
      currentIndex--;
    }
    // 如果间隔在合理范围内或无法继续调整
    else {
      break;
    }
    
    // 更新当前层级和像素间隔
    currentLevel = TIME_SCALE_LEVELS[currentIndex];
    majorIntervalPixels = currentLevel.majorInterval * pixelsPerFrame;
  }
  
  const minorIntervalPixels = currentLevel.minorInterval * pixelsPerFrame;
  
  return {
    currentLevel,
    majorIntervalPixels,
    minorIntervalPixels
  };
}

/**
 * 时间刻度标记接口
 * 用于时间轴刻度显示
 */
interface TimeMark {
  time: number // 时间值（帧数）- 内部使用帧数进行精确计算
  position: number
  isMajor: boolean
  isFrame?: boolean // 标记是否为帧级别的刻度
}

/**
 * 时间轴时间刻度模块
 * 提供时间轴时间刻度相关的功能，包括刻度标记计算、事件处理等
 */
export function useTimelineTimeScale(scaleContainer: Ref<HTMLElement | undefined>) {
  const unifiedStore = useUnifiedStore()

  // 容器宽度
  const containerWidth = ref(800)

  // 拖拽状态
  const isDragging = ref(false)


  /**
   * 计算时间刻度标记（基于帧数）
   * 使用新的层级系统实现固定像素间隔
   */
  const timeMarks = computed((): TimeMark[] => {
    const marks: TimeMark[] = []
    const durationFrames = unifiedStore.totalDurationFrames
    const { currentLevel, majorIntervalPixels, minorIntervalPixels } =
      calculateScaleIntervals(
        containerWidth.value,
        durationFrames,
        unifiedStore.zoomLevel
      )

    // 计算可见帧数范围
    const maxVisibleDurationFrames = unifiedStore.maxVisibleDurationFrames
    const { startFrames, endFrames } = calculateVisibleFrameRange(
      containerWidth.value,
      durationFrames,
      unifiedStore.zoomLevel,
      unifiedStore.scrollOffset,
      maxVisibleDurationFrames,
    )

    // 对齐到刻度间隔
    const alignedStart = Math.floor(startFrames / currentLevel.minorInterval) * currentLevel.minorInterval;
    const alignedEnd = Math.ceil(endFrames / currentLevel.minorInterval) * currentLevel.minorInterval;

    // 生成刻度标记
    for (let frames = alignedStart; frames <= alignedEnd; frames += currentLevel.minorInterval) {
      if (frames < 0) continue;
      
      const isMajor = (frames % currentLevel.majorInterval) === 0;
      const position = unifiedStore.frameToPixel(frames, containerWidth.value);
      
      // 只添加可见范围内的刻度
      if (position >= -50 && position <= containerWidth.value + 50) {
        marks.push({
          time: frames,
          position,
          isMajor,
          isFrame: currentLevel.unit === 'frames'
        });
      }
    }

    return marks
  })

  /**
   * 格式化时间显示
   * 根据当前层级显示不同的时间格式
   * 如果小时为0则不显示小时部分，但分钟总是显示
   */
  function formatTime(frames: number): string {
    const { currentLevel } = calculateScaleIntervals(
      containerWidth.value,
      unifiedStore.totalDurationFrames,
      unifiedStore.zoomLevel
    );
    
    const totalSeconds = Math.floor(frames / 30); // 假设30fps
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const remainingFrames = frames % 30;
    
    // 格式化数字为两位数
    const formatNumber = (num: number) => num.toString().padStart(2, '0');
    
    // 根据单位类型决定要显示的时间部分
    const timeParts: string[] = [];
    
    // 如果有小时且小时不为0，在分钟前面添加小时
    if (hours > 0) {
      timeParts.push(formatNumber(hours));
      timeParts.push(':');
    }
    // 总是显示分+秒
    timeParts.push(formatNumber(minutes));
      timeParts.push(':');
    timeParts.push(formatNumber(seconds));

    // 如果有帧数，在秒前面添加帧数
    if (currentLevel.unit === 'frames') {
      timeParts.push('.');
      timeParts.push(formatNumber(remainingFrames));
      // timeParts.push('f');
    }
    
    
    // 将数组中的所有元素连接成一个字符串
    return timeParts.join('');
  }

  /**
   * 更新容器宽度
   */
  function updateContainerWidth() {
    if (scaleContainer.value) {
      containerWidth.value = scaleContainer.value.clientWidth
    }
  }

  /**
   * 计算点击位置对应的帧数
   */
  function calculateFrameFromClick(event: MouseEvent): number {
    if (!scaleContainer.value) return 0

    const rect = scaleContainer.value.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    return unifiedStore.pixelToFrame(clickX, containerWidth.value)
  }

  /**
   * 计算全局鼠标位置对应的帧数
   */
  function calculateFrameFromGlobalMouse(event: MouseEvent): number {
    if (!scaleContainer.value) return 0

    const rect = scaleContainer.value.getBoundingClientRect()
    // 限制鼠标X坐标在刻度容器范围内
    const clampedX = Math.max(rect.left, Math.min(event.clientX, rect.right))
    const clickX = clampedX - rect.left
    return unifiedStore.pixelToFrame(clickX, containerWidth.value)
  }

  /**
   * 处理时间刻度区域的点击事件
   */
  function handleTimeScaleClick(event: MouseEvent) {
    const frame = calculateFrameFromClick(event)
    unifiedStore.setCurrentFrame(frame)
  }

  /**
   * 处理时间刻度区域的鼠标按下事件
   */
  function handleTimeScaleMouseDown(event: MouseEvent) {
    // 阻止默认行为，防止文本选择
    event.preventDefault()
    
    // 开始拖拽，设置拖拽状态
    isDragging.value = true
    const frame = calculateFrameFromClick(event)
    unifiedStore.setCurrentFrame(frame)
    
    // 添加全局鼠标事件监听器，处理拖拽到区域外的情况
    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)
  }

  /**
   * 处理全局鼠标移动事件
   */
  function handleGlobalMouseMove(event: MouseEvent) {
    if (isDragging.value) {
      const frame = calculateFrameFromGlobalMouse(event)
      unifiedStore.setCurrentFrame(frame)
    }
  }

  /**
   * 处理全局鼠标释放事件
   */
  function handleGlobalMouseUp() {
    // 结束拖拽
    isDragging.value = false
    
    // 移除全局事件监听器
    document.removeEventListener('mousemove', handleGlobalMouseMove)
    document.removeEventListener('mouseup', handleGlobalMouseUp)
  }

  /**
   * 处理时间刻度区域的鼠标移动事件
   */
  function handleTimeScaleMouseMove(event: MouseEvent) {
    if (isDragging.value) {
      const frame = calculateFrameFromClick(event)
      unifiedStore.setCurrentFrame(frame)
    }
  }

  /**
   * 处理时间刻度区域的鼠标释放事件
   */
  function handleTimeScaleMouseUp() {
    handleGlobalMouseUp()
  }


  // 使用统一的滚轮处理
  const { handleWheel: handleTimeScaleWheel } = useTimelineWheelHandler(
    scaleContainer,
    containerWidth,
    {
      source: TimelineWheelSource.TIME_SCALE // 时间刻度区域
    }
  )

  return {
    // 状态
    containerWidth,
    isDragging,

    // 计算属性
    timeMarks,

    // 方法
    formatTime,
    updateContainerWidth,
    calculateFrameFromClick,
    handleTimeScaleClick,
    handleTimeScaleMouseDown,
    handleTimeScaleMouseMove,
    handleTimeScaleMouseUp,
    handleTimeScaleWheel,
  }
}
