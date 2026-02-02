# 实施计划

- [x] 1. 初始化项目结构和配置


  - 使用 `yo code` 创建 VS Code 扩展项目骨架
  - 配置 TypeScript 编译选项
  - 设置项目依赖（VS Code API、类型定义等）
  - 创建基本的目录结构（src/services, src/managers, src/types）
  - _需求：所有需求的基础_

- [x] 2. 实现数据模型和类型定义


  - 创建 `src/types/index.ts` 文件
  - 定义 `AuthStatus` 接口
  - 定义 `ExtensionState` 接口
  - 定义 `Message` 和 `MessageType` 类型
  - 定义 `AuthResult` 和 `ApiResponse` 接口
  - _需求：1.3, 2.3, 3.1, 8.1_

- [x] 3. 实现 StateManager 状态管理器


  - 创建 `src/managers/StateManager.ts` 文件
  - 实现构造函数，接收 ExtensionContext
  - 实现 `getAuthCode()` 和 `setAuthCode()` 方法
  - 实现 `getAuthStatus()` 和 `setAuthStatus()` 方法
  - 实现 `getProxyEnabled()` 和 `setProxyEnabled()` 方法
  - 实现 `clearAuthCode()`, `clearAuthStatus()` 和 `clearAll()` 方法
  - 添加错误处理和默认值逻辑
  - _需求：8.1, 8.2, 8.3, 8.4_

- [x] 4. 实现 AuthService 授权服务


  - 创建 `src/services/AuthService.ts` 文件
  - 实现 `verifyAuthCode()` 方法，发送 HTTP 请求到后端 API
  - 实现 `refreshAuthStatus()` 方法，获取最新授权状态
  - 添加请求超时处理（10 秒）
  - 实现错误处理（网络错误、服务器错误等）
  - 解析 API 响应并返回 `AuthResult`
  - _需求：1.2, 1.3, 1.4, 5.4_

- [x] 5. 创建 Webview HTML 模板


  - 创建 `src/webview/template.html` 文件
  - 实现授权验证区域（输入框 + 验证按钮）
  - 实现代理开关（toggle switch）
  - 实现授权状态显示区域（剩余次数、已使用、时间信息等）
  - 实现操作按钮（一键切换新账号、重新登录、使用教程）
  - 实现联系方式区域（QQ 号码显示）
  - 添加深色主题 CSS 样式
  - 实现按钮颜色区分（紫色、深灰色、蓝色、绿色）
  - _需求：1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 7.2, 9.1, 9.2, 9.4, 9.5_

- [x] 6. 实现 Webview 交互逻辑


  - 创建 `src/webview/script.js` 文件
  - 实现 VS Code API 消息发送功能
  - 实现授权码验证按钮点击处理
  - 实现代理开关切换处理
  - 实现一键切换新账号按钮处理
  - 实现重新登录按钮处理
  - 实现使用教程按钮处理
  - 实现 QQ 号码复制功能
  - 实现消息接收和 UI 状态更新
  - 添加输入验证（空授权码检查）
  - 添加加载状态指示
  - _需求：1.2, 1.5, 2.2, 4.2, 5.2, 6.2, 7.3_

- [x] 7. 实现 WebviewPanelManager


  - 创建 `src/managers/WebviewPanelManager.ts` 文件
  - 实现构造函数，接收 context 和 stateManager
  - 实现 `createOrShow()` 方法，创建或显示 Webview 面板
  - 实现 `getHtmlContent()` 方法，生成 Webview HTML 内容
  - 配置 Webview 选项（enableScripts, retainContextWhenHidden）
  - 实现 Content Security Policy (CSP)
  - 处理面板关闭事件和资源清理
  - _需求：1.1, 9.1_

- [x] 8. 实现消息处理逻辑

  - 在 WebviewPanelManager 中实现 `handleMessage()` 方法
  - 处理 'verify' 消息：调用 AuthService 验证授权码
  - 处理 'toggleProxy' 消息：切换代理状态
  - 处理 'switchAccount' 消息：清除所有状态
  - 处理 'relogin' 消息：保留授权码，清除会话信息
  - 处理 'openTutorial' 消息：打开教程链接
  - 处理 'copyQQ' 消息：复制 QQ 号码到剪贴板
  - 处理 'getState' 消息：返回当前扩展状态
  - 实现消息验证和错误处理
  - _需求：1.2, 1.3, 1.4, 2.2, 2.3, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4, 6.2, 7.3_

- [x] 9. 实现扩展入口点


  - 创建 `src/extension.ts` 文件
  - 实现 `activate()` 函数
  - 初始化 StateManager
  - 创建 WebviewPanelManager 实例
  - 注册 `kiro-vip.openPanel` 命令
  - 实现 `deactivate()` 函数，清理资源
  - _需求：1.1_

- [x] 10. 配置扩展清单文件


  - 编辑 `package.json`
  - 设置扩展名称、描述、版本等元数据
  - 配置 `activationEvents`（onCommand）
  - 注册命令 `kiro-vip.openPanel`
  - 设置扩展图标和分类
  - 配置发布者信息
  - _需求：所有需求_

- [x] 11. 添加错误处理和用户反馈

  - 在 AuthService 中添加详细的错误消息
  - 在 Webview 中实现错误提示 UI
  - 在 StateManager 中添加存储错误处理
  - 实现网络错误、验证错误、存储错误的友好提示
  - 添加加载状态指示器
  - _需求：1.4, 1.5, 6.3, 8.4_

- [x] 12. 实现状态同步和初始化

  - 在面板创建时从 StateManager 加载初始状态
  - 通过消息将初始状态发送到 Webview
  - 在 Webview 中根据初始状态更新 UI
  - 确保代理开关显示正确的初始状态
  - 确保授权状态区域根据数据可用性显示或隐藏
  - _需求：2.4, 3.1, 3.5, 8.3_

- [x] 13. 检查点 - 确保所有功能正常工作



  - 确保所有功能正常运行，如有问题请询问用户
