<template>
  <div class="language-selector">
    <div class="language-dropdown">
      <HoverButton
        variant="small"
        :title="t('common.language')"
        @click="showLanguageDropdown = !showLanguageDropdown"
      >
        <template #icon>
          <RemixIcon name="translate" size="xl" />
        </template>
      </HoverButton>

      <div v-if="showLanguageDropdown" class="language-dropdown-menu">
        <div
          v-for="option in languageOptions"
          :key="option.value"
          class="language-option"
          :class="{ active: option.value === locale }"
          @click="handleLanguageChange(option.value)"
        >
          {{ option.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useAppI18n } from '@/unified/composables/useI18n'
import RemixIcon from './icons/RemixIcon.vue'
import HoverButton from './HoverButton.vue'

const { t, locale, languageOptions, switchLanguage } = useAppI18n()
const showLanguageDropdown = ref(false)

// 语言切换处理函数
const handleLanguageChange = (lang: 'en-US' | 'zh-CN') => {
  switchLanguage(lang)
  showLanguageDropdown.value = false
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.closest('.language-dropdown')) {
    showLanguageDropdown.value = false
  }
}

// 添加全局点击事件监听
window.addEventListener('click', handleClickOutside)

// 组件卸载时清理事件监听
onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.language-selector {
  position: relative;
}

.language-dropdown {
  position: relative;
}

.language-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.25rem;
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-medium);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 120px;
  overflow: hidden;
}

.language-option {
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.language-option:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.language-option.active {
  background-color: var(--color-primary);
  color: white;
}
</style>