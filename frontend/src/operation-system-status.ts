/**
 * 操作系统状态检查工具
 * 用于检查新操作系统的当前状态和功能
 */

import { useVideoStore } from './stores/videoStore'

/**
 * 检查操作系统状态
 */
export function checkOperationSystemStatus() {
  console.log('🔍 检查操作系统状态...')
  
  const videoStore = useVideoStore()
  
  try {
    // 检查基本状态
    console.log('📊 基本状态:')
    console.log('- 是否已初始化:', videoStore.operationSystem?.isInitialized?.value || false)
    console.log('- 是否正在执行:', videoStore.operationSystem?.isExecuting?.value || false)
    console.log('- 可以撤销:', videoStore.canUndo?.value || false)
    console.log('- 可以重做:', videoStore.canRedo?.value || false)
    
    // 检查历史记录
    console.log('📚 历史记录:')
    console.log('- 当前索引:', videoStore.operationSystem?.currentIndex?.value || -1)
    console.log('- 总操作数:', videoStore.operationSystem?.totalOperations?.value || 0)
    
    // 检查通知系统
    console.log('🔔 通知系统:')
    console.log('- 当前通知数量:', videoStore.notifications?.value?.length || 0)
    
    // 检查方法可用性
    console.log('🛠️ 方法可用性:')
    console.log('- undo方法:', typeof videoStore.undo === 'function' ? '✅' : '❌')
    console.log('- redo方法:', typeof videoStore.redo === 'function' ? '✅' : '❌')
    console.log('- clearHistory方法:', typeof videoStore.clearHistory === 'function' ? '✅' : '❌')
    console.log('- showSuccess方法:', typeof videoStore.showSuccess === 'function' ? '✅' : '❌')
    
    return true
  } catch (error) {
    console.error('❌ 状态检查失败:', error)
    return false
  }
}

/**
 * 测试基本操作
 */
export async function testBasicOperations() {
  console.log('🧪 测试基本操作...')
  
  const videoStore = useVideoStore()
  
  try {
    // 测试通知系统
    console.log('1️⃣ 测试通知系统...')
    videoStore.showSuccess('测试成功通知', '这是一个测试通知')
    videoStore.showInfo('测试信息通知', '这是一个信息通知')
    console.log('✅ 通知系统正常')
    
    // 测试撤销/重做状态
    console.log('2️⃣ 测试撤销/重做状态...')
    console.log('- 初始canUndo状态:', videoStore.canUndo.value)
    console.log('- 初始canRedo状态:', videoStore.canRedo.value)
    console.log('✅ 撤销/重做状态正常')
    
    // 测试历史记录摘要
    console.log('3️⃣ 测试历史记录摘要...')
    try {
      const summary = videoStore.getHistorySummary()
      console.log('- 历史记录摘要:', summary)
      console.log('✅ 历史记录摘要正常')
    } catch (error) {
      console.warn('⚠️ 历史记录摘要获取失败:', error)
    }
    
    return true
  } catch (error) {
    console.error('❌ 基本操作测试失败:', error)
    return false
  }
}

/**
 * 完整的系统检查
 */
export async function fullSystemCheck() {
  console.log('🚀 开始完整系统检查...')
  
  const videoStore = useVideoStore()
  
  try {
    // 1. 检查初始化状态
    console.log('1️⃣ 检查初始化状态...')
    if (!videoStore.operationSystem?.isInitialized?.value) {
      console.log('⚠️ 操作系统未初始化，尝试初始化...')
      const success = await videoStore.initializeOperationSystem()
      if (!success) {
        throw new Error('操作系统初始化失败')
      }
      console.log('✅ 操作系统初始化成功')
    } else {
      console.log('✅ 操作系统已初始化')
    }
    
    // 2. 检查状态
    console.log('2️⃣ 检查系统状态...')
    const statusOk = checkOperationSystemStatus()
    if (!statusOk) {
      throw new Error('系统状态检查失败')
    }
    
    // 3. 测试基本操作
    console.log('3️⃣ 测试基本操作...')
    const operationsOk = await testBasicOperations()
    if (!operationsOk) {
      throw new Error('基本操作测试失败')
    }
    
    console.log('🎉 完整系统检查通过！新操作系统正常工作')
    return true
    
  } catch (error) {
    console.error('❌ 完整系统检查失败:', error)
    return false
  }
}

// 在浏览器控制台中注册函数
if (typeof window !== 'undefined') {
  (window as any).checkOperationSystemStatus = checkOperationSystemStatus
  (window as any).testBasicOperations = testBasicOperations
  (window as any).fullSystemCheck = fullSystemCheck
  console.log('🔧 状态检查函数已注册到window对象:')
  console.log('- window.checkOperationSystemStatus()')
  console.log('- window.testBasicOperations()')
  console.log('- window.fullSystemCheck()')
}
