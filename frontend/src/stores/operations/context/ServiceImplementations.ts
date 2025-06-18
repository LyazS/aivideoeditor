import type { 
  TimelineService, 
  CanvasService, 
  TrackService, 
  MediaService, 
  WebAVService,
  TrackData
} from './ServiceInterfaces'
import type { TimelineItem, MediaItem, Track } from '../../../types/videoTypes'
import type { MP4Clip, ImgClip, AVCanvas } from '@webav/av-cliper'
import { useWebAVControls } from '../../../composables/useWebAVControls'

/**
 * 时间轴服务适配器
 * 适配现有的timelineModule
 */
export class TimelineServiceAdapter implements TimelineService {
  constructor(
    private timelineModule: {
      addTimelineItem: (item: TimelineItem) => void
      removeTimelineItem: (itemId: string) => void
      getTimelineItem: (itemId: string) => TimelineItem | undefined
      timelineItems: { value: TimelineItem[] }
      setupBidirectionalSync: (item: TimelineItem) => void
    }
  ) {}

  addItem(item: TimelineItem): void {
    this.timelineModule.addTimelineItem(item)
  }

  removeItem(itemId: string): void {
    this.timelineModule.removeTimelineItem(itemId)
  }

  getItem(itemId: string): TimelineItem | undefined {
    return this.timelineModule.getTimelineItem(itemId)
  }

  getItemsInTrack(trackId: number): TimelineItem[] {
    return this.timelineModule.timelineItems.value.filter(item => item.trackId === trackId)
  }

  updateItem(itemId: string, updates: Partial<TimelineItem>): void {
    const item = this.getItem(itemId)
    if (item) {
      Object.assign(item, updates)
    }
  }
}

/**
 * 画布服务适配器
 * 适配现有的webavModule
 */
export class CanvasServiceAdapter implements CanvasService {
  constructor(
    private webavModule: {
      addSprite: (sprite: any) => boolean
      removeSprite: (sprite: any) => boolean
      avCanvas: { value: AVCanvas | null }
    }
  ) {}

  addSprite(sprite: any): void {
    this.webavModule.addSprite(sprite)
  }

  removeSprite(sprite: any): void {
    this.webavModule.removeSprite(sprite)
  }

  updateSprite(sprite: any): void {
    // WebAV sprites are automatically updated when their properties change
    // No explicit update method needed
  }
}

/**
 * 轨道服务适配器
 * 适配现有的trackModule
 */
export class TrackServiceAdapter implements TrackService {
  constructor(
    private trackModule: {
      addTrack: (name?: string) => Track
      removeTrack: (trackId: number, timelineItems: any, removeCallback?: any) => void
      getTrack: (trackId: number) => Track | undefined
      tracks: { value: Track[] }
      renameTrack: (trackId: number, newName: string) => void
    },
    private timelineModule: {
      timelineItems: { value: TimelineItem[] }
    }
  ) {}

  createTrack(data: TrackData): Track {
    return this.trackModule.addTrack(data.name)
  }

  removeTrack(trackId: number): void {
    this.trackModule.removeTrack(trackId, this.timelineModule.timelineItems)
  }

  getTrack(trackId: number): Track | undefined {
    return this.trackModule.getTrack(trackId)
  }

  getNextTrackNumber(): number {
    const tracks = this.trackModule.tracks.value
    return Math.max(...tracks.map(t => t.id)) + 1
  }

  updateTrack(trackId: number, updates: Partial<Track>): void {
    const track = this.getTrack(trackId)
    if (track) {
      Object.assign(track, updates)
      if (updates.name) {
        this.trackModule.renameTrack(trackId, updates.name)
      }
    }
  }
}

/**
 * 媒体服务适配器
 * 适配现有的mediaModule
 */
export class MediaServiceAdapter implements MediaService {
  constructor(
    private mediaModule: {
      getMediaItem: (mediaItemId: string) => MediaItem | undefined
      addMediaItem: (item: MediaItem, timelineItems: any, tracks: any) => void
      removeMediaItem: (mediaItemId: string, timelineItems: any, tracks: any, avCanvas: any, cleanupCallback: any) => void
      mediaItems: { value: MediaItem[] }
    },
    private timelineModule: {
      timelineItems: { value: TimelineItem[] }
    },
    private trackModule: {
      tracks: { value: Track[] }
    }
  ) {}

  getItem(mediaItemId: string): MediaItem | undefined {
    return this.mediaModule.getMediaItem(mediaItemId)
  }

  addItem(item: MediaItem): void {
    this.mediaModule.addMediaItem(item, this.timelineModule.timelineItems, this.trackModule.tracks)
  }

  removeItem(mediaItemId: string): void {
    // Note: This is a simplified implementation
    // In practice, you might need to handle cleanup more carefully
    const index = this.mediaModule.mediaItems.value.findIndex(item => item.id === mediaItemId)
    if (index > -1) {
      this.mediaModule.mediaItems.value.splice(index, 1)
    }
  }
}

/**
 * WebAV服务适配器
 * 适配现有的useWebAVControls
 */
export class WebAVServiceAdapter implements WebAVService {
  private webAVControls = useWebAVControls()

  constructor(
    private webavModule: {
      avCanvas: { value: AVCanvas | null }
    }
  ) {}

  async cloneMP4Clip(originalClip: MP4Clip): Promise<MP4Clip> {
    return this.webAVControls.cloneMP4Clip(originalClip)
  }

  async cloneImgClip(originalClip: ImgClip): Promise<ImgClip> {
    return this.webAVControls.cloneImgClip(originalClip)
  }

  getCanvas(): AVCanvas | undefined {
    return this.webavModule.avCanvas.value || undefined
  }
}
