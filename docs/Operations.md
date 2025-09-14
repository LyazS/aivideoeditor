# 音视频编辑 SDK 文档

本文档详细描述了 `useHistoryOperations.ts` 中所有操作及其参数类型。

## 时间码格式
`HH:MM:SS.FF`，例如 `01:02:03.04`，表示第1小时2分3秒4帧，帧率为30帧/秒。

## SDK接口
```typescript
interface TimelineItemData {
  mediaItemId: string; // 媒体项目ID
  trackId: string; // 轨道ID
  timeRange: {
    /** 时间轴开始时间（时间码） - 在整个项目时间轴上的开始位置 */
    start: string;
    /** 时间轴结束时间（时间码） - 在整个项目时间轴上的结束位置 */
    end: string;
  };
}

/**
 * 添加时间轴项目
 * @param timelineItem 要添加的时间轴项目数据
 */
function addTimelineItem(timelineItem: TimelineItemData);

/**
 * 删除时间轴项目
 * @param timelineItemId 要删除的时间轴项目ID
 */
function rmTimelineItem(timelineItemId: string);

/**
 * 移动时间轴项目
 * @param timelineItemId 要移动的时间轴项目ID
 * @param newPosition 新的时间位置（时间码）
 * @param newTrackId 新的轨道ID（可选）
 */
function mvTimelineItem(
  timelineItemId: string,
  newPosition: string,
  newTrackId?: string
);

/**
 * 更新变换属性（增强版）
 * @param timelineItemId 要更新的时间轴项目ID
 * @param newTransform 新的变换属性对象
 */
function updateTimelineItemTransform(
  timelineItemId: string,
  newTransform: TransformProperties
);

/**
 * 分割时间轴项目
 * @param timelineItemId 要分割的时间轴项目ID
 * @param splitPosition 分割时间点（时间码）
 */
function splitTimelineItem(timelineItemId: string, splitPosition: string);

/**
 * 复制时间轴项目
 * @param timelineItemId 要复制的时间轴项目ID
 * @param newPosition 新项目的时间位置（时间码，可选）
 * @param newTrackId 新项目的轨道ID（可选）
 */
function cpTimelineItem(
  timelineItemId: string,
  newPosition?: string,
  newTrackId?: string
);

/**
 * 调整时间轴项目大小
 * @param timelineItemId 要调整的时间轴项目ID
 * @param newTimeRange 新的时间范围对象
 */
function resizeTimelineItem(
  timelineItemId: string,
  newTimeRange: UnifiedTimeRange
);

/**
 * 添加轨道
 * @param type 轨道类型，默认为 'video'
 * @param position 插入位置（可选）
 */
function addTrack(type: UnifiedTrackType = "video", position?: number);

/**
 * 删除轨道
 * @param trackId 要删除的轨道ID
 */
function rmTrack(trackId: string);

/**
 * 重命名轨道
 * @param trackId 要重命名的轨道ID
 * @param newName 新名称
 */
function renameTrack(trackId: string, newName: string);

/**
 * 自动排列轨道
 * 根据轨道ID自动排列该轨道上的所有时间轴项目
 * @param trackId 要排列的轨道ID
 */
function autoArrangeTrack(trackId: string);

/**
 * 切换轨道可见性
 * @param trackId 要切换的轨道ID
 * @param visible 新的可见性状态（可选）
 */
function toggleTrackVisibility(trackId: string, visible?: boolean);

/**
 * 切换轨道静音
 * @param trackId 要切换的轨道ID
 * @param muted 新的静音状态（可选）
 */
function toggleTrackMute(trackId: string, muted?: boolean);

/**
 * 更新文本内容
 * @param timelineItemId 要更新的时间轴项目ID
 * @param newText 新的文本内容
 * @param newStyle 新的文本样式（可选）
 */
function updateTextContent(
  timelineItemId: string,
  newText: string,
  newStyle?: Partial<TextStyleConfig>
);

/**
 * 更新文本样式
 * @param timelineItemId 要更新的时间轴项目ID
 * @param newStyle 新的文本样式配置
 */
function updateTextStyle(
  timelineItemId: string,
  newStyle: Partial<TextStyleConfig>
);

/**
 * 创建关键帧
 * @param timelineItemId 时间轴项目ID
 * @param position 关键帧位置（时间码）
 */
function createKeyframe(timelineItemId: string, position: string);

/**
 * 删除关键帧
 * @param timelineItemId 时间轴项目ID
 * @param position 关键帧位置（时间码）
 */
function deleteKeyframe(timelineItemId: string, position: string);

/**
 * 更新关键帧属性
 * @param timelineItemId 时间轴项目ID
 * @param position 关键帧位置（时间码）
 * @param property 属性名
 * @param value 新值
 */
function updateKeyframeProperty(
  timelineItemId: string,
  position: string,
  property: string,
  value: any
);

/**
 * 清除所有关键帧
 * @param timelineItemId 时间轴项目ID
 */
function clearAllKeyframes(timelineItemId: string);
```
