import { ref } from 'vue'

/**
 * 布局调整管理
 * 处理主界面的各种面板大小调整
 */
export function useLayoutResize() {
  // ==================== 状态定义 ====================
  
  // 垂直分割 - 预览区域和时间轴区域
  const previewHeight = ref(50) // 默认预览窗口占50%
  const timelineHeight = ref(50) // 默认时间轴占50%
  
  // 水平分割 - 左右面板
  const leftPanelWidth = ref(400) // 左侧素材库宽度
  const rightPanelWidth = ref(400) // 右侧属性面板宽度
  
  // 拖拽状态
  let startPreviewHeight = 0
  let startLeftWidth = 0
  let startRightWidth = 0

  // ==================== 垂直分割器处理 ====================
  
  /**
   * 处理垂直分割器拖拽（预览区域和时间轴之间）
   */
  function handleVerticalResize(delta: number) {
    const containerHeight = document.querySelector('.main-content')?.clientHeight || 600
    const deltaPercent = (delta / containerHeight) * 100
    
    let newPreviewHeight = startPreviewHeight + deltaPercent
    
    // 限制最小和最大高度
    newPreviewHeight = Math.max(20, Math.min(80, newPreviewHeight))
    
    previewHeight.value = newPreviewHeight
    timelineHeight.value = 100 - newPreviewHeight
  }
  
  /**
   * 开始垂直分割器拖拽
   */
  function startVerticalResize() {
    startPreviewHeight = previewHeight.value
  }

  // ==================== 水平分割器处理 ====================
  
  /**
   * 处理左侧分割器拖拽
   */
  function handleLeftResize(delta: number) {
    let newWidth = startLeftWidth + delta
    
    // 限制最小和最大宽度
    newWidth = Math.max(100, Math.min(800, newWidth))
    
    leftPanelWidth.value = newWidth
  }
  
  /**
   * 开始左侧分割器拖拽
   */
  function startLeftResize() {
    startLeftWidth = leftPanelWidth.value
  }
  
  /**
   * 处理右侧分割器拖拽
   */
  function handleRightResize(delta: number) {
    let newWidth = startRightWidth + delta
    
    // 限制最小和最大宽度
    newWidth = Math.max(100, Math.min(800, newWidth))
    
    rightPanelWidth.value = newWidth
  }
  
  /**
   * 开始右侧分割器拖拽
   */
  function startRightResize() {
    startRightWidth = rightPanelWidth.value
  }

  // ==================== 返回接口 ====================
  
  return {
    // 状态
    previewHeight,
    timelineHeight,
    leftPanelWidth,
    rightPanelWidth,
    
    // 垂直分割器方法
    handleVerticalResize,
    startVerticalResize,
    
    // 水平分割器方法
    handleLeftResize,
    startLeftResize,
    handleRightResize,
    startRightResize,
  }
}
