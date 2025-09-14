import type { OperationConfig, ExecutionAPI, WebWorkerExecutor } from './ScriptExecutorTypes'

/**
 * 脚本执行器 - 在沙箱环境中执行用户JS代码
 * 负责将用户函数调用转换为操作配置
 */
export class ScriptExecutor {
  private operations: OperationConfig[] = []
  private api: ExecutionAPI

  constructor() {
    this.api = this.createExecutionAPI()
  }

  /**
   * 记录操作配置
   */
  private recordOperation(type: string, params: any): OperationConfig {
    const operation: OperationConfig = {
      type,
      params,
      timestamp: Date.now(),
      id: this.generateOperationId(),
    }
    // 注意：这里我们仍然需要在主线程中记录，但真正的操作会在Worker中记录
    this.operations.push(operation)
    return operation
  }

  /**
   * 生成操作ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 创建安全的API接口 - 但现在是轻量级的包装器
   */
  private createExecutionAPI(): ExecutionAPI {
    return {
      // 时间轴项目操作
      addTimelineItem: (item) => {
        this.recordOperation('addTimelineItem', item)
        return { type: 'addTimelineItem', params: item } as OperationConfig
      },
      rmTimelineItem: (id) => {
        const params = { timelineItemId: id }
        this.recordOperation('rmTimelineItem', params)
        return { type: 'rmTimelineItem', params } as OperationConfig
      },
      mvTimelineItem: (id, position, trackId) => {
        const params = { timelineItemId: id, newPosition: position, newTrackId: trackId }
        this.recordOperation('mvTimelineItem', params)
        return { type: 'mvTimelineItem', params } as OperationConfig
      },

      // 轨道操作
      addTrack: (type = 'video', position) => {
        const params = { type, position }
        this.recordOperation('addTrack', params)
        return { type: 'addTrack', params } as OperationConfig
      },
      rmTrack: (id) => {
        const params = { trackId: id }
        this.recordOperation('rmTrack', params)
        return { type: 'rmTrack', params } as OperationConfig
      },
      renameTrack: (id, name) => {
        const params = { trackId: id, newName: name }
        this.recordOperation('renameTrack', params)
        return { type: 'renameTrack', params } as OperationConfig
      },

      // 文本操作
      updateTextContent: (id, text, style) => {
        const params = { timelineItemId: id, newText: text, newStyle: style }
        this.recordOperation('updateTextContent', params)
        return { type: 'updateTextContent', params } as OperationConfig
      },
      updateTextStyle: (id, style) => {
        const params = { timelineItemId: id, newStyle: style }
        this.recordOperation('updateTextStyle', params)
        return { type: 'updateTextStyle', params } as OperationConfig
      },

      // 关键帧操作
      createKeyframe: (id, position) => {
        const params = { timelineItemId: id, position }
        this.recordOperation('createKeyframe', params)
        return { type: 'createKeyframe', params } as OperationConfig
      },
      deleteKeyframe: (id, position) => {
        const params = { timelineItemId: id, position }
        this.recordOperation('deleteKeyframe', params)
        return { type: 'deleteKeyframe', params } as OperationConfig
      },
      updateKeyframeProperty: (id, position, property, value) => {
        const params = { timelineItemId: id, position, property, value }
        this.recordOperation('updateKeyframeProperty', params)
        return { type: 'updateKeyframeProperty', params } as OperationConfig
      },
      clearAllKeyframes: (id) => {
        const params = { timelineItemId: id }
        this.recordOperation('clearAllKeyframes', params)
        return { type: 'clearAllKeyframes', params } as OperationConfig
      },

      // 其他操作
      splitTimelineItem: (id, position) => {
        const params = { timelineItemId: id, splitPosition: position }
        this.recordOperation('splitTimelineItem', params)
        return { type: 'splitTimelineItem', params } as OperationConfig
      },
      cpTimelineItem: (id, position, trackId) => {
        const params = { timelineItemId: id, newPosition: position, newTrackId: trackId }
        this.recordOperation('cpTimelineItem', params)
        return { type: 'cpTimelineItem', params } as OperationConfig
      },
      resizeTimelineItem: (id, timeRange) => {
        const params = { timelineItemId: id, newTimeRange: timeRange }
        this.recordOperation('resizeTimelineItem', params)
        return { type: 'resizeTimelineItem', params } as OperationConfig
      },
      updateTimelineItemTransform: (id, transform) => {
        const params = { timelineItemId: id, newTransform: transform }
        this.recordOperation('updateTimelineItemTransform', params)
        return { type: 'updateTimelineItemTransform', params } as OperationConfig
      },

      autoArrangeTrack: (id) => {
        this.recordOperation('autoArrangeTrack', { trackId: id })
        return { type: 'autoArrangeTrack', params: { trackId: id } } as OperationConfig
      },
      toggleTrackVisibility: (id, visible) => {
        const params = { trackId: id, visible }
        this.recordOperation('toggleTrackVisibility', params)
        return { type: 'toggleTrackVisibility', params } as OperationConfig
      },
      toggleTrackMute: (id, muted) => {
        const params = { trackId: id, muted }
        this.recordOperation('toggleTrackMute', params)
        return { type: 'toggleTrackMute', params } as OperationConfig
      },
    }
  }

