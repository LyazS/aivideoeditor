# HoverButton 组件

基于播放控制按钮样式的通用按钮组件，具有简洁的外观和流畅的hover效果。

## 特性

- 🎨 简洁的设计，正常状态下无背景，hover时高亮
- 🔧 支持多种变体：default、primary、small
- 🎯 灵活的内容支持：文本、图标、自定义内容
- ♿ 完整的无障碍支持
- 🎭 平滑的过渡动画

## 基本用法

### 纯文本按钮
```vue
<HoverButton text="保存" @click="handleSave" />
```

### 图标按钮
```vue
<HoverButton title="播放">
  <template #icon>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
    </svg>
  </template>
</HoverButton>
```

### 图标 + 文本按钮
```vue
<HoverButton text="导入文件" title="导入新文件">
  <template #icon>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
    </svg>
  </template>
</HoverButton>
```

### 自定义内容
```vue
<HoverButton @click="handleAction">
  <span>自定义</span>
  <strong>内容</strong>
</HoverButton>
```

## 变体

### 默认变体
```vue
<HoverButton text="默认按钮" />
```

### 主要变体（更大内边距）
```vue
<HoverButton text="主要按钮" variant="primary" />
```

### 小尺寸变体
```vue
<HoverButton text="小按钮" variant="small" />
```

## 属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| text | string | - | 按钮文本 |
| variant | 'default' \| 'primary' \| 'small' | 'default' | 按钮变体 |
| disabled | boolean | false | 是否禁用 |
| title | string | - | 悬停提示 |
| class | string | - | 额外的CSS类 |

## 事件

| 事件 | 参数 | 说明 |
|------|------|------|
| click | (event: MouseEvent) | 点击事件 |

## 插槽

| 插槽 | 说明 |
|------|------|
| default | 默认内容插槽 |
| icon | 图标插槽 |

## 样式特点

- **正常状态**: 透明背景，次要文本颜色
- **Hover状态**: 四级背景色，主要文本颜色
- **Active状态**: 轻微的向下位移效果
- **禁用状态**: 50%透明度，禁用鼠标指针

## 设计理念

这个按钮组件遵循"内容优先"的设计理念：
- 正常状态下保持简洁，不干扰内容
- 只在用户交互时提供视觉反馈
- 保持一致的视觉层次和间距
