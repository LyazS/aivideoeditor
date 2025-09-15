// 脚本执行Worker - 在沙箱环境中执行用户代码
let operations: any[] = [];

// 构建API对象 - 直接定义函数避免字符串转换
const buildAPI = () => {
  return {
    // 时间轴项目操作
    addTimelineItem: (item: any) => {
      const result = { type: 'addTimelineItem', params: item };
      operations.push(result);
      return result;
    },
    
    rmTimelineItem: (id: string) => {
      const result = { type: 'rmTimelineItem', params: { timelineItemId: id } };
      operations.push(result);
      return result;
    },
    
    mvTimelineItem: (id: string, position: number, trackId: string) => {
      const result = { type: 'mvTimelineItem', params: { timelineItemId: id, newPosition: position, newTrackId: trackId } };
      operations.push(result);
      return result;
    },

    // 轨道操作
    addTrack: (type: string = 'video', position?: number) => {
      const result = { type: 'addTrack', params: { type, position } };
      operations.push(result);
      return result;
    },
    
    rmTrack: (id: string) => {
      const result = { type: 'rmTrack', params: { trackId: id } };
      operations.push(result);
      return result;
    },
    
    renameTrack: (id: string, name: string) => {
      const result = { type: 'renameTrack', params: { trackId: id, newName: name } };
      operations.push(result);
      return result;
    },

    // 文本操作
    updateTextContent: (id: string, text: string, style?: any) => {
      const result = { type: 'updateTextContent', params: { timelineItemId: id, newText: text, newStyle: style } };
      operations.push(result);
      return result;
    },
    
    updateTextStyle: (id: string, style: any) => {
      const result = { type: 'updateTextStyle', params: { timelineItemId: id, newStyle: style } };
      operations.push(result);
      return result;
    },

    // 关键帧操作
    createKeyframe: (id: string, position: number) => {
      const result = { type: 'createKeyframe', params: { timelineItemId: id, position } };
      operations.push(result);
      return result;
    },
    
    deleteKeyframe: (id: string, position: number) => {
      const result = { type: 'deleteKeyframe', params: { timelineItemId: id, position } };
      operations.push(result);
      return result;
    },
    
    updateKeyframeProperty: (id: string, position: number, property: string, value: any) => {
      const result = { type: 'updateKeyframeProperty', params: { timelineItemId: id, position, property, value } };
      operations.push(result);
      return result;
    },
    
    clearAllKeyframes: (id: string) => {
      const result = { type: 'clearAllKeyframes', params: { timelineItemId: id } };
      operations.push(result);
      return result;
    },

    // 其他操作
    splitTimelineItem: (id: string, position: number) => {
      const result = { type: 'splitTimelineItem', params: { timelineItemId: id, splitPosition: position } };
      operations.push(result);
      return result;
    },
    
    cpTimelineItem: (id: string, position: number, trackId: string) => {
      const result = { type: 'cpTimelineItem', params: { timelineItemId: id, newPosition: position, newTrackId: trackId } };
      operations.push(result);
      return result;
    },
    
    resizeTimelineItem: (id: string, timeRange: any) => {
      const result = { type: 'resizeTimelineItem', params: { timelineItemId: id, newTimeRange: timeRange } };
      operations.push(result);
      return result;
    },
    
    updateTimelineItemTransform: (id: string, transform: any) => {
      const result = { type: 'updateTimelineItemTransform', params: { timelineItemId: id, newTransform: transform } };
      operations.push(result);
      return result;
    },

    autoArrangeTrack: (id: string) => {
      const result = { type: 'autoArrangeTrack', params: { trackId: id } };
      operations.push(result);
      return result;
    },
    
    toggleTrackVisibility: (id: string, visible: boolean) => {
      const result = { type: 'toggleTrackVisibility', params: { trackId: id, visible } };
      operations.push(result);
      return result;
    },
    
    toggleTrackMute: (id: string, muted: boolean) => {
      const result = { type: 'toggleTrackMute', params: { trackId: id, muted } };
      operations.push(result);
      return result;
    },
  };
};

// Worker消息处理 - 直接执行用户脚本
self.onmessage = async function (e) {
  const { script } = e.data;
  
  try {
    // 重置操作数组
    operations = [];
    
    // 创建API上下文
    const api = buildAPI();
    
    // 创建执行函数并执行
    const functionKeys = Object.keys(api);
    const functionValues = functionKeys.map(key => api[key as keyof typeof api]);
    
    const userFunction = new Function(...functionKeys, script);
    userFunction(...functionValues);
    
    // 返回结果
    self.postMessage({
      success: true,
      operations: operations
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};