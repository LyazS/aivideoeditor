# Store Utils 工具函数模块

这个模块已经重构为多个独立的工具模块，每个模块专注于特定的功能领域，提高了代码的可维护性、可测试性和可复用性。

## 📁 模块结构

### 🐛 调试工具 (`debugUtils.ts`)

- `printDebugInfo(operation, details, mediaItems, timelineItems, tracks)` - 打印详细的调试信息
- 全局调试开关管理 (`window.enableTimelineDebug()`, `window.disableTimelineDebug()`)

### ⏰ 时间计算工具 (`timeUtils.ts`)

- `calculatePixelsPerFrame(timelineWidth, totalDurationFrames, zoomLevel)` - 计算每帧像素数
- `expandTimelineIfNeededFrames(targetFrames, timelineDurationFrames)` - 动态扩展时间轴长度（帧数版本）
- `framesToTimecode(frames, frameRate?)` - 将帧数转换为时间码格式
- `timecodeToFrames(timecode, frameRate?)` - 将时间码转换为帧数
- `framesToMicroseconds(frames, frameRate?)` - 将帧数转换为微秒（WebAV接口）
- `microsecondsToFrames(microseconds, frameRate?)` - 将微秒转换为帧数

### 📐 坐标转换工具 (`coordinateUtils.ts`)

- `timeToPixel(time, timelineWidth, totalDuration, zoomLevel, scrollOffset)` - 将时间转换为像素位置
- `pixelToTime(pixel, timelineWidth, totalDuration, zoomLevel, scrollOffset)` - 将像素位置转换为时间
- `calculateVisibleTimeRange(timelineWidth, totalDuration, zoomLevel, scrollOffset, maxVisibleDuration?)` - 计算可见时间范围

### 🔍 查找工具 (`timelineSearchUtils.ts`)

- `getTimelineItemAtTime(time, timelineItems)` - 根据时间查找对应的时间轴项目
- `getTimelineItemsByTrack(trackId, timelineItems)` - 根据轨道ID查找时间轴项目
- `findTimelineItemBySprite(sprite, timelineItems)` - 根据sprite查找时间轴项目
- `getTimelineItemsAtTime(time, timelineItems)` - 根据时间查找所有重叠的时间轴项目
- `getTimelineItemAtTrackAndTime(trackId, time, timelineItems)` - 根据轨道和时间查找时间轴项目
- `findOrphanedTimelineItems(timelineItems, mediaItems)` - 查找孤立的时间轴项目

### 🔧 自动整理工具 (`timelineArrangementUtils.ts`)

- `autoArrangeTimelineItems(timelineItems)` - 自动整理时间轴项目，按轨道分组并在每个轨道内按时间排序
- `autoArrangeTrackItems(timelineItems, trackId)` - 自动整理单个轨道的时间轴项目

### 🔍 缩放计算工具 (`zoomUtils.ts`)

- `getMaxZoomLevelFrames(timelineWidth, totalDurationFrames)` - 计算最大缩放级别（帧数版本）
- `getMinZoomLevelFrames(totalDurationFrames, maxVisibleDurationFrames)` - 计算最小缩放级别（帧数版本）
- `getMaxScrollOffsetFrames(timelineWidth, zoomLevel, totalDurationFrames, maxVisibleDurationFrames)` - 计算最大滚动偏移量（帧数版本）

### ⏱️ 时长计算工具 (`durationUtils.ts`)

- `calculateContentEndTimeFrames(timelineItems)` - 计算内容结束时间（帧数版本）
- `calculateTotalDurationFrames(timelineItems, timelineDurationFrames)` - 计算总时长（帧数版本）
- `calculateMaxVisibleDurationFrames(contentEndTimeFrames, defaultDurationFrames?)` - 计算最大可见时长（帧数版本）

### 📏 时间范围工具 (`timeRangeUtils.ts`)

- `syncTimeRange(timelineItem, newTimeRange?)` - 同步TimelineItem和sprite的timeRange
- `validateTimeRange(timeRange)` - 验证时间范围是否有效
- `calculateTimeRangeOverlap(range1, range2)` - 计算时间范围重叠

