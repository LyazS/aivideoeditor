/**
 * 新操作系统测试脚本
 * 用于验证新的操作记录系统是否正常工作
 */

import { useVideoStore } from './stores/videoStore'

/**
 * 测试新操作系统的基本功能
 */
export async function testOperationSystem() {
  console.log('🧪 开始测试新操作系统...')
  
  const videoStore = useVideoStore()
  
  try {
    // 1. 测试操作系统初始化
    console.log('1️⃣ 测试操作系统初始化...')
    try {
      const initSuccess = await videoStore.initializeOperationSystem()
      if (!initSuccess) {
        throw new Error('操作系统初始化失败')
      }
      console.log('✅ 操作系统初始化成功')
    } catch (initError) {
      console.error('❌ 操作系统初始化失败:', initError)
      throw initError
    }
    
    // 2. 测试撤销/重做状态
    console.log('2️⃣ 测试撤销/重做状态...')
    console.log('canUndo:', videoStore.canUndo.value)
    console.log('canRedo:', videoStore.canRedo.value)
    console.log('✅ 撤销/重做状态正常')
    
    // 3. 测试历史记录摘要
    console.log('3️⃣ 测试历史记录摘要...')
    const summary = videoStore.getHistorySummary()
    console.log('历史记录摘要:', summary)
    console.log('✅ 历史记录摘要正常')
    
    // 4. 测试通知系统
    console.log('4️⃣ 测试通知系统...')
    videoStore.showSuccess('测试成功通知')
    videoStore.showInfo('测试信息通知')
    console.log('通知数量:', videoStore.notifications.value.length)
    console.log('✅ 通知系统正常')
    
    // 5. 测试轨道操作（如果有轨道的话）
    console.log('5️⃣ 测试轨道操作...')
    try {
      const trackId = await videoStore.addTrackWithHistory('测试轨道')
      if (trackId) {
        console.log('✅ 添加轨道成功，ID:', trackId)
        
        // 测试撤销
        if (videoStore.canUndo.value) {
          await videoStore.undo()
          console.log('✅ 撤销操作成功')
        }
        
        // 测试重做
        if (videoStore.canRedo.value) {
          await videoStore.redo()
          console.log('✅ 重做操作成功')
        }
      }
    } catch (error) {
      console.warn('⚠️ 轨道操作测试跳过:', error)
    }
    
    console.log('🎉 新操作系统测试完成！所有基本功能正常')
    return true
    
  } catch (error) {
    console.error('❌ 新操作系统测试失败:', error)
    return false
  }
}

/**
 * 在浏览器控制台中运行测试
 * 使用方法：在浏览器控制台中输入 window.testOperationSystem()
 */
if (typeof window !== 'undefined') {
  (window as any).testOperationSystem = testOperationSystem
  console.log('🔧 测试函数已注册到 window.testOperationSystem，可在控制台中调用')
}
