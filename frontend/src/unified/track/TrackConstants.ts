/**
 * 统一轨道系统常量定义
 * 包含轨道类型、默认配置、UI常量等
 */

import type { UnifiedTrackType, TrackStatus } from './TrackTypes'

// ==================== 轨道类型常量 ====================

/**
 * 支持的轨道类型
 */
export const UNIFIED_TRACK_TYPES = {
  VIDEO: 'video',
  AUDIO: 'audio', 
  TEXT: 'text',
  SUBTITLE: 'subtitle',
  EFFECT: 'effect'
} as const

/**
 * 轨道状态常量
 */
export const TRACK_STATUS = {
  ACTIVE: 'active',
  LOCKED: 'locked',
  DISABLED: 'disabled'
} as const

// ==================== 默认配置 ====================

/**
 * 轨道类型默认配置
 */
export const TRACK_TYPE_DEFAULTS = {
  video: {
    height: 60, // 统一轨道高度为60px（与旧架构一致）
    color: '#4CAF50',
    icon: 'video-camera',
    name: '视频轨道',
    hasVisual: true,
    hasAudio: true,
    supportsEffects: true,
    supportsTransform: true,
    maxItems: 100
  },
  audio: {
    height: 60, // 统一轨道高度为60px（与旧架构一致）
    color: '#2196F3',
    icon: 'volume-up',
    name: '音频轨道',
    hasVisual: false,
    hasAudio: true,
    supportsEffects: true,
    supportsTransform: false,
    maxItems: 50
  },
  text: {
    height: 60, // 统一轨道高度为60px（与旧架构一致）
    color: '#FF9800',
    icon: 'text',
    name: '文本轨道',
    hasVisual: true,
    hasAudio: false,
    supportsEffects: true,
    supportsTransform: true,
    maxItems: 200
  },
  subtitle: {
    height: 60, // 统一轨道高度为60px（与旧架构一致）
    color: '#9C27B0',
    icon: 'closed-captioning',
    name: '字幕轨道',
    hasVisual: true,
    hasAudio: false,
    supportsEffects: false,
    supportsTransform: false,
    maxItems: 500
  },
  effect: {
    height: 60, // 统一轨道高度为60px（与旧架构一致）
    color: '#F44336',
    icon: 'magic-wand',
    name: '特效轨道',
    hasVisual: true,
    hasAudio: true,
    supportsEffects: false,
    supportsTransform: true,
    maxItems: 20
  }
} as const

/**
 * 轨道布局默认值
 */
export const TRACK_LAYOUT_DEFAULTS = {
  MIN_HEIGHT: 30,
  MAX_HEIGHT: 200,
  DEFAULT_HEIGHT: 60,
  COLLAPSED_HEIGHT: 30,
  EXPANDED_HEIGHT_MULTIPLIER: 1.5,
  HEADER_HEIGHT: 40,
  CONTENT_PADDING: 8
} as const

/**
 * 轨道音频默认值
 */
export const TRACK_AUDIO_DEFAULTS = {
  DEFAULT_VOLUME: 1.0,
  MIN_VOLUME: 0.0,
  MAX_VOLUME: 2.0,
  VOLUME_STEP: 0.1,
  DEFAULT_PAN: 0.0,
  MIN_PAN: -1.0,
  MAX_PAN: 1.0,
  PAN_STEP: 0.1
} as const

/**
 * 轨道可见性默认值
 */
export const TRACK_VISIBILITY_DEFAULTS = {
  DEFAULT_OPACITY: 1.0,
  MIN_OPACITY: 0.0,
  MAX_OPACITY: 1.0,
  OPACITY_STEP: 0.1,
  FADE_DURATION: 300
} as const

// ==================== UI 常量 ====================

/**
 * 轨道颜色主题
 */
export const TRACK_COLOR_THEMES = {
  default: {
    video: '#4CAF50',
    audio: '#2196F3',
    text: '#FF9800', 
    subtitle: '#9C27B0',
    effect: '#F44336'
  },
  dark: {
    video: '#2E7D32',
    audio: '#1565C0',
    text: '#E65100',
    subtitle: '#6A1B9A',
    effect: '#C62828'
  },
  light: {
    video: '#81C784',
    audio: '#64B5F6',
    text: '#FFB74D',
    subtitle: '#BA68C8',
    effect: '#E57373'
  }
} as const

/**
 * 轨道图标映射
 */
export const TRACK_ICONS = {
  video: {
    default: 'video-camera',
    active: 'video-camera-outline',
    locked: 'video-camera-off',
    disabled: 'video-camera-off-outline'
  },
  audio: {
    default: 'volume-up',
    active: 'volume-high',
    locked: 'volume-off',
    disabled: 'volume-mute'
  },
  text: {
    default: 'text',
    active: 'text-box',
    locked: 'text-box-outline',
    disabled: 'text-box-remove'
  },
  subtitle: {
    default: 'closed-captioning',
    active: 'closed-captioning-outline',
    locked: 'closed-captioning-off',
    disabled: 'closed-captioning-off-outline'
  },
  effect: {
    default: 'magic-wand',
    active: 'magic-wand-outline',
    locked: 'magic-wand-off',
    disabled: 'magic-wand-off-outline'
  }
} as const

/**
 * 轨道操作按钮配置
 */
