/**
 * 脚本执行器 - 在沙箱环境中执行用户JS代码
 * 负责将用户函数调用转换为操作配置
 *
 * 设计为一次性使用，执行完成后自动清理资源
 */
import { ConfigValidator } from './ConfigValidator'

interface OperationConfig {
  type: string
  params: any
}

export class ScriptExecutor {
  private configValidator = new ConfigValidator()
  private worker: Worker | null = null;

  constructor() {
    // 立即初始化worker，避免延迟
    this.initializeWorker();
  }

  /**
   * 初始化Web Worker
   */
  private initializeWorker(): void {
    if (this.worker) {
      this.worker.terminate();
    }
    
    // 创建Worker实例
    const workerUrl = new URL('./ScriptExecutor.worker.ts', import.meta.url);
    this.worker = new Worker(workerUrl, { type: 'module' });
  }

  /**
   * 执行用户代码并生成操作配置 - 执行并验证配置
   * @param script 用户JavaScript代码
   * @param timeout 超时时间（毫秒）
   * @param validate 是否验证操作配置（默认启用）
   * @returns 验证通过的操作配置数组
   */
  async executeScript(script: string, timeout: number = 5000, validate: boolean = true): Promise<OperationConfig[]> {
    if (!this.worker) {
      throw new Error('Worker未初始化');
    }

    return new Promise((resolve, reject) => {
      let timeoutId: number;
      let isResolved = false;

      // 设置超时处理
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.cleanup();
          reject(new Error(`执行超时(${timeout}ms)`));
        }
      }, timeout);

      // 设置一次性消息处理
      const messageHandler = (event: MessageEvent) => {
        if (isResolved) return;
        
        isResolved = true;
        clearTimeout(timeoutId);
        
        const { success, operations, error } = event.data;
        
        if (success) {
          let resultOperations = operations || [];
          
          // 如果启用了验证，对生成的操作进行验证
          if (validate) {
            const validationResult = this.configValidator.validateOperations(resultOperations);
            
            if (validationResult.errors.length > 0) {
              // 验证失败，生成详细的错误消息
              const errorMessages = validationResult.errors.map(e =>
                `操作 ${e.operation.type}: ${e.error}`
              ).join('\n');
              
              reject(new Error(`配置验证失败:\n${errorMessages}`));
              return;
            }
            
            // 验证通过，使用验证后的操作（即使为空数组也保留）
            resultOperations = validationResult.validOperations || resultOperations;
          }
          
          resolve(resultOperations);
        } else {
          reject(new Error(`脚本执行失败: ${error}`));
        }
        
        // 自动清理资源
        this.cleanup();
      };

      // 再次检查 worker 状态
      if (!this.worker) {
        reject(new Error('Worker在执行过程中被释放'));
        return;
      }

      this.worker.addEventListener('message', messageHandler, { once: true });
      this.worker.addEventListener('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(new Error(`Worker错误: ${error.message}`));
          this.cleanup();
        }
      }, { once: true });

      // 发送执行请求
      this.worker.postMessage({
        script: script
      });
    });
  }

  /**
   * 清理资源 - 终止worker并释放内存
   */
  private cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * 析构函数 - 确保资源被清理
   */
  destroy(): void {
    this.cleanup();
  }
}