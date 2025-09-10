/**
 * 音频图标常量
 * 提供全局统一的音频默认图标
 */

/**
 * 音频默认图标的SVG内容
 * 使用绿色背景和白色音频波形图标
 */
const AUDIO_ICON_SVG = `<svg width="60" height="40" xmlns="http://www.w3.org/2000/svg">
  <rect width="60" height="40" fill="#4CAF50" rx="4"/>
  <g fill="white" transform="translate(30, 20)">
    <circle cx="-6" cy="8" r="3"/>
    <circle cx="6" cy="6" r="3"/>
    <rect x="-3" y="-2" width="1.5" height="10"/>
    <rect x="9" y="-4" width="1.5" height="10"/>
    <path d="M -1.5 -2 Q 6 -6 10.5 -4 L 10.5 -2 Q 6 -4 -1.5 0 Z"/>
  </g>
</svg>`

/**
 * 全局音频默认图标URL
 * 使用Data URL格式，可以直接作为图片源使用
 */
export const AUDIO_DEFAULT_THUMBNAIL_URL = `data:image/svg+xml;base64,${btoa(AUDIO_ICON_SVG)}`
