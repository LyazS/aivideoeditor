# Unified 架构导入修改计划

## 需要修改的导入语句

| 文件路径 | 当前的相对路径导入 | 需要修改为 | 状态 |
|---------|-----------------|-----------|------|
| frontend/src/unified/index.ts | from './sources/BaseDataSource' | from '@unified/sources/BaseDataSource' | 待修改 |
| frontend/src/unified/index.ts | from './sources/DataSourceTypes' | from '@unified/sources/DataSourceTypes' | 待修改 |
| frontend/src/unified/index.ts | from './sources/UserSelectedFileSource' | from '@unified/sources/UserSelectedFileSource' | 待修改 |
| frontend/src/unified/index.ts | from './sources/RemoteFileSource' | from '@unified/sources/RemoteFileSource' | 待修改 |
| frontend/src/unified/index.ts | from './managers/BaseDataSourceManager' | from '@unified/managers/BaseDataSourceManager' | 待修改 |
| frontend/src/unified/index.ts | from './managers/UserSelectedFileManager' | from '@unified/managers/UserSelectedFileManager' | 待修改 |
| frontend/src/unified/index.ts | from './managers/RemoteFileManager' | from '@unified/managers/RemoteFileManager' | 待修改 |
| frontend/src/unified/index.ts | from './managers/DataSourceManagerRegistry' | from '@unified/managers/DataSourceManagerRegistry' | 待修改 |
| frontend/src/unified/index.ts | from './mediaitem' | from '@unified/mediaitem' | 待修改 |
| frontend/src/unified/index.ts | from './utils/mediaTypeDetector' | from '@unified/utils/mediaTypeDetector' | 待修改 |
| frontend/src/unified/index.ts | from './track' | from '@unified/track' | 待修改 |
| frontend/src/unified/index.ts | from './timelineitem' | from '@unified/timelineitem' | 待修改 |
| frontend/src/unified/index.ts | from './modules/UnifiedTrackModule' | from '@unified/modules/UnifiedTrackModule' | 待修改 |
| frontend/src/unified/index.ts | from './modules/UnifiedMediaModule' | from '@unified/modules/UnifiedMediaModule' | 待修改 |
| frontend/src/unified/index.ts | from './modules/UnifiedTimelineModule' | from '@unified/modules/UnifiedTimelineModule' | 待修改 |
| frontend/src/unified/index.ts | from './modules/UnifiedViewportModule' | from '@unified/modules/UnifiedViewportModule' | 待修改 |
| frontend/src/unified/index.ts | from './modules/UnifiedSelectionModule' | from '@unified/modules/UnifiedSelectionModule' | 待修改 |
| frontend/src/unified/index.ts | from './modules/UnifiedClipOperationsModule' | from '@unified/modules/UnifiedClipOperationsModule' | 待修改 |
| frontend/src/unified/index.ts | from './utils' | from '@unified/utils' | 待修改 |
| frontend/src/unified/index.ts | from './composables' | from '@unified/composables' | 待修改 |
| frontend/src/unified/index.ts | from './types' | from '@unified/types' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedMediaModule' | from '@unified/modules/UnifiedMediaModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedTrackModule' | from '@unified/modules/UnifiedTrackModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedTimelineModule' | from '@unified/modules/UnifiedTimelineModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedProjectModule' | from '@unified/modules/UnifiedProjectModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedViewportModule' | from '@unified/modules/UnifiedViewportModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedSelectionModule' | from '@unified/modules/UnifiedSelectionModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedClipOperationsModule' | from '@unified/modules/UnifiedClipOperationsModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedConfigModule' | from '@unified/modules/UnifiedConfigModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedPlaybackModule' | from '@unified/modules/UnifiedPlaybackModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedWebavModule' | from '@unified/modules/UnifiedWebavModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedNotificationModule' | from '@unified/modules/UnifiedNotificationModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/UnifiedHistoryModule' | from '@unified/modules/UnifiedHistoryModule' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './utils/durationUtils' | from '@unified/utils/durationUtils' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from '@/unified' | from '@unified' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './track/TrackTypes' | from '@unified/track/TrackTypes' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './timelineitem/TimelineItemData' | from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from '../types' | from '@types' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './timelineitem/TimelineItemData' | from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './types/timeRange' | from '@unified/types/timeRange' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './utils/coordinateUtils' | from '@unified/utils/coordinateUtils' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './utils/timeUtils' | from '@unified/utils/timeUtils' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './utils/timelineSearchUtils' | from '@unified/utils/timelineSearchUtils' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './timelineitem/TimelineItemQueries' | from '@unified/timelineitem/TimelineItemQueries' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './timelineitem/TimelineItemFactory' | from '@unified/timelineitem/TimelineItemFactory' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/commands/timelineCommands' | from '@unified/modules/commands/timelineCommands' | 待修改 |
| frontend/src/unified/unifiedStore.ts | from './modules/commands/batchCommands' | from '@unified/modules/commands/batchCommands' | 待修改 |
| frontend/src/unified/components/UnifiedClipManagementToolbar.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedClipManagementToolbar.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedClipManagementToolbar.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/UnifiedClipManagementToolbar.vue | import { TrackData } from '@/types/track' | import { TrackData } from '@types/track' | 待修改 |
| frontend/src/unified/components/UnifiedClipTooltip.vue | import type { MediaTypeOrUnknown } from '../mediaitem/types' | import type { MediaTypeOrUnknown } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/components/UnifiedMediaLibrary.vue | import { useUnifiedStore } from '@/unified/unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedMediaLibrary.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedMediaLibrary.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/UnifiedPlaybackControls.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedPlaybackControls.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedPlaybackControls.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/UnifiedPlayhead.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedPlayhead.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedPlayhead.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/UnifiedPropertiesPanel.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedPropertiesPanel.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedPropertiesPanel.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/UnifiedPropertiesPanel.vue | import { TrackData } from '@/types/track' | import { TrackData } from '@types/track' | 待修改 |
| frontend/src/unified/components/UnifiedPropertiesPanel.vue | import UnifiedVideoClipProperties from './properties/UnifiedVideoClipProperties.vue' | import UnifiedVideoClipProperties from '@unified/components/properties/UnifiedVideoClipProperties.vue' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { TrackData } from '@/types/track' | import { TrackData } from '@types/track' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import UnifiedTimelineClip from './UnifiedTimelineClip.vue' | import UnifiedTimelineClip from '@unified/components/UnifiedTimelineClip.vue' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import UnifiedTimeScale from './UnifiedTimeScale.vue' | import UnifiedTimeScale from '@unified/components/UnifiedTimeScale.vue' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import UnifiedPlayhead from './UnifiedPlayhead.vue' | import UnifiedPlayhead from '@unified/components/UnifiedPlayhead.vue' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import UnifiedClipManagementToolbar from './UnifiedClipManagementToolbar.vue' | import UnifiedClipManagementToolbar from '@unified/components/UnifiedClipManagementToolbar.vue' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { useUnifiedKeyframeTimelineControls } from '../composables' | import { useUnifiedKeyframeTimelineControls } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { useUnifiedDragDrop } from '../composables' | import { useUnifiedDragDrop } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { useUnifiedSelection } from '../composables' | import { useUnifiedSelection } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { useUnifiedClipboard } from '../composables' | import { useUnifiedClipboard } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimeline.vue | import { useUnifiedKeyboardShortcuts } from '../composables' | import { useUnifiedKeyboardShortcuts } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimelineClip.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedTimelineClip.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedTimelineClip.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/UnifiedTimelineClip.vue | import { TrackData } from '@/types/track' | import { TrackData } from '@types/track' | 待修改 |
| frontend/src/unified/components/UnifiedTimelineClip.vue | import { useUnifiedDragDrop } from '../composables' | import { useUnifiedDragDrop } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimelineClip.vue | import { useUnifiedSelection } from '../composables' | import { useUnifiedSelection } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimelineClip.vue | import { useUnifiedClipboard } from '../composables' | import { useUnifiedClipboard } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/UnifiedTimeScale.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/UnifiedTimeScale.vue | import { useMainStore } from '@/store' | import { useMainStore } from '@store' | 待修改 |
| frontend/src/unified/components/UnifiedTimeScale.vue | import { TimelineItemData } from '@/types/timeline' | import { TimelineItemData } from '@types/timeline' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import { useUnifiedStore } from '../../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import { isVideoTimelineItem, isImageTimelineItem, hasVisualProperties, hasAudioProperties } from '../../timelineitem/TimelineItemQueries' | import { isVideoTimelineItem, isImageTimelineItem, hasVisualProperties, hasAudioProperties } from '@unified/timelineitem/TimelineItemQueries' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import { framesToTimecode, timecodeToFrames } from '../../utils/timeUtils' | import { framesToTimecode, timecodeToFrames } from '@unified/utils/timeUtils' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import { useUnifiedKeyframeTransformControls } from '../../composables' | import { useUnifiedKeyframeTransformControls } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import NumberInput from '../../../components/NumberInput.vue' | import NumberInput from '@components/NumberInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import SliderInput from '../../../components/SliderInput.vue' | import SliderInput from '@components/SliderInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import UnifiedKeyframeControls from './UnifiedKeyframeControls.vue' | import UnifiedKeyframeControls from '@unified/components/properties/UnifiedKeyframeControls.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | import UnifiedTransformControls from './UnifiedTransformControls.vue' | import UnifiedTransformControls from '@unified/components/properties/UnifiedTransformControls.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | const { adjustKeyframesForDurationChange } = await import('../../utils/unifiedKeyframeUtils') | const { adjustKeyframesForDurationChange } = await import('@unified/utils/unifiedKeyframeUtils') | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | const { syncTimeRange } = await import('../../utils/timeRangeUtils') | const { syncTimeRange } = await import('@unified/utils/timeRangeUtils') | 待修改 |
| frontend/src/unified/components/properties/UnifiedVideoClipProperties.vue | const { updateWebAVAnimation } = await import('../../utils/webavAnimationManager') | const { updateWebAVAnimation } = await import('@unified/utils/webavAnimationManager') | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import { useUnifiedStore } from '../../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import { isTextTimelineItem } from '../../timelineitem/TimelineItemQueries' | import { isTextTimelineItem } from '@unified/timelineitem/TimelineItemQueries' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import type { TextStyleConfig } from '../../timelineitem/TimelineItemData' | import type { TextStyleConfig } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import { framesToTimecode, timecodeToFrames } from '../../utils/timeUtils' | import { framesToTimecode, timecodeToFrames } from '@unified/utils/timeUtils' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import { useUnifiedKeyframeTransformControls } from '../../composables' | import { useUnifiedKeyframeTransformControls } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import NumberInput from '../../../components/NumberInput.vue' | import NumberInput from '@components/NumberInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import SliderInput from '../../../components/SliderInput.vue' | import SliderInput from '@components/SliderInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import UnifiedKeyframeControls from './UnifiedKeyframeControls.vue' | import UnifiedKeyframeControls from '@unified/components/properties/UnifiedKeyframeControls.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | import UnifiedTransformControls from './UnifiedTransformControls.vue' | import UnifiedTransformControls from '@unified/components/properties/UnifiedTransformControls.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | const { UpdateTextCommand } = await import('../../modules/commands/UpdateTextCommand') | const { UpdateTextCommand } = await import('@unified/modules/commands/UpdateTextCommand') | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | const { adjustKeyframesForDurationChange } = await import('../../utils/unifiedKeyframeUtils') | const { adjustKeyframesForDurationChange } = await import('@unified/utils/unifiedKeyframeUtils') | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | const { syncTimeRange } = await import('../../utils/timeRangeUtils') | const { syncTimeRange } = await import('@unified/utils/timeRangeUtils') | 待修改 |
| frontend/src/unified/components/properties/UnifiedTextClipProperties.vue | const { updateWebAVAnimation } = await import('../../utils/webavAnimationManager') | const { updateWebAVAnimation } = await import('@unified/utils/webavAnimationManager') | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import { useUnifiedStore } from '../../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import { isAudioTimelineItem, hasAudioProperties } from '../../timelineitem/TimelineItemQueries' | import { isAudioTimelineItem, hasAudioProperties } from '@unified/timelineitem/TimelineItemQueries' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import { framesToTimecode, timecodeToFrames } from '../../utils/timeUtils' | import { framesToTimecode, timecodeToFrames } from '@unified/utils/timeUtils' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import { useUnifiedKeyframeTransformControls } from '../../composables' | import { useUnifiedKeyframeTransformControls } from '@unified/composables' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import NumberInput from '../../../components/NumberInput.vue' | import NumberInput from '@components/NumberInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import SliderInput from '../../../components/SliderInput.vue' | import SliderInput from '@components/SliderInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | import UnifiedKeyframeControls from './UnifiedKeyframeControls.vue' | import UnifiedKeyframeControls from '@unified/components/properties/UnifiedKeyframeControls.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | const { adjustKeyframesForDurationChange } = await import('../../utils/unifiedKeyframeUtils') | const { adjustKeyframesForDurationChange } = await import('@unified/utils/unifiedKeyframeUtils') | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | const { syncTimeRange } = await import('../../utils/timeRangeUtils') | const { syncTimeRange } = await import('@unified/utils/timeRangeUtils') | 待修改 |
| frontend/src/unified/components/properties/UnifiedAudioClipProperties.vue | const { updateWebAVAnimation } = await import('../../utils/webavAnimationManager') | const { updateWebAVAnimation } = await import('@unified/utils/webavAnimationManager') | 待修改 |
| frontend/src/unified/components/properties/UnifiedKeyframeControls.vue | import NumberInput from '../../../components/NumberInput.vue' | import NumberInput from '@components/NumberInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedKeyframeControls.vue | import SliderInput from '../../../components/SliderInput.vue' | import SliderInput from '@components/SliderInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTransformControls.vue | import NumberInput from '../../../components/NumberInput.vue' | import NumberInput from '@components/NumberInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTransformControls.vue | import SliderInput from '../../../components/SliderInput.vue' | import SliderInput from '@components/SliderInput.vue' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTransformControls.vue | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/properties/UnifiedTransformControls.vue | import { useUnifiedKeyframeUI } from '../../composables/useUnifiedKeyframeUI' | import { useUnifiedKeyframeUI } from '@unified/composables/useUnifiedKeyframeUI' | 待修改 |
| frontend/src/unified/components/renderers/ContentRendererFactory.ts | import type { ContentRenderer, ContentRenderContext } from '../../types/clipRenderer' | import type { ContentRenderer, ContentRenderContext } from '@unified/types/clipRenderer' | 待修改 |
| frontend/src/unified/components/renderers/ContentRendererFactory.ts | import type { UnifiedTimelineItemData } from '../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/renderers/ContentRendererFactory.ts | import type { MediaType } from '../../mediaitem/types' | import type { MediaType } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/components/renderers/ContentRendererFactory.ts | import type { TimelineItemStatus } from '../../timelineitem/TimelineItemData' | import type { TimelineItemStatus } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/renderers/ContentRendererFactory.ts | import { getTimelineItemDisplayName } from '../../utils/clipUtils' | import { getTimelineItemDisplayName } from '@unified/utils/clipUtils' | 待修改 |
| frontend/src/unified/components/renderers/ContentRendererFactory.ts | import { LoadingContentRenderer, ErrorContentRenderer } from './status' | import { LoadingContentRenderer, ErrorContentRenderer } from '@unified/components/renderers/status' | 待修改 |
| frontend/src/unified/components/renderers/ContentRendererFactory.ts | import { VideoContentRenderer, AudioContentRenderer, TextContentRenderer } from './mediatype' | import { VideoContentRenderer, AudioContentRenderer, TextContentRenderer } from '@unified/components/renderers/mediatype' | 待修改 |
| frontend/src/unified/components/renderers/index.ts | export type { ContentRenderer, ContentRenderContext, StatusRendererType, MediaTypeRendererType, RendererType, } from '../../types/clipRenderer' | export type { ContentRenderer, ContentRenderContext, StatusRendererType, MediaTypeRendererType, RendererType, } from '@unified/types/clipRenderer' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/AudioContentRenderer.ts | import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer' | import type { ContentRenderer, ContentRenderContext } from '@unified/types/clipRenderer' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/AudioContentRenderer.ts | import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/AudioContentRenderer.ts | import { getTimelineItemDisplayName } from '../../../utils/clipUtils' | import { getTimelineItemDisplayName } from '@unified/utils/clipUtils' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/index.ts | export { VideoContentRenderer } from './VideoContentRenderer' | export { VideoContentRenderer } from '@unified/components/renderers/mediatype/VideoContentRenderer' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/index.ts | export { AudioContentRenderer } from './AudioContentRenderer' | export { AudioContentRenderer } from '@unified/components/renderers/mediatype/AudioContentRenderer' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/index.ts | export { TextContentRenderer } from './TextContentRenderer' | export { TextContentRenderer } from '@unified/components/renderers/mediatype/TextContentRenderer' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/TextContentRenderer.ts | import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer' | import type { ContentRenderer, ContentRenderContext } from '@unified/types/clipRenderer' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/TextContentRenderer.ts | import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/TextContentRenderer.ts | import { getTimelineItemDisplayName } from '../../../utils/clipUtils' | import { getTimelineItemDisplayName } from '@unified/utils/clipUtils' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/VideoContentRenderer.ts | import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer' | import type { ContentRenderer, ContentRenderContext } from '@unified/types/clipRenderer' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/VideoContentRenderer.ts | import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/renderers/mediatype/VideoContentRenderer.ts | import { getTimelineItemDisplayName } from '../../../utils/clipUtils' | import { getTimelineItemDisplayName } from '@unified/utils/clipUtils' | 待修改 |
| frontend/src/unified/components/renderers/status/ErrorContentRenderer.ts | import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer' | import type { ContentRenderer, ContentRenderContext } from '@unified/types/clipRenderer' | 待修改 |
| frontend/src/unified/components/renderers/status/ErrorContentRenderer.ts | import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/renderers/status/ErrorContentRenderer.ts | import type { MediaType } from '../../../mediaitem/types' | import type { MediaType } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/components/renderers/status/ErrorContentRenderer.ts | import { getTimelineItemDisplayName } from '../../../utils/clipUtils' | import { getTimelineItemDisplayName } from '@unified/utils/clipUtils' | 待修改 |
| frontend/src/unified/components/renderers/status/index.ts | export { LoadingContentRenderer } from './LoadingContentRenderer' | export { LoadingContentRenderer } from '@unified/components/renderers/status/LoadingContentRenderer' | 待修改 |
| frontend/src/unified/components/renderers/status/index.ts | export { ErrorContentRenderer } from './ErrorContentRenderer' | export { ErrorContentRenderer } from '@unified/components/renderers/status/ErrorContentRenderer' | 待修改 |
| frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts | import type { ContentRenderer, ContentRenderContext } from '../../../types/clipRenderer' | import type { ContentRenderer, ContentRenderContext } from '@unified/types/clipRenderer' | 待修改 |
| frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts | import type { UnifiedTimelineItemData } from '../../../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts | import type { MediaType } from '../../../mediaitem/types' | import type { MediaType } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts | import type { UnifiedMediaItemData } from '../../../mediaitem/types' | import type { UnifiedMediaItemData } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts | import { getTimelineItemDisplayName } from '../../../utils/clipUtils' | import { getTimelineItemDisplayName } from '@unified/utils/clipUtils' | 待修改 |
| frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts | import { useUnifiedStore } from '../../../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/components/renderers/status/LoadingContentRenderer.ts | import type { RemoteFileSourceData } from '../../../sources/RemoteFileSource' | import type { RemoteFileSourceData } from '@unified/sources/RemoteFileSource' | 待修改 |
| frontend/src/unified/composables/index.ts | export { useDragUtils } from './useDragUtils' | export { useDragUtils } from '@unified/composables/useDragUtils' | 待修改 |
| frontend/src/unified/composables/index.ts | export { getDragPreviewManager } from './useDragPreview' | export { getDragPreviewManager } from '@unified/composables/useDragPreview' | 待修改 |
| frontend/src/unified/composables/index.ts | export { usePlaybackControls } from './usePlaybackControls' | export { usePlaybackControls } from '@unified/composables/usePlaybackControls' | 待修改 |
| frontend/src/unified/composables/index.ts | export { useDialogs } from './useDialogs' | export { useDialogs } from '@unified/composables/useDialogs' | 待修改 |
| frontend/src/unified/composables/index.ts | export { useKeyboardShortcuts } from './useKeyboardShortcuts' | export { useKeyboardShortcuts } from '@unified/composables/useKeyboardShortcuts' | 待修改 |
| frontend/src/unified/composables/index.ts | export { useUnifiedKeyframeTransformControls } from './useKeyframeTransformControls' | export { useUnifiedKeyframeTransformControls } from '@unified/composables/useKeyframeTransformControls' | 待修改 |
| frontend/src/unified/composables/index.ts | export { useUnifiedKeyframeUI } from './useUnifiedKeyframeUI' | export { useUnifiedKeyframeUI } from '@unified/composables/useUnifiedKeyframeUI' | 待修改 |
| frontend/src/unified/composables/index.ts | export { useAutoSave } from './useAutoSave' | export { useAutoSave } from '@unified/composables/useAutoSave' | 待修改 |
| frontend/src/unified/composables/useAutoSave.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import type { UnifiedMediaItemData } from '../mediaitem/types' | import type { UnifiedMediaItemData } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import type { UnifiedTimelineItemData } from '../timelineitem/TimelineItemData' | import type { UnifiedTimelineItemData } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import type { VideoMediaConfig, ImageMediaConfig } from '../timelineitem/TimelineItemData' | import type { VideoMediaConfig, ImageMediaConfig } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import { UnifiedMediaItemQueries } from '../mediaitem' | import { UnifiedMediaItemQueries } from '@unified/mediaitem' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import { TimelineItemQueries } from '../timelineitem/TimelineItemQueries' | import { TimelineItemQueries } from '@unified/timelineitem/TimelineItemQueries' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import { SimplifiedMediaSyncManager } from '../timelineitem/SimplifiedMediaSyncManager' | import { SimplifiedMediaSyncManager } from '@unified/timelineitem/SimplifiedMediaSyncManager' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import { createSpriteFromUnifiedMediaItem } from '../utils/spriteFactory' | import { createSpriteFromUnifiedMediaItem } from '@unified/utils/spriteFactory' | 待修改 |
| frontend/src/unified/composables/useCommandMediaSync.ts | import { regenerateThumbnailForUnifiedTimelineItem } from '../utils/thumbnailGenerator' | import { regenerateThumbnailForUnifiedTimelineItem } from '@unified/utils/thumbnailGenerator' | 待修改 |
| frontend/src/unified/composables/useDialogs.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useDragPreview.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useDragPreview.ts | import type { DragPreviewData } from '../types/drag' | import type { DragPreviewData } from '@unified/types/drag' | 待修改 |
| frontend/src/unified/composables/useDragUtils.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useDragUtils.ts | import type { TimelineItemDragData, MediaItemDragData } from '../types' | import type { TimelineItemDragData, MediaItemDragData } from '@unified/types' | 待修改 |
| frontend/src/unified/composables/useDragUtils.ts | import type { MediaType } from '../mediaitem' | import type { MediaType } from '@unified/mediaitem' | 待修改 |
| frontend/src/unified/composables/useDragUtils.ts | import type { UnifiedTrackType } from '../track/TrackTypes' | import type { UnifiedTrackType } from '@unified/track/TrackTypes' | 待修改 |
| frontend/src/unified/composables/useDragUtils.ts | import { alignFramesToFrame } from '../utils/timeUtils' | import { alignFramesToFrame } from '@unified/utils/timeUtils' | 待修改 |
| frontend/src/unified/composables/useKeyboardShortcuts.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useKeyframeTransformControls.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useKeyframeTransformControls.ts | import { uiDegreesToWebAVRadians, webAVRadiansToUIDegrees } from '../utils/rotationTransform' | import { uiDegreesToWebAVRadians, webAVRadiansToUIDegrees } from '@unified/utils/rotationTransform' | 待修改 |
| frontend/src/unified/composables/useKeyframeTransformControls.ts | import { useUnifiedKeyframeUI } from './useUnifiedKeyframeUI' | import { useUnifiedKeyframeUI } from '@unified/composables/useUnifiedKeyframeUI' | 待修改 |
| frontend/src/unified/composables/useKeyframeTransformControls.ts | import type { UnifiedTimelineItemData } from '../timelineitem' | import type { UnifiedTimelineItemData } from '@unified/timelineitem' | 待修改 |
| frontend/src/unified/composables/useKeyframeTransformControls.ts | import { hasVisualProperties } from '../timelineitem' | import { hasVisualProperties } from '@unified/timelineitem' | 待修改 |
| frontend/src/unified/composables/usePlaybackControls.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useUnifiedKeyframeUI.ts | import type { UnifiedTimelineItemData } from '../timelineitem' | import type { UnifiedTimelineItemData } from '@unified/timelineitem' | 待修改 |
| frontend/src/unified/composables/useUnifiedKeyframeUI.ts | import type { KeyframeUIState, KeyframeButtonState, KeyframeProperties } from '../timelineitem/TimelineItemData' | import type { KeyframeUIState, KeyframeButtonState, KeyframeProperties } from '@unified/timelineitem/TimelineItemData' | 待修改 |
| frontend/src/unified/composables/useUnifiedKeyframeUI.ts | import { useUnifiedStore } from '../unifiedStore' | import { useUnifiedStore } from '@unified/unifiedStore' | 待修改 |
| frontend/src/unified/composables/useUnifiedKeyframeUI.ts | import { hasAnimation, isCurrentFrameOnKeyframe, getKeyframeButtonState, getKeyframeUIState, getPreviousKeyframeFrame, getNextKeyframeFrame } from '../utils/unifiedKeyframeUtils' | import { hasAnimation, isCurrentFrameOnKeyframe, getKeyframeButtonState, getKeyframeUIState, getPreviousKeyframeFrame, getNextKeyframeFrame } from '@unified/utils/unifiedKeyframeUtils' | 待修改 |
| frontend/src/unified/composables/useUnifiedKeyframeUI.ts | import { toggleKeyframe as toggleKeyframeWithCommand, updateProperty as updatePropertyWithCommand, clearAllKeyframes as clearAllKeyframesWithCommand } from '../utils/keyframeCommandUtils' | import { toggleKeyframe as toggleKeyframeWithCommand, updateProperty as updatePropertyWithCommand, clearAllKeyframes as clearAllKeyframesWithCommand } from '@unified/utils/keyframeCommandUtils' | 待修改 |
| frontend/src/unified/composables/useUnifiedKeyframeUI.ts | import { isPlayheadInTimelineItem } from '../utils/timelineSearchUtils' | import { isPlayheadInTimelineItem } from '@unified/utils/timelineSearchUtils' | 待修改 |
| frontend/src/unified/mediaitem/index.ts | export type { MediaStatus, MediaType, MediaTypeOrUnknown, WebAVObjects, UnifiedMediaItemData, ReadyMediaItem, ProcessingMediaItem, ErrorMediaItem, PendingMediaItem, VideoMediaItem, ImageMediaItem, AudioMediaItem, TextMediaItem, UnknownMediaItem, KnownMediaItem, VisualMediaItem, AudioCapableMediaItem, } from './types' | export type { MediaStatus, MediaType, MediaTypeOrUnknown, WebAVObjects, UnifiedMediaItemData, ReadyMediaItem, ProcessingMediaItem, ErrorMediaItem, PendingMediaItem, VideoMediaItem, ImageMediaItem, AudioMediaItem, TextMediaItem, UnknownMediaItem, KnownMediaItem, VisualMediaItem, AudioCapableMediaItem, } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/mediaitem/index.ts | export { createUnifiedMediaItemData } from './types' | export { createUnifiedMediaItemData } from '@unified/mediaitem/types' | 待修改 |
| frontend/src/unified/mediaitem/index.ts | export { UnifiedMediaItemQueries, UnifiedMediaItemActions } from './actions' | export { UnifiedMediaItemQueries, UnifiedMediaItemActions } from '@unified/mediaitem/actions' | 待修改 |
| frontend/src/unified/mediaitem/types.ts | import type { UnifiedDataSourceData } from '../sources/DataSourceTypes' | import type { UnifiedDataSourceData } from '@unified/sources/DataSourceTypes' | 待修改 |
| frontend/src/unified/mediaitem/actions.ts | import type { UnifiedMediaItemData, MediaStatus, MediaType, MediaTypeOrUnknown, WebAVObjects, ReadyMediaItem, ProcessingMediaItem, ErrorMediaItem, PendingMediaItem, VideoMediaItem, ImageMediaItem, AudioMediaItem, TextMediaItem, UnknownMediaItem, KnownMediaItem, VisualMediaItem, AudioCapableMediaItem, } from './types' | import type { UnifiedMediaItemData, MediaStatus, MediaType, MediaTypeOrUnknown, WebAVObjects, ReadyMediaItem, ProcessingMediaItem, ErrorMediaItem, PendingMediaItem, VideoMediaItem, ImageMediaItem, AudioMediaItem, TextMediaItem, UnknownMediaItem, KnownMediaItem, VisualMediaItem, AudioCapableMediaItem, } from '@unified/mediaitem/types' | 待修改 |