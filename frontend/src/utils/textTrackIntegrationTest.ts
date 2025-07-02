/**
 * 文本轨道集成测试工具
 * 用于验证文本轨道功能的完整性
 */

import type { TextTimelineItem, TextStyleConfig } from '../types'
import { isTrackCompatible, isOperationAllowed } from './clipConstraints'
import { createDefaultTextItem, validateTextTimelineItem } from './textTimelineUtils'

/**
 * 文本轨道功能测试套件
 */
export class TextTrackIntegrationTest {
  private testResults: Array<{ name: string; passed: boolean; error?: string }> = []

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<{ passed: number; failed: number; results: any[] }> {
    console.log('🧪 开始文本轨道集成测试...')
    
    this.testResults = []
    
    // 运行各项测试
    await this.testTrackCompatibility()
    await this.testOperationConstraints()
    await this.testTextItemCreation()
    await this.testTextItemValidation()
    
    // 统计结果
    const passed = this.testResults.filter(r => r.passed).length
    const failed = this.testResults.filter(r => !r.passed).length
    
    console.log(`🧪 文本轨道集成测试完成: ${passed} 通过, ${failed} 失败`)
    
    if (failed > 0) {
      console.error('❌ 失败的测试:')
      this.testResults.filter(r => !r.passed).forEach(r => {
        console.error(`  - ${r.name}: ${r.error}`)
      })
    }
    
    return { passed, failed, results: this.testResults }
  }

  /**
   * 测试轨道兼容性
   */
  private async testTrackCompatibility() {
    try {
      // 文本应该只能在文本轨道上
      const textOnTextTrack = isTrackCompatible('text', 'text')
      const textOnVideoTrack = isTrackCompatible('text', 'video')
      const textOnAudioTrack = isTrackCompatible('text', 'audio')
      
      // 其他媒体类型不应该在文本轨道上
      const videoOnTextTrack = isTrackCompatible('video', 'text')
      const imageOnTextTrack = isTrackCompatible('image', 'text')
      const audioOnTextTrack = isTrackCompatible('audio', 'text')
      
      if (textOnTextTrack && !textOnVideoTrack && !textOnAudioTrack && 
          !videoOnTextTrack && !imageOnTextTrack && !audioOnTextTrack) {
        this.addTestResult('轨道兼容性检查', true)
      } else {
        this.addTestResult('轨道兼容性检查', false, '轨道兼容性规则不正确')
      }
    } catch (error) {
      this.addTestResult('轨道兼容性检查', false, (error as Error).message)
    }
  }

  /**
   * 测试操作限制
   */
  private async testOperationConstraints() {
    try {
      // 文本应该支持的操作
      const supportedOps = ['move', 'resize', 'copy', 'delete', 'style-edit']
      const unsupportedOps = ['crop', 'split', 'trim']
      
      const supportedResults = supportedOps.map(op => isOperationAllowed(op, 'text'))
      const unsupportedResults = unsupportedOps.map(op => isOperationAllowed(op, 'text'))
      
      const allSupportedPass = supportedResults.every(r => r === true)
      const allUnsupportedPass = unsupportedResults.every(r => r === false)
      
      if (allSupportedPass && allUnsupportedPass) {
        this.addTestResult('操作限制检查', true)
      } else {
        this.addTestResult('操作限制检查', false, '操作限制规则不正确')
      }
    } catch (error) {
      this.addTestResult('操作限制检查', false, (error as Error).message)
    }
  }

  /**
   * 测试文本项目创建
   */
  private async testTextItemCreation() {
    try {
      // 创建测试文本项目
      const textItem = await createDefaultTextItem('test-track-id', 100)
      
      // 验证基本属性
      if (!textItem.id || !textItem.config || !textItem.sprite) {
        this.addTestResult('文本项目创建', false, '缺少必要属性')
        return
      }
      
      // 验证媒体类型
      if (textItem.mediaType !== 'text') {
        this.addTestResult('文本项目创建', false, '媒体类型不正确')
        return
      }
      
      // 验证配置结构
      const config = textItem.config
      if (!config.text || !config.style || typeof config.x !== 'number' || typeof config.y !== 'number') {
        this.addTestResult('文本项目创建', false, '配置结构不完整')
        return
      }
      
      // 验证时间范围
      if (!textItem.timeRange || typeof textItem.timeRange.timelineStartTime !== 'number') {
        this.addTestResult('文本项目创建', false, '时间范围不正确')
        return
      }
      
      this.addTestResult('文本项目创建', true)
    } catch (error) {
      this.addTestResult('文本项目创建', false, (error as Error).message)
    }
  }

