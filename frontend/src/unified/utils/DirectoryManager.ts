/**
 * File System Access API 目录权限管理器
 * 负责处理工作目录的选择、权限验证和持久化
 */
export class DirectoryManager {
  private static instance: DirectoryManager
  private workspaceHandle: FileSystemDirectoryHandle | null = null
  private readonly STORAGE_KEY = 'workspace_directory_handle'

  private constructor() {}

  static getInstance(): DirectoryManager {
    if (!DirectoryManager.instance) {
      DirectoryManager.instance = new DirectoryManager()
    }
    return DirectoryManager.instance
  }

  /**
   * 检查浏览器是否支持File System Access API
   */
  isSupported(): boolean {
    const hasBasicSupport = 'showDirectoryPicker' in window && 'FileSystemDirectoryHandle' in window

    if (hasBasicSupport) {
      console.log('✅ File System Access API 基础支持检测通过')

      // 检查权限API支持
      const testHandle = {} as FileSystemDirectoryHandle
      const hasPermissionAPI =
        'queryPermission' in FileSystemDirectoryHandle.prototype &&
        'requestPermission' in FileSystemDirectoryHandle.prototype

      if (hasPermissionAPI) {
        console.log('✅ 权限API支持检测通过')
      } else {
        console.warn('⚠️ 权限API不支持，将使用备用方案')
      }
    } else {
      console.error('❌ File System Access API 不支持')
    }

    return hasBasicSupport
  }

  /**
   * 检查是否已有工作目录权限
   */
  async hasWorkspaceAccess(): Promise<boolean> {
    if (!this.isSupported()) return false

    try {
      const handle = await this.restoreDirectoryHandle()
      if (!handle) return false

      // 检查queryPermission方法是否存在
      if (typeof handle.queryPermission === 'function') {
        const permission = await handle.queryPermission({ mode: 'readwrite' })
        return permission === 'granted'
      } else {
        // 如果queryPermission不存在，尝试直接访问目录来测试权限
        try {
          // 尝试读取目录内容来验证权限
          const entries = handle.entries()
          await entries.next()
          return true
        } catch (permissionError) {
          console.warn('目录访问权限不足:', permissionError)
          return false
        }
      }
    } catch (error) {
      console.warn('检查工作目录权限失败:', error)
      return false
    }
  }

