# storeUtils 模块使用指南

## 📋 概述

本指南详细说明如何使用重构后的 storeUtils 模块。原始的 `storeUtils.ts` 文件已被拆分为10个独立的功能模块，每个模块专注于特定的功能领域。

## 🗂️ 模块概览

| 模块名 | 文件路径 | 主要功能 | 函数数量 |
|--------|----------|----------|----------|
| debugUtils | `stores/utils/debugUtils.ts` | 调试工具 | 1 |
| timeUtils | `stores/utils/timeUtils.ts` | 时间计算 | 5 |
| coordinateUtils | `stores/utils/coordinateUtils.ts` | 坐标转换 | 3 |
| timelineSearchUtils | `stores/utils/timelineSearchUtils.ts` | 查找工具 | 6 |
| timelineArrangementUtils | `stores/utils/timelineArrangementUtils.ts` | 自动整理 | 2 |
| zoomUtils | `stores/utils/zoomUtils.ts` | 缩放计算 | 3 |
| durationUtils | `stores/utils/durationUtils.ts` | 时长计算 | 3 |
| timeRangeUtils | `stores/utils/timeRangeUtils.ts` | 时间范围 | 3 |
| dataValidationUtils | `stores/utils/dataValidationUtils.ts` | 数据验证 | 2 |
| storeUtils | `stores/utils/storeUtils.ts` | 索引文件 | 重新导出 |

## 📖 详细使用指南

### 🐛 debugUtils.ts - 调试工具

**用途**: 调试信息打印和调试开关管理

```typescript
import { printDebugInfo } from '../stores/utils/debugUtils'

// 打印详细调试信息
printDebugInfo(
  '添加时间轴项目',
  { itemId: 'item-123' },
  mediaItems,
  timelineItems,
  tracks
)

// 全局调试开关（在浏览器控制台中使用）
window.enableTimelineDebug()  // 开启调试
window.disableTimelineDebug() // 关闭调试
```

### ⏰ timeUtils.ts - 时间计算工具

**用途**: 时间相关的计算、格式化和对齐

```typescript
import {
  alignTimeToFrame,
  calculatePixelsPerSecond,
  formatTime,
  formatTimeWithAutoPrecision,
  expandTimelineIfNeeded
} from '../stores/utils/timeUtils'

// 时间对齐到帧边界
const alignedTime = alignTimeToFrame(1.234, 30) // 对齐到30fps

// 计算每秒像素数
const pixelsPerSecond = calculatePixelsPerSecond(800, 60, 1.5)

// 格式化时间
const timeStr1 = formatTime(125.5) // "02:05"
const timeStr2 = formatTime(125.5, 'milliseconds') // "02:05.50"
const timeStr3 = formatTime(125.5, 'frames', 30) // "02:05:15"

// 自动精度格式化
const autoTimeStr = formatTimeWithAutoPrecision(125.5, 100, 30)

// 动态扩展时间轴
expandTimelineIfNeeded(150, timelineDurationRef)
```

### 📐 coordinateUtils.ts - 坐标转换工具

**用途**: 时间与像素位置的相互转换

```typescript
import {
  timeToPixel,
  pixelToTime,
  calculateVisibleTimeRange
} from '../stores/utils/coordinateUtils'

// 时间转像素
const pixelPos = timeToPixel(30, 800, 120, 1.5, 100)

// 像素转时间
const time = pixelToTime(400, 800, 120, 1.5, 100)

// 计算可见时间范围
const { startTime, endTime } = calculateVisibleTimeRange(
  800, 120, 1.5, 100, 240
)
```

### 🔍 timelineSearchUtils.ts - 查找工具

**用途**: 在时间轴中查找和过滤项目

```typescript
import {
  getTimelineItemAtTime,
  getTimelineItemsByTrack,
  findTimelineItemBySprite,
  getTimelineItemsAtTime,
  getTimelineItemAtTrackAndTime,
  findOrphanedTimelineItems
} from '../stores/utils/timelineSearchUtils'

// 根据时间查找项目
const item = getTimelineItemAtTime(30.5, timelineItems)

// 根据轨道查找项目
const trackItems = getTimelineItemsByTrack(1, timelineItems)

// 根据sprite查找项目
const spriteItem = findTimelineItemBySprite(sprite, timelineItems)

// 查找时间点的所有重叠项目
const overlappingItems = getTimelineItemsAtTime(30.5, timelineItems)

// 根据轨道和时间查找项目
const trackTimeItem = getTimelineItemAtTrackAndTime(1, 30.5, timelineItems)

// 查找孤立项目
const orphanedItems = findOrphanedTimelineItems(timelineItems, mediaItems)
```

