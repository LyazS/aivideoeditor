/**
 * WebAV与Vue项目的旋转角度转换工具
 * 
 * WebAV使用弧度制 (radians)，范围：-π 到 π
 * Vue项目界面使用角度制 (degrees)，范围：-180° 到 180°
 */

/**
 * 将任意角度标准化到 -180 到 180 范围内
 * @param degrees 任意角度值
 * @returns 标准化后的角度值 (-180 到 180)
 */
export function normalizeAngle(degrees: number): number {
  // 将角度标准化到 -180 到 180 范围内
  let normalized = degrees % 360
  if (normalized > 180) {
    normalized -= 360
  } else if (normalized < -180) {
    normalized += 360
  }
  return normalized
}

/**
 * 将角度转换为弧度
 * @param degrees 角度值（任意值，会自动标准化到 -180 到 180）
 * @returns 弧度值 (-π 到 π)
 */
export function degreesToRadians(degrees: number): number {
  // 先标准化角度，然后转换为弧度
  const normalizedDegrees = normalizeAngle(degrees)
  return (normalizedDegrees * Math.PI) / 180
}

/**
 * 将弧度转换为角度
 * @param radians 弧度值 (-π 到 π)
 * @returns 角度值 (-180 到 180)
 */
export function radiansToDegrees(radians: number): number {
  const degrees = (radians * 180) / Math.PI
  // 限制角度范围在 -180 到 180 之间
  return Math.max(-180, Math.min(180, degrees))
}

/**
 * 将Vue界面的角度值转换为WebAV的弧度值
 * 用于：属性面板输入 → WebAV sprite.rect.angle
 * @param uiDegrees 界面输入的角度值（任意值，如 450°、-270° 等）
 * @returns WebAV使用的弧度值（自动标准化到 -π 到 π）
 */
export function uiDegreesToWebAVRadians(uiDegrees: number): number {
  return degreesToRadians(uiDegrees)
}

/**
 * 将WebAV的弧度值转换为Vue界面的角度值
 * 用于：WebAV sprite.rect.angle → 属性面板显示
 * @param webavRadians WebAV的弧度值
 * @returns 界面显示的角度值
 */
export function webAVRadiansToUIDegrees(webavRadians: number): number {
  return radiansToDegrees(webavRadians)
}

/**
 * 验证角度值是否在有效范围内
 * @param degrees 角度值
 * @returns 是否有效
 */
export function isValidDegrees(degrees: number): boolean {
  return degrees >= -180 && degrees <= 180 && !isNaN(degrees)
}

/**
 * 验证弧度值是否在有效范围内
 * @param radians 弧度值
 * @returns 是否有效
 */
export function isValidRadians(radians: number): boolean {
  return radians >= -Math.PI && radians <= Math.PI && !isNaN(radians)
}

/**
 * 调试输出旋转转换信息
 * @param degrees 角度值
 * @param radians 弧度值
 */
export function debugRotationTransform(degrees?: number, radians?: number) {
  if (degrees !== undefined) {
    const normalizedDegrees = normalizeAngle(degrees)
    const convertedRadians = degreesToRadians(degrees)
    const backToDegrees = radiansToDegrees(convertedRadians)
    console.log('🔄 角度转换调试:', {
      输入角度: degrees,
      标准化角度: normalizedDegrees,
      转换弧度: convertedRadians,
      回转角度: backToDegrees,
      精度损失: Math.abs(normalizedDegrees - backToDegrees)
    })
  }

  if (radians !== undefined) {
    const convertedDegrees = radiansToDegrees(radians)
    const backToRadians = degreesToRadians(convertedDegrees)
    console.log('🔄 弧度转换调试:', {
      输入弧度: radians,
      转换角度: convertedDegrees,
      回转弧度: backToRadians,
      精度损失: Math.abs(radians - backToRadians)
    })
  }
}

/**
 * 测试角度标准化功能
 */
export function testAngleNormalization() {
  const testCases = [
    { input: 0, expected: 0 },
    { input: 90, expected: 90 },
    { input: 180, expected: 180 },
    { input: -180, expected: -180 },
    { input: 270, expected: -90 },
    { input: 360, expected: 0 },
    { input: 450, expected: 90 },
    { input: -270, expected: 90 },
    { input: -360, expected: 0 },
    { input: 720, expected: 0 },
    { input: -450, expected: -90 }
  ]

  console.log('🧪 角度标准化测试:')
  testCases.forEach(({ input, expected }) => {
    const result = normalizeAngle(input)
    const passed = Math.abs(result - expected) < 0.001
    console.log(`  ${input}° → ${result}° (期望: ${expected}°) ${passed ? '✅' : '❌'}`)
  })
}
