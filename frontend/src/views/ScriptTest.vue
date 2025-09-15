<template>
  <div class="script-test-container">
    <div class="header">
      <h1>Script Executor 测试页面</h1>
      <button class="back-btn" @click="goBack">返回</button>
    </div>
    
    <div class="test-section">
      <div class="input-section">
        <label for="scriptInput">测试脚本:</label>
        <textarea 
          id="scriptInput"
          v-model="testScript" 
          placeholder="在此输入要测试的脚本代码..."
          rows="10"
          cols="60"
        ></textarea>
        
        <div class="example-buttons">
          <button @click="loadExample1">加载示例1: 添加轨道和项目</button>
          <button @click="loadExample2">加载示例2: 文本操作</button>
          <button @click="loadExample3">加载示例3: 关键帧操作</button>
          <button @click="loadExample4">加载示例4: 死循环测试 - while(true)</button>
          <button @click="loadExample5">加载示例5: 死循环测试 - 无限递归</button>
          <button @click="loadExample6">加载示例6: 死循环测试 - 密集计算</button>
        </div>
      </div>
      
      <div class="control-section">
        <button @click="executeScript" :disabled="isExecuting">
          {{ isExecuting ? '执行中...' : '执行脚本' }}
        </button>
        <button @click="clearResults">清除结果</button>
      </div>
      
      <div class="results-section">
        <h3>执行结果:</h3>
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>
        
        <div v-if="operations.length > 0">
          <h4>生成的操作列表:</h4>
          <div class="operations-list">
            <div
              v-for="(op, index) in operations"
              :key="index"
              class="operation-item"
            >
              <strong>操作 {{ index + 1 }}:</strong> {{ op.type }}
              <div class="operation-params">
                参数: {{ JSON.stringify(op.params, null, 2) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ScriptExecutor } from '@/agent/ScriptExecutor'

type OperationConfig = {
  type: string
  params: any
}

const router = useRouter()

const testScript = ref('')
const isExecuting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const operations = ref<OperationConfig[]>([])

// 示例脚本
const exampleScripts = {
  example1: `// 添加轨道和项目
addTrack("video", 0);
addTimelineItem({
  type: "video",
  trackId: "track_1",
  duration: 5000,
  position: 0
});
addTrack("audio", 1);
addTimelineItem({
  type: "audio", 
  trackId: "track_2",
  duration: 3000,
  position: 1000
});`,

  example2: `// 文本操作
addTrack("text", 2);
addTimelineItem({
  type: "text",
  trackId: "track_3", 
  duration: 2000,
  position: 0,
  text: "Hello World"
});
updateTextContent("item_1", "Updated Text", {
  fontSize: 24,
  color: "#ff0000",
  fontWeight: "bold"
});`,

  example3: `// 关键帧操作
addTrack("video", 0);
addTimelineItem({
  type: "video",
  trackId: "track_1",
  duration: 10000,
  position: 0
});
createKeyframe("item_1", "0%");
createKeyframe("item_1", "50%");
createKeyframe("item_1", "100%");
updateKeyframeProperty("item_1", "0%", "opacity", 0);
updateKeyframeProperty("item_1", "50%", "opacity", 0.5);
updateKeyframeProperty("item_1", "100%", "opacity", 1);`,

  example4: `// 死循环测试 - while(true)
let counter = 0;
while(true) {
  counter++;
  if (counter % 1000000 === 0) {
    console.log('循环计数: ' + counter);
  }
}`,

  example5: `// 死循环测试 - 无限递归
function infiniteRecursion(depth) {
  console.log('递归深度: ' + depth);
  // 没有终止条件，会导致栈溢出
  return infiniteRecursion(depth + 1);
}
infiniteRecursion(1);`,

  example6: `// 死循环测试 - 密集计算
function intensiveCalculation() {
  let result = 0;
  while(true) {
    // 执行大量数学计算以消耗CPU
    for(let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i);
    }
    console.log('计算结果: ' + result);
  }
}
intensiveCalculation();`
}

function loadExample1() {
  testScript.value = exampleScripts.example1
}

function loadExample2() {
  testScript.value = exampleScripts.example2
}

function loadExample3() {
  testScript.value = exampleScripts.example3
}

function loadExample4() {
  testScript.value = exampleScripts.example4
}

function loadExample5() {
  testScript.value = exampleScripts.example5
}

function loadExample6() {
  testScript.value = exampleScripts.example6
}

async function executeScript() {
  if (!testScript.value.trim()) {
    errorMessage.value = '请输入测试脚本'
    return
  }

  isExecuting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  operations.value = []

  try {
    // 每次执行都重新实例化 ScriptExecutor
    const scriptExecutor = new ScriptExecutor()
    const result = await scriptExecutor.executeScript(testScript.value)
    operations.value = result
    successMessage.value = `脚本执行成功！生成了 ${result.length} 个操作`
  } catch (error) {
    errorMessage.value = `脚本执行失败: ${error instanceof Error ? error.message : String(error)}`
  } finally {
    isExecuting.value = false
  }
}

function clearResults() {
  operations.value = []
  errorMessage.value = ''
  successMessage.value = ''
}

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.script-test-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

.header h1 {
  margin: 0;
  color: #333;
}

.back-btn {
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.back-btn:hover {
  background-color: #5a6268;
}

.test-section {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.input-section label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  color: #333;
}

textarea {
  width: 100%;
  max-width: 600px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  resize: vertical;
}

.example-buttons {
  margin-top: 15px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.example-buttons button {
  padding: 8px 12px;
  background-color: #17a2b8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.example-buttons button:hover {
  background-color: #138496;
}

.control-section {
  display: flex;
  gap: 15px;
}

.control-section button {
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.control-section button:hover:not(:disabled) {
  background-color: #0056b3;
}

.control-section button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.results-section {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  background-color: #f8f9fa;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.success-message {
  background-color: #d4edda;
  color: #155724;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.operations-list {
  max-height: 400px;
  overflow-y: auto;
}

.operation-item {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 10px;
  color: #333;
}

.operation-params {
  margin-top: 8px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  background-color: #f8f9fa;
  padding: 8px;
  border-radius: 3px;
  white-space: pre-wrap;
  word-break: break-all;
}

.operation-time {
  margin-top: 5px;
  font-size: 12px;
  color: #666;
}

h3, h4 {
  margin-top: 0;
  color: #333;
}
</style>