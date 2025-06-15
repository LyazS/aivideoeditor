# Store Utils 工具函数模块

这个模块包含了从 `videostore.ts` 中提取出来的工具函数，用于提高代码的可维护性和可测试性。

## 模块结构

### 调试信息工具

- `printDebugInfo(operation, details, mediaItems, timelineItems, tracks)` - 打印详细的调试信息，包括操作详情、素材库状态、时间轴状态等

### 时间计算工具

- `alignTimeToFrame(time, frameRate)` - 将时间对齐到帧边界
- `timeToPixel(time, timelineWidth, totalDuration, zoomLevel, scrollOffset)` - 将时间转换为像素位置
- `pixelToTime(pixel, timelineWidth, totalDuration, zoomLevel, scrollOffset)` - 将像素位置转换为时间
- `expandTimelineIfNeeded(targetTime, timelineDuration)` - 动态扩展时间轴长度

### 查找工具

- `getTimelineItemAtTime(time, timelineItems)` - 根据时间查找对应的时间轴项目

### 自动整理工具

- `autoArrangeTimelineItems(timelineItems)` - 自动整理时间轴项目，按轨道分组并在每个轨道内按时间排序

## 使用方式

```typescript
import {
  printDebugInfo,
  alignTimeToFrame,
  timeToPixel,
  pixelToTime,
  expandTimelineIfNeeded,
  getTimelineItemAtTime,
  autoArrangeTimelineItems
} from './utils/storeUtils'

// 在 store 中使用
export const useVideoStore = defineStore('video', () => {
  // ... 其他代码

  return {
    // 包装工具函数以提供正确的参数
    alignTimeToFrame: (time: number) => alignTimeToFrame(time, frameRate.value),
    timeToPixel: (time: number, timelineWidth: number) => 
      timeToPixel(time, timelineWidth, totalDuration.value, zoomLevel.value, scrollOffset.value),
    // ... 其他函数
  }
})
```

## 优势

1. **模块化**: 工具函数独立于主 store，便于维护和测试
2. **可复用性**: 工具函数可以在其他模块中复用
3. **可测试性**: 纯函数更容易编写单元测试
4. **代码清晰**: 减少主 store 文件的复杂度

## 测试

工具函数包含完整的单元测试，位于 `__tests__/storeUtils.test.ts` 文件中。

运行测试：
```bash
npm run test stores/utils
```
