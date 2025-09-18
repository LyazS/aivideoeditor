/**
 * Remix Icon 映射配置
 * 提供项目中所有图标的统一映射管理
 */

/**
 * 轨道类型图标映射
 */
export const TRACK_TYPE_ICONS = {
  video: 'vidicon-line',
  audio: 'volume-up-line',
  text: 'text',
  subtitle: 'subtitles-line',
} as const

/**
 * 控制按钮图标映射
 */
export const CONTROL_ICONS = {
  // 添加轨道图标
  add: 'add-line',

  // 可见性图标
  visible: 'eye-line',
  hidden: 'eye-off-line',

  // 音频控制图标
  unmuted: 'volume-up-line',
  muted: 'volume-mute-line',
} as const

/**
 * 右键菜单图标映射
 */
export const MENU_ICONS = {
  // 片段操作图标
  copy: 'file-copy-line',
  delete: 'delete-bin-line',
  refresh: 'refresh-line',

  // 轨道操作图标
  addText: 'text-line',
  autoArrange: 'layout-grid-line',
  rename: 'edit-line',

  // 添加轨道子菜单图标
  addTrack: 'add-line',
} as const

/**
 * 播放控制图标映射
 */
export const PLAYBACK_ICONS = {
  play: 'play-line',
  pause: 'pause-line',
  stop: 'stop-line',
} as const

/**
 * 通知图标映射
 */
export const NOTIFICATION_ICONS = {
  success: 'checkbox-circle-line',
  error: 'close-circle-line',
  warning: 'error-warning-line',
  info: 'information-line',
} as const

/**
 * 工具图标映射
 */
export const TOOL_ICONS = {
  // 裁剪工具
  split: 'scissors-line',
  
  // 吸附工具
  snap: 'magnet-line',
  snapOff: 'magnet-line',
  
  // 历史操作
  history: 'history-line',
  
  // 调试工具
  debug: 'bug-line',
} as const

/**
 * 状态图标映射
 */
export const STATUS_ICONS = {
  loading: 'loader-4-line',
  success: 'check-line',
  error: 'close-line',
  empty: 'inbox-line',
} as const

/**
 * 媒体库图标映射
 */
export const MEDIA_LIBRARY_ICONS = {
  // 文件类型
  grid: 'grid-line',
  file: 'file-line',
  
  // 操作按钮
  import: 'add-line',
  tools: 'tools-line',
  close: 'close-line',
  
  // 状态指示
  pending: 'loader-4-line',
  error: 'close-circle-line',
  delete: 'delete-bin-line',
  success: 'check-line',
  
  // 媒体类型
  all: 'grid-line',
  video: 'vidicon-line',
  audio: 'volume-up-line',
  processing: 'loader-4-line',
  
  // 右键菜单
  importLocal: 'add-line',
  remoteDownload: 'download-cloud-line',
} as const

/**
 * 获取轨道类型图标
 * @param type 轨道类型
 * @returns Remix Icon 名称
 */
export function getTrackTypeIcon(type: string): string {
  return TRACK_TYPE_ICONS[type as keyof typeof TRACK_TYPE_ICONS] || TRACK_TYPE_ICONS.video
}

/**
 * 获取可见性图标
 * @param isVisible 是否可见
 * @returns Remix Icon 名称
 */
export function getVisibilityIcon(isVisible: boolean): string {
  return isVisible ? CONTROL_ICONS.visible : CONTROL_ICONS.hidden
}

/**
 * 获取静音图标
 * @param isMuted 是否静音
 * @returns Remix Icon 名称
 */
export function getMuteIcon(isMuted: boolean): string {
  return isMuted ? CONTROL_ICONS.muted : CONTROL_ICONS.unmuted
}

/**
 * 获取播放状态图标
 * @param isPlaying 是否正在播放
 * @returns Remix Icon 名称
 */
export function getPlaybackIcon(isPlaying: boolean): string {
  return isPlaying ? PLAYBACK_ICONS.pause : PLAYBACK_ICONS.play
}

export type TrackTypeIcon = keyof typeof TRACK_TYPE_ICONS
export type ControlIcon = keyof typeof CONTROL_ICONS
export type MenuIcon = keyof typeof MENU_ICONS
export type PlaybackIcon = keyof typeof PLAYBACK_ICONS
export type NotificationIcon = keyof typeof NOTIFICATION_ICONS
export type ToolIcon = keyof typeof TOOL_ICONS
export type StatusIcon = keyof typeof STATUS_ICONS

/**
 * 轨道类型标签映射
 */
export const TRACK_TYPE_LABELS = {
  video: '视频',
  audio: '音频',
  text: '文本',
  subtitle: '字幕',
} as const

/**
 * 获取轨道类型标签
 * @param type 轨道类型
 * @returns 中文标签
 */
export function getTrackTypeLabel(type: string): string {
  return TRACK_TYPE_LABELS[type as keyof typeof TRACK_TYPE_LABELS] || '视频'
}