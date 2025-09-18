<template>
  <Dropdown
    placement="bottom-end"
    :close-on-click-outside="true"
  >
    <!-- 自定义触发按钮 -->
    <template #trigger="{ toggle }">
      <HoverButton
        variant="small"
        :title="t('common.language')"
        @click="toggle"
      >
        <template #icon>
          <RemixIcon name="translate" size="xl" />
        </template>
      </HoverButton>
    </template>

    <!-- 语言选项具体内容 -->
    <template #default="{ close }">
      <div class="language-dropdown-menu">
        <div
          v-for="option in languageOptions"
          :key="option.value"
          class="language-option"
          :class="{ active: option.value === locale }"
          @click="handleLanguageChange(option.value, close)"
        >
          {{ option.label }}
        </div>
      </div>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { useAppI18n } from '@/unified/composables/useI18n'
import RemixIcon from './icons/RemixIcon.vue'
import HoverButton from './HoverButton.vue'
import Dropdown from './Dropdown.vue'

const { t, locale, languageOptions, switchLanguage } = useAppI18n()

// 语言切换处理函数
const handleLanguageChange = (lang: 'en-US' | 'zh-CN', close: () => void) => {
  switchLanguage(lang)
  close()
}
</script>

<style scoped>
.language-dropdown-menu {
  min-width: 120px;
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