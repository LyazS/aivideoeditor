# 预览窗口固定尺寸修改说明

## 修改目标
固定预览窗口大小，使其不随播放视频尺寸而变化。

## 修改内容

### 1. VideoPreviewEngine.vue 修改
**文件路径**: `frontend/src/components/VideoPreviewEngine.vue`

**修改位置**: `.preview-section` CSS 样式 (第48-57行)

**修改前**:
```css
.preview-section {
  flex: 1;
  min-height: 400px;
  max-height: calc(100vh - 320px); /* 为时间轴和控制面板留出空间 */
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  width: 100%;
}
```

**修改后**:
```css
.preview-section {
  /* 固定预览窗口尺寸，使用16:9宽高比 */
  width: 100%;
  max-width: 800px; /* 最大宽度 */
  height: 450px; /* 固定高度，对应16:9比例 */
  margin: 0 auto; /* 水平居中 */
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  flex-shrink: 0; /* 防止被压缩 */
}
```

### 2. PreviewWindow.vue 修改
**文件路径**: `frontend/src/components/PreviewWindow.vue`

**修改位置1**: `.preview-window` CSS 样式 (第171-182行)

**修改前**:
```css
.preview-window {
  width: 100%;
  height: 100%;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid #333;
  box-sizing: border-box;
}
```

**修改后**:
```css
.preview-window {
  width: 100%;
  height: 100%;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 2px solid #333;
  box-sizing: border-box;
  /* 确保预览窗口尺寸固定 */
  min-width: 400px;
  min-height: 300px;
}
```

**修改位置2**: `.video-container` CSS 样式 (第187-195行)

**修改前**:
```css
.video-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 100%;
  height: 100%;
}
```

**修改后**:
```css
.video-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 100%;
  height: 100%;
  /* 确保容器尺寸固定，不随视频内容变化 */
  min-height: 250px;
}
```

## 修改效果

### 主要改进
1. **固定预览窗口尺寸**: 预览区域现在使用固定的800px最大宽度和450px固定高度（16:9比例）
2. **防止尺寸变化**: 移除了 `flex: 1` 属性，改为固定尺寸，防止窗口随内容变化
3. **保持居中对齐**: 使用 `margin: 0 auto` 确保预览窗口在页面中居中显示
4. **防止压缩**: 添加 `flex-shrink: 0` 防止预览窗口被其他元素压缩
5. **最小尺寸保证**: 设置最小宽度和高度，确保即使在小屏幕上也有合理的显示效果

### 技术细节
- **16:9 宽高比**: 选择了800x450的尺寸，符合常见的视频宽高比
- **响应式设计**: 保持了 `max-width: 800px`，在小屏幕上会自动缩放
- **视频适配**: 保留了原有的 `object-fit: contain` 设置，确保视频在固定容器内正确显示
- **溢出处理**: 保持 `overflow: hidden` 确保内容不会超出预览窗口边界

## 测试建议

### 测试场景
1. **不同尺寸视频**: 测试横向、竖向、正方形等不同比例的视频
2. **窗口调整**: 调整浏览器窗口大小，确认预览窗口尺寸保持固定
3. **多个视频切换**: 在时间轴上切换不同尺寸的视频片段，确认预览窗口不变化
4. **响应式测试**: 在不同屏幕尺寸下测试显示效果

### 预期结果
- 预览窗口尺寸始终保持固定，不随视频内容变化
- 视频在固定容器内正确缩放和居中显示
- 界面布局稳定，不会因视频切换而产生跳动
- 在不同屏幕尺寸下都有良好的显示效果

## 启动项目进行测试

```bash
cd frontend
npm run dev
```

然后在浏览器中访问 `http://localhost:5173` 进行测试。
