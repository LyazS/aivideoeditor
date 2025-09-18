import { createI18n } from 'vue-i18n'

// 导入英文语言包
import enCommon from './en-US/common.json'
import enEditor from './en-US/editor.json'
import enTimeline from './en-US/timeline.json'
import enProperties from './en-US/properties.json'
import enMedia from './en-US/media.json'
import enProject from './en-US/project.json'
import enApp from './en-US/app.json'
import enMenu from './en-US/menu.json'
import enWorkspace from './en-US/workspace.json'
import enToolbar from './en-US/toolbar.json'
import enNotification from './en-US/notification.json'

// 导入中文语言包
import zhCommon from './zh-CN/common.json'
import zhEditor from './zh-CN/editor.json'
import zhTimeline from './zh-CN/timeline.json'
import zhProperties from './zh-CN/properties.json'
import zhMedia from './zh-CN/media.json'
import zhProject from './zh-CN/project.json'
import zhApp from './zh-CN/app.json'
import zhMenu from './zh-CN/menu.json'
import zhWorkspace from './zh-CN/workspace.json'
import zhToolbar from './zh-CN/toolbar.json'
import zhNotification from './zh-CN/notification.json'

// 合并所有语言包
const enUS = {
  ...enCommon,
  ...enEditor,
  ...enTimeline,
  ...enProperties,
  ...enMedia,
  ...enProject,
  ...enApp,
  ...enMenu,
  ...enWorkspace,
  ...enToolbar,
  ...enNotification
}

const zhCN = {
  ...zhCommon,
  ...zhEditor,
  ...zhTimeline,
  ...zhProperties,
  ...zhMedia,
  ...zhProject,
  ...zhApp,
  ...zhMenu,
  ...zhWorkspace,
  ...zhToolbar,
  ...zhNotification
}

export const i18n = createI18n({
  legacy: false, // 使用Composition API
  locale: 'zh-CN', // 默认中文
  fallbackLocale: 'en-US', // 回退到英文
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN
  }
})

// 类型定义
export type I18nSchema = typeof enUS