# Store Utils 工具函数模块

这个模块已经重构为多个独立的工具模块，每个模块专注于特定的功能领域，提高了代码的可维护性、可测试性和可复用性。

## 📁 模块结构

### 🐛 调试工具 (`debugUtils.ts`)
- `printDebugInfo(operation, details, mediaItems, timelineItems, tracks)` - 打印详细的调试信息
- 全局调试开关管理 (`window.enableTimelineDebug()`, `window.disableTimelineDebug()`)

### ⏰ 时间计算工具 (`timeUtils.ts`)
- `alignTimeToFrame(time, frameRate)` - 将时间对齐到帧边界
- `calculatePixelsPerSecond(timelineWidth, totalDuration, zoomLevel)` - 计算每秒像素数
- `formatTime(seconds, precision?, frameRate?)` - 格式化时间显示
- `formatTimeWithAutoPrecision(seconds, pixelsPerSecond, frameRate?)` - 根据缩放级别自动选择时间显示精度
- `expandTimelineIfNeeded(targetTime, timelineDuration)` - 动态扩展时间轴长度

### 📐 坐标转换工具 (`coordinateUtils.ts`)
- `timecodeToPixel(timecode, timelineWidth, totalDuration, zoomLevel, scrollOffset)` - 将Timecode转换为像素位置
- `pixelToTimecode(pixel, timelineWidth, totalDuration, zoomLevel, scrollOffset)` - 将像素位置转换为Timecode
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
- `getMaxZoomLevel(timelineWidth, frameRate, totalDuration)` - 计算最大缩放级别
- `getMinZoomLevel(totalDuration, maxVisibleDuration)` - 计算最小缩放级别
- `getMaxScrollOffset(timelineWidth, zoomLevel, totalDuration, maxVisibleDuration)` - 计算最大滚动偏移量

### ⏱️ 时长计算工具 (`durationUtils.ts`)
- `calculateContentEndTime(timelineItems)` - 计算内容结束时间
- `calculateTotalDuration(timelineItems, timelineDuration)` - 计算总时长
- `calculateMaxVisibleDuration(contentEndTime, defaultDuration?)` - 计算最大可见时长

### 📏 时间范围工具 (`timeRangeUtils.ts`)
- `syncTimeRange(timelineItem, newTimeRange?)` - 同步TimelineItem和sprite的timeRange
- `validateTimeRange(timeRange)` - 验证时间范围是否有效
- `calculateTimeRangeOverlap(range1, range2)` - 计算时间范围重叠

### ✅ 数据验证工具 (`dataValidationUtils.ts`)
- `validateDataIntegrity(mediaItems, timelineItems, tracks)` - 验证数据完整性
- `cleanupInvalidReferences(timelineItems, mediaItems)` - 清理无效的引用

## 📖 使用方式

### 推荐方式：直接导入具体模块

```typescript
// 推荐：按需导入具体模块，获得更好的tree-shaking效果
import { formatTime, alignTimeToFrame } from './utils/timeUtils'
import { timecodeToPixel, pixelToTimecode } from './utils/coordinateUtils'
import { autoArrangeTimelineItems } from './utils/timelineArrangementUtils'
import { getTimelineItemAtTime } from './utils/timelineSearchUtils'
import { printDebugInfo } from './utils/debugUtils'
```

### 兼容方式：通过索引文件导入

```typescript
// 兼容：通过索引文件导入（仍然有效，但不推荐）
import {
  printDebugInfo,
  alignTimeToFrame,
  timecodeToPixel,
  pixelToTimecode,
  expandTimelineIfNeeded,
  getTimelineItemAtTime,
  autoArrangeTimelineItems,
  calculatePixelsPerSecond,
  calculateVisibleTimeRange,
  formatTime,
  formatTimeWithAutoPrecision,
} from './utils/storeUtils'
```

### 在 Store 中使用

```typescript
// 在 store 中使用
export const useVideoStore = defineStore('video', () => {
  // ... 其他代码

  return {
    // 包装工具函数以提供正确的参数
    alignTimeToFrame: (time: number) => alignTimeToFrame(time, frameRate.value),
    timecodeToPixel: (timecode: Timecode, timelineWidth: number) =>
      timecodeToPixel(timecode, timelineWidth, totalDurationTimecode.value, zoomLevel.value, scrollOffset.value),
    // ... 其他函数
  }
})
```

### 在组件中使用

```typescript
// 在 Vue 组件中使用
<script setup lang="ts">
import { formatTime } from '../stores/utils/timeUtils'
import { timecodeToPixel } from '../stores/utils/coordinateUtils'
import { Timecode } from '../utils/Timecode'

// 直接使用工具函数
const formattedTime = formatTime(125.5, 'milliseconds') // "02:05.50"
const timecode = new Timecode(900, 30) // 30秒，30fps
const totalDuration = new Timecode(3600, 30) // 2分钟
const pixelPosition = timecodeToPixel(timecode, 800, totalDuration, 1.5, 100)
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
1. **按需导入**: 减少不必要的代码加载
2. **更好的tree-shaking**: 构建工具可以更有效地移除未使用代码
3. **模块缓存**: 浏览器可以更好地缓存独立模块

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

## 🔄 迁移指南

### 从旧版本迁移

如果您的代码目前使用旧的 `storeUtils.ts` 导入方式：

```typescript
// 旧方式（已废弃）
import { formatTime, timeToPixel } from './utils/storeUtils'
```

建议迁移到新的模块化导入：

```typescript
// 新方式（推荐）
import { formatTime } from './utils/timeUtils'
import { timecodeToPixel } from './utils/coordinateUtils'
```

### 迁移步骤

1. **识别使用的函数**: 查看当前导入的函数列表
2. **查找对应模块**: 参考上面的模块结构，找到函数所属的模块
3. **更新导入语句**: 将导入改为直接从具体模块导入
4. **测试功能**: 确保迁移后功能正常工作

## ⚠️ 注意事项

1. **向后兼容**: 原有的导入方式仍然有效，可以渐进式迁移
2. **依赖关系**: 某些模块之间存在依赖关系，注意导入顺序
3. **类型定义**: 确保导入了正确的类型定义
4. **调试开关**: 调试相关的全局变量仍然通过 `debugUtils.ts` 管理

## 📚 相关文档

- [重构总结文档](../../../docs/refactoring/storeUtils-refactoring-summary.md)
- [职责分离分析](../../../docs/refactoring/responsibility-separation-analysis.md)
- [时间计算统一化](../../../docs/refactoring/time-calculation-unification.md)
