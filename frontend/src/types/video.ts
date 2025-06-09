export interface FFmpegProgress {
  ratio: number
  time: number
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
}

export interface CanvasTransform {
  x: number
  y: number
  rotation: number
  scale: number
}

// 扩展现有的VideoClip接口，添加Canvas渲染需要的属性
export interface VideoRenderInfo {
  videoElement?: HTMLVideoElement
  isLoaded: boolean
  metadata?: VideoMetadata
}