  /**
   * 执行用户代码并生成操作配置 - 基于Web Worker的安全执行
   */
  async executeScript(script: string): Promise<OperationConfig[]> {
    // 重置操作数组
    this.operations = []

    try {
      // 创建Web Worker执行器
      const executor = this.createWebWorkerExecutor()

      // 准备API函数映射
      const api = this.createExecutionAPI()
      const fnMap = Object.keys(api).reduce(
        (map, key) => {
          map[key] = api[key as keyof ExecutionAPI].toString()
          return map
        },
        {} as Record<string, string>,
      )

      // 注册函数到Worker
      await executor.registerFunctions(fnMap)

      // 执行用户脚本
      await executor.exec(script)

      // 返回当前的操作数组 - Worker返回的结果已经包含了正确的操作
      return [...this.operations]
    } catch (error) {
      throw new Error(`脚本执行失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 创建Web Worker执行器 - 使用完全动态的方法
   */
  private createWebWorkerExecutor(defaultTimeout = 5000): WebWorkerExecutor {
    const workerCode = `
      let operations = [];
      const registry = {};
      
      // 核心记录函数
      function recordOperation(type, params) {
        const operation = {
          type: type,
          params: params,
          timestamp: Date.now(),
          id: 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };
        operations.push(operation);
        return operation;
      }
      
      // 动态函数执行器
      function executeFunction(fnName, args) {
        if (!registry[fnName]) {
          throw new Error('Function ' + fnName + ' is not registered');
        }
        return registry[fnName].apply(this, args);
      }
      
      // Worker消息处理
      self.onmessage = function (e) {
        const { id, type, fnMap, code } = e.data;
        try {
          if (type === 'registerBatch') {
            // 动态注册所有函数
            for (let key in fnMap) {
              registry[key] = eval('(' + fnMap[key] + ')');
            }
            self.postMessage({ id, result: true });
            return;
          }
          
          if (type === 'exec') {
            try {
              // 重置操作数组
              operations = [];
              
              // 创建执行上下文 - 只提供registry中的函数
              const context = {};
              for (let key in registry) {
                context[key] = registry[key];
              }
              
              // 创建并执行函数
              const executableFunction = new Function(...Object.keys(context), code);
              executableFunction(...Object.values(context));
              
              // 返回操作数组
              self.postMessage({ 
                id, 
                result: { 
                  operations: operations, 
                  success: true 
                } 
              });
            } catch (err) {
              self.postMessage({ id, error: err.message });
            }
            return;
          }
        } catch (err) {
          self.postMessage({ id, error: err.message });
        }
      };
    `

    let worker: Worker
    let workerUrl: string
    let callbacks = new Map<string, { resolve: Function; reject: Function }>()

    const genId = () => Math.random().toString(36).slice(2)

    const initWorker = () => {
      if (worker) worker.terminate()
      if (workerUrl) URL.revokeObjectURL(workerUrl)

      const blob = new Blob([workerCode], { type: 'application/javascript' })
      workerUrl = URL.createObjectURL(blob)
      worker = new Worker(workerUrl)

      worker.onmessage = (e) => {
        const { id, result, error } = e.data
        const cb = callbacks.get(id)
        if (cb) {
          if (error) cb.reject(new Error(error))
          else cb.resolve(result)
          callbacks.delete(id)
        }
      }
    }

    initWorker()

    return {
      registerFunctions: async (fnMap: Record<string, string>) => {
        return new Promise((resolve, reject) => {
          const id = genId()
          callbacks.set(id, { resolve, reject })
          worker.postMessage({
            id,
            type: 'registerBatch',
            fnMap,
          })
        })
      },

      exec: async (code: string, args: Record<string, any> = {}, timeout = defaultTimeout) => {
        return new Promise((resolve, reject) => {
          const id = genId()
          callbacks.set(id, { resolve, reject })

          worker.postMessage({
            id,
            type: 'exec',
            code,
            args,
            timeout,
          })

          // 超时终止逻辑
          const timer = setTimeout(() => {
            if (callbacks.has(id)) {
              callbacks.get(id)?.reject(new Error(`执行超时(${timeout}ms)`))
              callbacks.delete(id)

              // 重建Worker
              initWorker()
            }
          }, timeout)

          // 超时完成时清除定时器
          const origResolve = resolve
          const origReject = reject
          callbacks.set(id, {
            resolve: (val: any) => {
              clearTimeout(timer)
              origResolve(val)
            },
            reject: (err: any) => {
              clearTimeout(timer)
              origReject(err)
            },
          })
        })
      },

      terminate: () => {
        worker.terminate()
        URL.revokeObjectURL(workerUrl)
        callbacks.clear()
      },
    }
  }
}