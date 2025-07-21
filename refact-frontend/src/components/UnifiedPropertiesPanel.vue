<template>
  <div class="properties-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <!-- 空状态 -->
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z" />
        </svg>
        <p>请选择时间轴上的对象</p>
        <p class="hint">选择片段以查看和编辑其属性</p>
      </div>

      <!-- 示例属性面板结构（空状态下不显示） -->
      <div v-if="false" class="properties-content">
        <div class="property-section">
          <h4>基础属性</h4>
          <div class="property-group">
            <div class="property-item">
              <label>名称</label>
              <input type="text" value="" disabled />
            </div>
            <div class="property-item">
              <label>持续时间</label>
              <input type="text" value="00:00:00" disabled />
            </div>
          </div>
        </div>

        <div class="property-section">
          <h4>变换</h4>
          <div class="property-group">
            <div class="property-item">
              <label>位置 X</label>
              <NumberInput :value="0" :disabled="true" />
            </div>
            <div class="property-item">
              <label>位置 Y</label>
              <NumberInput :value="0" :disabled="true" />
            </div>
            <div class="property-item">
              <label>缩放</label>
              <SliderInput :value="100" :min="0" :max="200" :disabled="true" />
            </div>
            <div class="property-item">
              <label>旋转</label>
              <SliderInput :value="0" :min="-180" :max="180" :disabled="true" />
            </div>
          </div>
        </div>

        <div class="property-section">
          <h4>效果</h4>
          <div class="property-group">
            <div class="property-item">
              <label>不透明度</label>
              <SliderInput :value="100" :min="0" :max="100" :disabled="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import NumberInput from './NumberInput.vue'
import SliderInput from './SliderInput.vue'

// 空壳状态 - 没有选中的项目
</script>

<style scoped>
.properties-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  padding: 12px 16px;
  background: var(--color-bg-primary);
  border-bottom: 1px solid var(--color-border-primary);
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  color: var(--color-text-soft);
}

.empty-state svg {
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 4px 0;
  font-size: 14px;
}

.empty-state .hint {
  font-size: 12px;
  opacity: 0.7;
}

.properties-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.property-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.property-section h4 {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-primary);
}

.property-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.property-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.property-item label {
  font-size: 12px;
  color: var(--color-text-soft);
  font-weight: 500;
}

.property-item input {
  padding: 6px 8px;
  border: 1px solid var(--color-border-primary);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 12px;
}

.property-item input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