### ✅ 数据验证工具 (`dataValidationUtils.ts`)

- `validateDataIntegrity(mediaItems, timelineItems, tracks)` - 验证数据完整性
- `cleanupInvalidReferences(timelineItems, mediaItems)` - 清理无效的引用

## 📖 使用方式

### 直接导入具体模块

```typescript
// 按需导入具体模块，获得最佳的tree-shaking效果
import { framesToTimecode, timecodeToFrames } from './utils/timeUtils'
import { frameToPixel, pixelToFrame } from './utils/coordinateUtils'
import { autoArrangeTimelineItems } from './utils/timelineArrangementUtils'
import { getTimelineItemAtFrames } from './utils/timelineSearchUtils'
import { printDebugInfo } from './utils/debugUtils'
```

### 在 Store 中使用

```typescript
// 在 store 中使用
import { frameToPixel, pixelToFrame } from './utils/coordinateUtils'
import { expandTimelineIfNeededFrames } from './utils/timeUtils'
import { autoArrangeTimelineItems } from './utils/timelineArrangementUtils'

export const useVideoStore = defineStore('video', () => {
  // ... 其他代码

  return {
    // 包装工具函数以提供正确的参数（帧数版本）
    frameToPixel: (frames: number, timelineWidth: number) =>
      frameToPixel(
        frames,
        timelineWidth,
        totalDurationFrames.value,
        zoomLevel.value,
        scrollOffset.value,
      ),
    pixelToFrame: (pixel: number, timelineWidth: number) =>
      pixelToFrame(
        pixel,
        timelineWidth,
        totalDurationFrames.value,
        zoomLevel.value,
        scrollOffset.value,
      ),
    // ... 其他函数
  }
})
```

### 在组件中使用

```typescript
// 在 Vue 组件中使用
<script setup lang="ts">
import { framesToTimecode, formatFileSize } from '../stores/utils/timeUtils'
import { frameToPixel } from '../stores/utils/coordinateUtils'

// 直接使用工具函数
const formattedTime = framesToTimecode(3750) // "02:05.00"
const pixelPosition = frameToPixel(900, 800, 3600, 1.5, 100)
const fileSize = formatFileSize(1024 * 1024) // "1.0 MB"
</script>
```

## ✨ 重构优势

### 代码质量提升

1. **职责清晰**: 每个模块专注于单一功能领域
2. **易于维护**: 更小的文件，更清晰的结构
3. **可测试性**: 可以为每个模块编写独立的单元测试
4. **类型安全**: 统一的函数签名和参数验证

### 开发效率提升

1. **更好的代码导航**: 功能分类明确，快速定位相关代码
2. **减少认知负担**: 开发者更容易理解特定功能
3. **提高复用性**: 其他项目可选择性使用特定模块
4. **IDE支持**: 更好的自动补全和类型提示

### 性能优化

1. **按需导入**: 只导入实际使用的函数，减少不必要的代码加载
2. **最佳的tree-shaking**: 直接从具体模块导入，构建工具可以精确移除未使用代码
3. **模块缓存**: 浏览器可以更好地缓存独立模块
4. **避免中间层**: 移除统一导出文件，减少模块解析开销

## 🧪 测试

每个模块都应该包含独立的单元测试：

```bash
# 运行所有工具模块测试
npm run test stores/utils

# 运行特定模块测试
npm run test stores/utils/timeUtils.test.ts
npm run test stores/utils/coordinateUtils.test.ts
```

### 测试文件结构

```
__tests__/
├── timeUtils.test.ts
├── coordinateUtils.test.ts
├── timelineSearchUtils.test.ts
├── timelineArrangementUtils.test.ts
├── zoomUtils.test.ts
├── durationUtils.test.ts
├── timeRangeUtils.test.ts
├── dataValidationUtils.test.ts
└── debugUtils.test.ts
```

## ⚠️ 注意事项

1. **模块依赖**: 某些模块之间存在依赖关系，注意导入顺序
2. **类型定义**: 确保导入了正确的类型定义
3. **调试开关**: 调试相关的全局变量通过 `debugUtils.ts` 管理
4. **帧数精度**: 所有时间相关计算都基于帧数，确保精度一致性
