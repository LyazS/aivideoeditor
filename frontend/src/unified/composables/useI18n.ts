import { useI18n } from 'vue-i18n'
import type { I18nSchema } from '@/locales'

export function useAppI18n() {
  const { t, locale, availableLocales } = useI18n<[I18nSchema], 'en-US' | 'zh-CN'>()
  
  // 语言切换功能
  const switchLanguage = (lang: 'en-US' | 'zh-CN') => {
    locale.value = lang
    localStorage.setItem('preferred-language', lang)
  }
  
  // 初始化语言设置
  const initLanguage = () => {
    const savedLang = localStorage.getItem('preferred-language')
    const browserLang = navigator.language
    
    if (savedLang && ['en-US', 'zh-CN'].includes(savedLang)) {
      locale.value = savedLang as 'en-US' | 'zh-CN'
    } else if (browserLang.startsWith('zh')) {
      locale.value = 'zh-CN'
    } else {
      locale.value = 'en-US'
    }
  }
  
  // 获取当前语言显示名称
  const getLanguageName = (lang: 'en-US' | 'zh-CN') => {
    return lang === 'zh-CN' ? '中文' : 'English'
  }
  
  // 获取所有支持的语言选项
  const languageOptions = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en-US', label: 'English' }
  ] as const

  // 安全地处理 availableLocales 类型转换
  const safeAvailableLocales = (availableLocales as unknown[]).includes('en-US') &&
                               (availableLocales as unknown[]).includes('zh-CN')
    ? availableLocales as unknown as readonly ['en-US', 'zh-CN']
    : ['en-US', 'zh-CN'] as const

  return {
    t,
    locale,
    availableLocales: safeAvailableLocales,
    switchLanguage,
    initLanguage,
    getLanguageName,
    languageOptions
  }
}

export type { I18nSchema }