### 🔧 timelineArrangementUtils.ts - 自动整理工具

**用途**: 自动整理和排序时间轴项目

```typescript
import {
  autoArrangeTrackItems,
  autoArrangeTimelineItems
} from '../stores/utils/timelineArrangementUtils'

// 整理单个轨道
autoArrangeTrackItems(timelineItemsRef, 1)

// 整理所有轨道
autoArrangeTimelineItems(timelineItemsRef)
```

### 🔍 zoomUtils.ts - 缩放计算工具

**用途**: 缩放级别和滚动偏移计算

```typescript
import {
  getMaxZoomLevel,
  getMinZoomLevel,
  getMaxScrollOffset
} from '../stores/utils/zoomUtils'

// 计算最大缩放级别
const maxZoom = getMaxZoomLevel(800, 30, 120)

// 计算最小缩放级别
const minZoom = getMinZoomLevel(120, 240)

// 计算最大滚动偏移
const maxScroll = getMaxScrollOffset(800, 1.5, 120, 240)
```

### ⏱️ durationUtils.ts - 时长计算工具

**用途**: 计算各种时长相关的值

```typescript
import {
  calculateContentEndTime,
  calculateTotalDuration,
  calculateMaxVisibleDuration
} from '../stores/utils/durationUtils'

// 计算内容结束时间
const endTime = calculateContentEndTime(timelineItems)

// 计算总时长
const totalDuration = calculateTotalDuration(timelineItems, 60)

// 计算最大可见时长
const maxVisible = calculateMaxVisibleDuration(120, 60)
```

### 📏 timeRangeUtils.ts - 时间范围工具

**用途**: 时间范围的同步、验证和计算

```typescript
import {
  syncTimeRange,
  validateTimeRange,
  calculateTimeRangeOverlap
} from '../stores/utils/timeRangeUtils'

// 同步时间范围
syncTimeRange(timelineItem, { timelineStartTime: 30000000 })

// 验证时间范围
const isValid = validateTimeRange(timeRange)

// 计算重叠时长
const overlap = calculateTimeRangeOverlap(range1, range2)
```

### ✅ dataValidationUtils.ts - 数据验证工具

**用途**: 数据完整性验证和清理

```typescript
import {
  validateDataIntegrity,
  cleanupInvalidReferences
} from '../stores/utils/dataValidationUtils'

// 验证数据完整性
const { isValid, errors, warnings } = validateDataIntegrity(
  mediaItems,
  timelineItems,
  tracks
)

// 清理无效引用
const cleanedCount = cleanupInvalidReferences(timelineItemsRef, mediaItems)
```

## 🔄 迁移指南

### 从旧版本迁移

如果您的代码目前使用旧的导入方式：

```typescript
// 旧方式（仍然有效）
import { formatTime, timeToPixel, autoArrangeTimelineItems } from './utils/storeUtils'
```

建议迁移到新的模块化导入：

```typescript
// 新方式（推荐）
import { formatTime } from './utils/timeUtils'
import { timeToPixel } from './utils/coordinateUtils'
import { autoArrangeTimelineItems } from './utils/timelineArrangementUtils'
```

### 批量迁移脚本

可以使用以下正则表达式进行批量替换：

```bash
# 查找所有从 storeUtils 导入的文件
grep -r "from.*storeUtils" src/

# 替换导入语句（需要根据具体函数调整）
sed -i 's/from.*storeUtils/from specific-module/g' file.ts
```

## 🎯 最佳实践

1. **按需导入**: 只导入需要的函数，避免导入整个模块
2. **类型安全**: 确保导入了正确的类型定义
3. **模块选择**: 根据功能选择合适的模块，避免跨模块调用
4. **性能考虑**: 优先使用直接模块导入以获得更好的tree-shaking效果

## 📚 相关文档

- [重构总结文档](./storeUtils-refactoring-summary.md)
- [职责分离分析](./responsibility-separation-analysis.md)
- [Store Utils README](../../frontend/src/stores/utils/README.md)