export const TRACK_CONTROLS = {
  visibility: {
    icon: 'eye',
    iconOff: 'eye-off',
    tooltip: '切换可见性',
    shortcut: 'V'
  },
  mute: {
    icon: 'volume-up',
    iconOff: 'volume-off',
    tooltip: '切换静音',
    shortcut: 'M'
  },
  solo: {
    icon: 'headphones',
    iconOff: 'headphones-off',
    tooltip: '独奏模式',
    shortcut: 'S'
  },
  lock: {
    icon: 'lock-open',
    iconOff: 'lock',
    tooltip: '锁定轨道',
    shortcut: 'L'
  },
  collapse: {
    icon: 'chevron-up',
    iconOff: 'chevron-down',
    tooltip: '折叠/展开',
    shortcut: 'C'
  }
} as const

// ==================== 轨道限制 ====================

/**
 * 轨道数量限制
 */
export const TRACK_LIMITS = {
  MAX_TRACKS_TOTAL: 100,
  MAX_TRACKS_PER_TYPE: {
    video: 20,
    audio: 30,
    text: 50,
    subtitle: 10,
    effect: 10
  },
  MIN_TRACKS_REQUIRED: {
    video: 1,
    audio: 0,
    text: 0,
    subtitle: 0,
    effect: 0
  }
} as const

/**
 * 轨道性能限制
 */
export const TRACK_PERFORMANCE = {
  MAX_ITEMS_PER_TRACK: {
    video: 100,
    audio: 200,
    text: 500,
    subtitle: 1000,
    effect: 50
  },
  RENDER_BATCH_SIZE: 10,
  UPDATE_THROTTLE_MS: 16, // 60fps
  DEBOUNCE_MS: 300
} as const

// ==================== 轨道验证规则 ====================

/**
 * 轨道名称验证规则
 */
export const TRACK_NAME_VALIDATION = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 50,
  ALLOWED_CHARS: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_()（）]+$/,
  RESERVED_NAMES: ['default', 'master', 'main', 'output'] as readonly string[]
} as const

/**
 * 轨道属性验证规则
 */
export const TRACK_PROPERTY_VALIDATION = {
  height: {
    min: TRACK_LAYOUT_DEFAULTS.MIN_HEIGHT,
    max: TRACK_LAYOUT_DEFAULTS.MAX_HEIGHT
  },
  volume: {
    min: TRACK_AUDIO_DEFAULTS.MIN_VOLUME,
    max: TRACK_AUDIO_DEFAULTS.MAX_VOLUME
  },
  opacity: {
    min: TRACK_VISIBILITY_DEFAULTS.MIN_OPACITY,
    max: TRACK_VISIBILITY_DEFAULTS.MAX_OPACITY
  },
  order: {
    min: 0,
    max: 999
  }
} as const

// ==================== 轨道事件类型 ====================

/**
 * 轨道事件类型
 */
export const TRACK_EVENTS = {
  // 轨道生命周期
  CREATED: 'track:created',
  DELETED: 'track:deleted',
  UPDATED: 'track:updated',
  
  // 轨道状态变化
  STATUS_CHANGED: 'track:status-changed',
  VISIBILITY_CHANGED: 'track:visibility-changed',
  AUDIO_CHANGED: 'track:audio-changed',
  
  // 轨道布局变化
  HEIGHT_CHANGED: 'track:height-changed',
  ORDER_CHANGED: 'track:order-changed',
  COLLAPSED: 'track:collapsed',
  EXPANDED: 'track:expanded',
  
  // 轨道选择
  SELECTED: 'track:selected',
  DESELECTED: 'track:deselected',
  ACTIVATED: 'track:activated',
  
  // 批量操作
  BATCH_UPDATED: 'track:batch-updated',
  REORDERED: 'track:reordered',
  RESET: 'track:reset'
} as const

// ==================== 轨道快捷键 ====================

/**
 * 轨道快捷键映射
 */
export const TRACK_SHORTCUTS = {
  // 轨道创建
  CREATE_VIDEO_TRACK: 'Ctrl+Shift+V',
  CREATE_AUDIO_TRACK: 'Ctrl+Shift+A',
  CREATE_TEXT_TRACK: 'Ctrl+Shift+T',
  
  // 轨道操作
  TOGGLE_VISIBILITY: 'V',
  TOGGLE_MUTE: 'M',
  TOGGLE_SOLO: 'S',
  TOGGLE_LOCK: 'L',
  TOGGLE_COLLAPSE: 'C',
  
  // 轨道选择
  SELECT_ALL_TRACKS: 'Ctrl+A',
  DESELECT_ALL_TRACKS: 'Ctrl+D',
  SELECT_NEXT_TRACK: 'ArrowDown',
  SELECT_PREV_TRACK: 'ArrowUp',
  
  // 轨道删除
  DELETE_SELECTED_TRACKS: 'Delete',
  DELETE_EMPTY_TRACKS: 'Ctrl+Delete'
} as const

// ==================== 导出所有常量 ====================

export const TRACK_CONSTANTS = {
  TYPES: UNIFIED_TRACK_TYPES,
  STATUS: TRACK_STATUS,
  DEFAULTS: TRACK_TYPE_DEFAULTS,
  LAYOUT: TRACK_LAYOUT_DEFAULTS,
  AUDIO: TRACK_AUDIO_DEFAULTS,
  VISIBILITY: TRACK_VISIBILITY_DEFAULTS,
  COLORS: TRACK_COLOR_THEMES,
  ICONS: TRACK_ICONS,
  CONTROLS: TRACK_CONTROLS,
  LIMITS: TRACK_LIMITS,
  PERFORMANCE: TRACK_PERFORMANCE,
  VALIDATION: {
    NAME: TRACK_NAME_VALIDATION,
    PROPERTY: TRACK_PROPERTY_VALIDATION
  },
  EVENTS: TRACK_EVENTS,
  SHORTCUTS: TRACK_SHORTCUTS
} as const