  /**
   * 请求用户选择工作目录
   */
  async requestWorkspaceDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) {
      throw new Error('当前浏览器不支持File System Access API')
    }

    try {
      console.log('📂 打开目录选择对话框...')
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
      })

      console.log('📁 用户选择了目录:', directoryHandle.name)

      // 验证权限
      if (
        typeof directoryHandle.queryPermission === 'function' &&
        typeof directoryHandle.requestPermission === 'function'
      ) {
        const permission = await directoryHandle.queryPermission({ mode: 'readwrite' })
        if (permission !== 'granted') {
          const requestedPermission = await directoryHandle.requestPermission({ mode: 'readwrite' })
          if (requestedPermission !== 'granted') {
            throw new Error('需要读写权限才能管理项目文件')
          }
        }
      } else {
        // 如果权限API不可用，尝试直接访问来验证权限
        try {
          const entries = directoryHandle.entries()
          await entries.next()
        } catch (permissionError) {
          throw new Error('无法访问选择的目录，请确保有读写权限')
        }
      }

      // 只有验证成功后才保存目录句柄和更新内存中的引用
      await this.persistDirectoryHandle(directoryHandle)
      this.workspaceHandle = directoryHandle

      console.log('✅ 工作目录已设置:', directoryHandle.name)
      return directoryHandle
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('ℹ️ 用户取消了目录选择')
        return null
      }
      console.error('❌ 选择工作目录失败:', error)
      throw error
    }
  }

  /**
   * 获取当前工作目录句柄
   */
  async getWorkspaceHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (this.workspaceHandle) {
      return this.workspaceHandle
    }

    return await this.restoreDirectoryHandle()
  }

  /**
   * 验证并重新请求目录权限
   */
  async recheckPermissions(): Promise<boolean> {
    const handle = await this.getWorkspaceHandle()
    if (!handle) return false

    try {
      // 检查queryPermission和requestPermission方法是否存在
      if (
        typeof handle.queryPermission === 'function' &&
        typeof handle.requestPermission === 'function'
      ) {
        const permission = await handle.queryPermission({ mode: 'readwrite' })
        if (permission === 'granted') {
          return true
        }

        const requestedPermission = await handle.requestPermission({ mode: 'readwrite' })
        return requestedPermission === 'granted'
      } else {
        // 如果权限API不可用，尝试直接访问来测试权限
        try {
          const entries = handle.entries()
          await entries.next()
          return true
        } catch (permissionError) {
          console.warn('目录访问权限不足，需要重新选择目录:', permissionError)
          return false
        }
      }
    } catch (error) {
      console.warn('重新检查权限失败:', error)
      return false
    }
  }

  /**
   * 清除工作目录设置
   */
  async clearWorkspaceDirectory(): Promise<void> {
    console.log('🗑️ 清除工作目录设置...')
    this.workspaceHandle = null

    if ('indexedDB' in window) {
      try {
        const db = await this.openDB()
        const transaction = db.transaction(['handles'], 'readwrite')
        const store = transaction.objectStore('handles')

        // 使用Promise包装delete操作
        await new Promise<void>((resolve, reject) => {
          const request = store.delete(this.STORAGE_KEY)
          request.onsuccess = () => {
            console.log('✅ 目录句柄清除成功')
            resolve()
          }
          request.onerror = () => {
            console.error('❌ 目录句柄清除失败:', request.error)
            reject(request.error)
          }
        })

        db.close()
      } catch (error) {
        console.warn('清除目录句柄失败:', error)
      }
    }
  }

  /**
   * 获取工作目录信息
   */
  async getWorkspaceInfo(): Promise<{ name: string; path?: string } | null> {
    const handle = await this.getWorkspaceHandle()
    if (!handle) return null

    return {
      name: handle.name,
      // 注意：File System Access API 不提供完整路径信息
      path: undefined,
    }
  }

  /**
   * 调试方法：检查IndexedDB中的数据
   */
  async debugIndexedDB(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.log('IndexedDB不可用')
      return
    }

    try {
      const db = await this.openDB()
      const transaction = db.transaction(['handles'], 'readonly')
      const store = transaction.objectStore('handles')

      const allKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = store.getAllKeys()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      console.log('🔍 IndexedDB中的所有键:', allKeys)

      if (allKeys.includes(this.STORAGE_KEY)) {
        const handle = await new Promise<FileSystemDirectoryHandle | undefined>(
          (resolve, reject) => {
            const request = store.get(this.STORAGE_KEY)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          },
        )

        if (handle) {
          console.log('📁 找到保存的目录句柄:', handle.name, handle)
        } else {
          console.log('❌ 目录句柄为空')
        }
      } else {
        console.log('❌ 没有找到目录句柄键')
      }

      db.close()
    } catch (error) {
      console.error('调试IndexedDB失败:', error)
    }
  }

  /**
   * 持久化目录句柄到IndexedDB
   */
  private async persistDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB不可用，无法持久化目录句柄')
      return
    }

    try {
      console.log('💾 开始持久化目录句柄:', handle.name)
      const db = await this.openDB()
      const transaction = db.transaction(['handles'], 'readwrite')
      const store = transaction.objectStore('handles')

      // 使用Promise包装put操作
      await new Promise<void>((resolve, reject) => {
        const request = store.put(handle, this.STORAGE_KEY)
        request.onsuccess = () => {
          console.log('✅ 目录句柄持久化成功')
          resolve()
        }
        request.onerror = () => {
          console.error('❌ 目录句柄持久化失败:', request.error)
          reject(request.error)
        }
      })

      db.close()
    } catch (error) {
      console.error('持久化目录句柄失败:', error)
      throw error
    }
  }

  /**
   * 从IndexedDB恢复目录句柄
   */
  private async restoreDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB不可用，无法恢复目录句柄')
      return null
    }

    try {
      console.log('🔄 尝试从IndexedDB恢复目录句柄...')
      const db = await this.openDB()
      const transaction = db.transaction(['handles'], 'readonly')
      const store = transaction.objectStore('handles')

      // 使用Promise包装get操作
      const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
        const request = store.get(this.STORAGE_KEY)
        request.onsuccess = () => {
          const result = request.result as FileSystemDirectoryHandle | undefined
          if (result) {
            console.log('✅ 成功恢复目录句柄:', result.name)
          } else {
            console.log('ℹ️ 没有找到保存的目录句柄')
          }
          resolve(result)
        }
        request.onerror = () => {
          console.error('❌ 恢复目录句柄失败:', request.error)
          reject(request.error)
        }
      })

      db.close()

      if (handle) {
        this.workspaceHandle = handle
        return handle
      }
    } catch (error) {
      console.warn('恢复目录句柄失败:', error)
    }

    return null
  }

  /**
   * 打开IndexedDB数据库
   */
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('VideoEditorDB', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles')
        }
      }
    })
  }
}

// 导出单例实例
export const directoryManager = DirectoryManager.getInstance()
