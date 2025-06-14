# 中心缩放算法修复

## 问题描述

之前的视频片段缩放算法存在问题：当用户调整视频片段的缩放比例时，缩放是从左上角开始的，而不是从中心开始。这导致用户在缩放视频时，视频片段会"跳动"到不同的位置，用户体验不佳。

## 解决方案

### 1. 修改 `updateTimelineItemTransform` 函数

在 `frontend/src/stores/videostore.ts` 中修改了 `updateTimelineItemTransform` 函数，添加了中心缩放逻辑：

```typescript
// 更新尺寸时使用中心缩放
if (transform.size) {
  // 获取当前中心位置（项目坐标系）
  const currentCenterX = getTimelineItemValue(item.position.x)
  const currentCenterY = getTimelineItemValue(item.position.y)
  const newWidth = transform.size.width
  const newHeight = transform.size.height

  // 中心缩放：保持中心位置不变，更新尺寸
  sprite.rect.w = newWidth
  sprite.rect.h = newHeight

  // 根据新尺寸重新计算WebAV坐标（保持中心位置不变）
  const webavCoords = projectToWebavCoords(
    currentCenterX,
    currentCenterY,
    newWidth,
    newHeight,
    videoResolution.value.width,
    videoResolution.value.height
  )
  sprite.rect.x = webavCoords.x
  sprite.rect.y = webavCoords.y
}
```

### 2. 核心原理

**坐标系说明：**
- **项目坐标系**：以画布中心为原点 (0,0)，存储在 TimelineItem 中
- **WebAV坐标系**：以画布左上角为原点 (0,0)，WebAV 库使用的坐标系

**中心缩放算法：**
1. 保持精灵的中心位置不变（项目坐标系中的 position.x, position.y）
2. 更新精灵的尺寸（width, height）
3. 根据新尺寸重新计算 WebAV 坐标系中的左上角位置
4. 这样精灵就会以中心为基准进行缩放

### 3. 添加调试工具

在 `frontend/src/utils/coordinateTransform.ts` 中添加了调试函数：

```typescript
/**
 * 计算中心缩放时的新位置
 */
export function calculateCenterScalePosition(
  centerX: number,
  centerY: number,
  newWidth: number,
  newHeight: number,
  canvasWidth: number,
  canvasHeight: number
)

/**
 * 调试中心缩放计算
 */
export function debugCenterScaling(...)
```

## 测试方法

### 1. 基本测试
1. 导入一个视频文件到素材库
2. 将视频拖拽到时间轴
3. 选中视频片段
4. 在属性面板中调整缩放值（统一缩放、X缩放、Y缩放）
5. **预期结果**：视频应该以中心为基准进行缩放，不会"跳动"

### 2. 详细测试场景

**场景1：统一缩放**
- 调整统一缩放滑块或输入框
- 视频应该以中心为基准等比缩放

**场景2：独立X/Y缩放**
- 关闭等比缩放选项
- 分别调整X缩放和Y缩放
- 视频应该以中心为基准在对应方向缩放

**场景3：极端缩放值**
- 测试最小缩放值 (0.1)
- 测试最大缩放值 (10.0)
- 测试快速连续缩放

### 3. 调试信息

在浏览器控制台中可以看到中心缩放的调试信息：
```
🎯 中心缩放: {
  oldSize: { width: 1920, height: 1080 },
  newSize: { width: 960, height: 540 },
  centerPosition: { x: 0, y: 0 },
  webavCoords: { x: -480, y: -270 }
}
```

## 技术细节

### 1. 触发条件
中心缩放逻辑只在以下条件下触发：
- `transform.size` 存在（要更新尺寸）
- `transform.position` 不存在（不同时更新位置）

### 2. 坐标转换
使用现有的坐标转换函数：
- `projectToWebavCoords()`: 项目坐标 → WebAV坐标
- `webavToProjectCoords()`: WebAV坐标 → 项目坐标

### 3. 触发条件
中心缩放逻辑在以下条件下触发：
- `transform.size` 存在（要更新尺寸）

由于代码分析显示没有任何地方同时传递 `size` 和 `position` 参数，所以当更新尺寸时，总是使用中心缩放逻辑。

### 4. 兼容性
- 不影响现有的位置更新逻辑
- 完全向后兼容

## 相关文件

- `frontend/src/stores/videostore.ts` - 主要修改
- `frontend/src/utils/coordinateTransform.ts` - 添加调试工具
- `frontend/src/components/PropertiesPanel.vue` - 缩放控制界面（无需修改）

## 后续改进

可能的改进方向：
1. 添加缩放动画效果
2. 支持自定义缩放中心点
3. 添加缩放预览功能
4. 优化大尺寸视频的缩放性能
