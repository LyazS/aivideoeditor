# 视频缩放计算修改说明

## 修改概述

修改了视频编辑器中的缩放计算逻辑，使得当缩放值为1.0时，视频片段能够完全适应画布尺寸。

## 修改前的问题

- 当缩放为1.0时，视频片段的尺寸等于其原始分辨率
- 这导致视频可能超出画布边界或在画布中显示过小
- 用户需要手动调整缩放值才能让视频适应画布

## 修改后的行为

- 当缩放为1.0时，视频片段会自动适应画布尺寸
- 横屏视频在竖屏画布中：视频宽度 = 画布宽度
- 竖屏视频在横屏画布中：视频高度 = 画布高度
- 保持视频的宽高比，选择较小的缩放比例以确保完全适应

## 修改的文件

### 1. `frontend/src/stores/counter.ts`

添加了两个新函数：

- `getVideoFitScale(clipId)`: 计算视频适应画布的缩放比例
- `getVideoDisplaySize(clipId, userScaleX, userScaleY)`: 计算视频的实际显示尺寸

### 2. `frontend/src/components/CanvasVideoRenderer.vue`

修改了以下函数中的尺寸计算逻辑：
- `selectionBoxStyle`: 选择框样式计算
- `isPointInClip`: 点击检测
- `handleResize`: 缩放处理
- `getClipResolutionText`: 分辨率文本显示
- `renderVideoWithTransform`: 视频渲染

### 3. `frontend/src/components/PropertiesPanel.vue`

修改了以下功能：
- `getCurrentResolution`: 当前分辨率计算
- `confirmResolutionFromInput`: 分辨率输入处理
- 添加了"适应画布"按钮和相应的`fitToCanvas`函数

## 新增功能

### 适应画布按钮

在属性面板的缩放控制区域添加了"适应画布"按钮：
- 点击后将缩放值设置为1.0
- 视频会自动适应画布尺寸
- 支持等比缩放和非等比缩放模式

## 技术实现

### 缩放计算公式

```javascript
// 计算适应画布的缩放比例
const scaleX = canvasWidth / videoWidth
const scaleY = canvasHeight / videoHeight
const fitScale = Math.min(scaleX, scaleY)

// 基础尺寸（缩放1.0时的尺寸）
const baseWidth = videoWidth * fitScale
const baseHeight = videoHeight * fitScale

// 最终显示尺寸
const displayWidth = baseWidth * userScaleX
const displayHeight = baseHeight * userScaleY
```

### 适应逻辑

1. 计算视频原始尺寸与画布尺寸的比例
2. 选择较小的比例作为适应缩放（fitScale）
3. 用户缩放值基于适应后的尺寸进行计算
4. 当用户缩放为1.0时，视频正好适应画布

## 使用示例

### 场景1：横屏视频 (1920x1080) 在竖屏画布 (1080x1920) 中

- 适应缩放：min(1080/1920, 1920/1080) = min(0.5625, 1.778) = 0.5625
- 缩放1.0时的尺寸：1920 * 0.5625 = 1080 (宽度), 1080 * 0.5625 = 607.5 (高度)
- 结果：视频宽度填满画布，高度按比例缩放

### 场景2：竖屏视频 (1080x1920) 在横屏画布 (1920x1080) 中

- 适应缩放：min(1920/1080, 1080/1920) = min(1.778, 0.5625) = 0.5625
- 缩放1.0时的尺寸：1080 * 0.5625 = 607.5 (宽度), 1920 * 0.5625 = 1080 (高度)
- 结果：视频高度填满画布，宽度按比例缩放

## 测试建议

1. 导入不同分辨率和方向的视频文件
2. 设置不同的画布分辨率
3. 验证缩放为1.0时视频是否完全适应画布
4. 测试"适应画布"按钮功能
5. 验证缩放、旋转、移动等操作是否正常工作