  /**
   * 测试文本项目验证
   */
  private async testTextItemValidation() {
    try {
      // 创建有效的文本项目
      const validTextItem = await createDefaultTextItem('test-track-id', 100)
      
      // 测试有效项目验证
      const validResult = validateTextTimelineItem(validTextItem)
      if (!validResult) {
        this.addTestResult('文本项目验证', false, '有效项目验证失败')
        return
      }
      
      // 测试无效项目验证
      const invalidItem = { ...validTextItem, mediaType: 'video' }
      const invalidResult = validateTextTimelineItem(invalidItem)
      if (invalidResult) {
        this.addTestResult('文本项目验证', false, '无效项目验证应该失败')
        return
      }
      
      // 测试缺少属性的项目
      const incompleteItem = { id: 'test', mediaType: 'text' }
      const incompleteResult = validateTextTimelineItem(incompleteItem)
      if (incompleteResult) {
        this.addTestResult('文本项目验证', false, '不完整项目验证应该失败')
        return
      }
      
      this.addTestResult('文本项目验证', true)
    } catch (error) {
      this.addTestResult('文本项目验证', false, (error as Error).message)
    }
  }

  /**
   * 添加测试结果
   */
  private addTestResult(name: string, passed: boolean, error?: string) {
    this.testResults.push({ name, passed, error })
    
    if (passed) {
      console.log(`✅ ${name}: 通过`)
    } else {
      console.error(`❌ ${name}: 失败 - ${error}`)
    }
  }
}

/**
 * 快速运行文本轨道集成测试
 */
export async function runTextTrackIntegrationTest(): Promise<boolean> {
  const test = new TextTrackIntegrationTest()
  const results = await test.runAllTests()
  return results.failed === 0
}

/**
 * 文本轨道功能演示
 * 展示如何使用文本轨道的各种功能
 */
export async function demonstrateTextTrackFeatures() {
  console.log('🎨 文本轨道功能演示开始...')
  
  try {
    // 1. 创建文本项目
    console.log('1. 创建文本项目')
    const textItem = await createDefaultTextItem('demo-track', 0)
    console.log('   文本项目创建成功:', {
      id: textItem.id,
      text: textItem.config.text,
      position: { x: textItem.config.x, y: textItem.config.y }
    })
    
    // 2. 验证轨道兼容性
    console.log('2. 验证轨道兼容性')
    const compatibility = {
      textOnText: isTrackCompatible('text', 'text'),
      textOnVideo: isTrackCompatible('text', 'video'),
      videoOnText: isTrackCompatible('video', 'text')
    }
    console.log('   兼容性检查结果:', compatibility)
    
    // 3. 验证操作限制
    console.log('3. 验证操作限制')
    const operations = {
      move: isOperationAllowed('move', 'text'),
      crop: isOperationAllowed('crop', 'text'),
      split: isOperationAllowed('split', 'text')
    }
    console.log('   操作限制检查结果:', operations)
    
    // 4. 验证项目结构
    console.log('4. 验证项目结构')
    const isValid = validateTextTimelineItem(textItem)
    console.log('   项目验证结果:', isValid)
    
    console.log('✅ 文本轨道功能演示完成')
    return true
  } catch (error) {
    console.error('❌ 文本轨道功能演示失败:', error)
    return false
  }
}

/**
 * 性能测试：批量创建文本项目
 */
export async function performanceTestTextCreation(count: number = 10): Promise<number> {
  console.log(`⚡ 开始性能测试：创建 ${count} 个文本项目`)
  
  const startTime = performance.now()
  
  try {
    const promises = Array.from({ length: count }, (_, i) => 
      createDefaultTextItem(`perf-track-${i}`, i * 100)
    )
    
    const textItems = await Promise.all(promises)
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    console.log(`✅ 性能测试完成: ${count} 个文本项目创建耗时 ${duration.toFixed(2)}ms`)
    console.log(`   平均每个项目: ${(duration / count).toFixed(2)}ms`)
    
    // 验证所有项目都创建成功
    const allValid = textItems.every(item => validateTextTimelineItem(item))
    if (!allValid) {
      console.warn('⚠️ 部分文本项目创建不完整')
    }
    
    return duration
  } catch (error) {
    console.error('❌ 性能测试失败:', error)
    return -1
  }
}
