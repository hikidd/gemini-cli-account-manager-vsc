# 设计文档

## 概述

本扩展是一个 Visual Studio Code 插件，用于管理 KIRO VIP 账号授权。扩展使用 VS Code Extension API 构建，通过 Webview 提供用户界面，使用 ExtensionContext 的 globalState 进行数据持久化。

技术栈：
- TypeScript（扩展主体）
- HTML/CSS/JavaScript（Webview 界面）
- VS Code Extension API
- Node.js（用于 HTTP 请求）

## 架构

扩展采用分层架构：

```
┌─────────────────────────────────────┐
│         VS Code Extension           │
│  ┌───────────────────────────────┐  │
│  │   Extension Entry (activate)  │  │
│  └───────────────┬───────────────┘  │
│                  │                   │
│  ┌───────────────▼───────────────┐  │
│  │    Webview Panel Manager      │  │
│  └───────────────┬───────────────┘  │
│                  │                   │
│  ┌───────────────▼───────────────┐  │
│  │      Message Handler          │  │
│  │  (Extension ↔ Webview 通信)   │  │
│  └───────┬───────────────┬───────┘  │
│          │               │           │
│  ┌───────▼──────┐ ┌─────▼────────┐  │
│  │ Auth Service │ │ State Manager│  │
│  │  (授权验证)   │ │  (状态管理)  │  │
│  └──────────────┘ └──────────────┘  │
└─────────────────────────────────────┘
           │
           ▼
    ┌──────────────┐
    │  Webview UI  │
    │ (HTML/CSS/JS)│
    └──────────────┘
```

### 组件职责

1. **Extension Entry**：扩展入口点，注册命令和初始化
2. **Webview Panel Manager**：管理 Webview 面板的创建、显示和销毁
3. **Message Handler**：处理扩展主进程和 Webview 之间的消息通信
4. **Auth Service**：处理授权验证逻辑和 API 调用
5. **State Manager**：管理持久化状态（授权信息、代理设置等）
6. **Webview UI**：用户界面，处理用户交互并通过消息与扩展通信

## 组件和接口

### 1. Extension Entry (`extension.ts`)

```typescript
export function activate(context: vscode.ExtensionContext): void
export function deactivate(): void
```

职责：
- 注册 `kiro-vip.openPanel` 命令
- 初始化 StateManager
- 创建 WebviewPanelManager 实例

### 2. Webview Panel Manager

```typescript
class WebviewPanelManager {
  constructor(context: vscode.ExtensionContext, stateManager: StateManager)
  
  public createOrShow(): void
  private getHtmlContent(): string
  private handleMessage(message: Message): void
}
```

职责：
- 创建和管理 Webview 面板
- 生成 Webview HTML 内容
- 处理来自 Webview 的消息

### 3. Message Handler

消息类型定义：

```typescript
type MessageType = 
  | 'verify'           // 验证授权码
  | 'toggleProxy'      // 切换代理状态
  | 'switchAccount'    // 切换账号
  | 'relogin'          // 重新登录
  | 'openTutorial'     // 打开教程
  | 'copyQQ'           // 复制 QQ 号
  | 'getState'         // 获取当前状态
  | 'updateState';     // 更新状态响应

interface Message {
  type: MessageType;
  payload?: any;
}
```

### 4. Auth Service

```typescript
class AuthService {
  public async verifyAuthCode(code: string): Promise<AuthResult>
  public async refreshAuthStatus(code: string): Promise<AuthStatus>
}

interface AuthResult {
  success: boolean;
  message?: string;
  data?: AuthStatus;
}

interface AuthStatus {
  remainingCount: number;
  usedCount: number;
  activationTime: string;
  expirationTime: string;
  remainingTime: string;
  status: string;
}
```

职责：
- 向后端 API 发送授权验证请求
- 刷新授权状态信息
- 处理 API 响应和错误

### 5. State Manager

```typescript
class StateManager {
  constructor(context: vscode.ExtensionContext)
  
  public getAuthCode(): string | undefined
  public setAuthCode(code: string): Promise<void>
  public clearAuthCode(): Promise<void>
  
  public getAuthStatus(): AuthStatus | undefined
  public setAuthStatus(status: AuthStatus): Promise<void>
  public clearAuthStatus(): Promise<void>
  
  public getProxyEnabled(): boolean
  public setProxyEnabled(enabled: boolean): Promise<void>
  
  public clearAll(): Promise<void>
}
```

职责：
- 使用 VS Code 的 globalState API 持久化数据
- 提供统一的状态读写接口
- 管理授权码、授权状态、代理设置

### 6. Webview UI

Webview 通过 `postMessage` 与扩展通信：

```javascript
// Webview 发送消息到扩展
vscode.postMessage({
  type: 'verify',
  payload: { code: '授权码' }
});

// Webview 接收来自扩展的消息
window.addEventListener('message', event => {
  const message = event.data;
  // 处理消息
});
```

## 数据模型

### AuthStatus（授权状态）

```typescript
interface AuthStatus {
  remainingCount: number;      // 剩余次数
  usedCount: number;           // 已使用次数
  activationTime: string;      // 激活时间（ISO 8601 格式）
  expirationTime: string;      // 过期时间（ISO 8601 格式）
  remainingTime: string;       // 剩余时间（如 "30天"）
  status: string;              // 状态描述（如 "未激活"）
}
```

### ExtensionState（扩展状态）

```typescript
interface ExtensionState {
  authCode?: string;           // 授权码
  authStatus?: AuthStatus;     // 授权状态
  proxyEnabled: boolean;       // 代理是否启用
}
```

### API Response（API 响应）

```typescript
interface ApiResponse<T> {
  code: number;                // 响应码（200 表示成功）
  message: string;             // 响应消息
  data?: T;                    // 响应数据
}
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性反思

在编写具体属性之前，我们需要识别并消除冗余：

- 属性 3.2、3.3、3.4 都是测试授权状态渲染的完整性，可以合并为一个综合属性
- 属性 2.3 和 8.2 都是测试代理状态持久化，可以合并
- 属性 1.3 和 8.1 都是测试授权信息持久化，可以合并
- 属性 4.2、4.3、4.4 都是测试切换账号的清除操作，可以合并为一个综合属性

### 核心属性

属性 1：授权验证触发 API 调用
*对于任何*非空授权码，当用户提交验证时，系统应该调用授权验证 API
**验证需求：1.2**

属性 2：成功验证后状态持久化
*对于任何*成功的授权验证响应，系统应该将授权信息保存到本地存储并更新 UI 状态
**验证需求：1.3, 8.1**

属性 3：失败验证显示错误
*对于任何*失败的授权验证响应，系统应该向用户显示错误消息
**验证需求：1.4**

属性 4：代理状态切换和持久化
*对于任何*初始代理状态，切换操作应该将状态改为相反值并保存到本地存储
**验证需求：2.2, 2.3, 8.2**

属性 5：状态恢复往返一致性
*对于任何*保存的扩展状态（授权信息和代理设置），重新加载后应该恢复相同的状态
**验证需求：2.4, 8.3**

属性 6：授权状态完整渲染
*对于任何*有效的授权状态对象，渲染的 UI 应该包含所有必需字段：剩余次数、已使用次数、激活时间、过期时间、剩余时间和状态描述
**验证需求：3.2, 3.3, 3.4**

属性 7：切换账号完全清除状态
*对于任何*现有的扩展状态，执行切换账号操作应该清除所有授权信息和代理设置，并将 UI 重置到初始状态
**验证需求：4.2, 4.3, 4.4**

属性 8：重新登录保留授权码
*对于任何*现有的授权码和会话状态，执行重新登录操作应该保留授权码但清除会话信息
**验证需求：5.2, 5.3**

属性 9：重新登录刷新状态
*对于任何*保留的授权码，重新登录完成后应该获取并显示最新的授权状态信息
**验证需求：5.4**

属性 10：教程链接可访问
*对于任何*教程按钮点击事件，系统应该尝试打开配置的教程 URL
**验证需求：6.2**

属性 11：QQ 号码复制功能
*对于任何*联系方式点击事件，系统应该将 QQ 号码复制到系统剪贴板
**验证需求：7.3**

## 错误处理

### 网络错误

- API 请求超时：显示"网络请求超时，请检查网络连接"
- 服务器错误（5xx）：显示"服务器错误，请稍后重试"
- 网络不可达：显示"无法连接到服务器，请检查网络"

### 验证错误

- 授权码格式错误：显示"授权码格式不正确"
- 授权码无效：显示"授权码无效或已过期"
- 授权码为空：显示"请输入授权码"

### 存储错误

- 读取失败：使用默认值并记录警告日志
- 写入失败：显示"保存设置失败"并记录错误日志
- 数据损坏：清除损坏数据，使用默认值，提示用户重新配置

### UI 错误

- Webview 创建失败：显示 VS Code 通知"无法打开面板"
- 消息通信失败：记录错误日志并尝试重新建立连接

## 测试策略

### 单元测试

使用 VS Code 的测试框架和 Mocha 进行单元测试：

1. **StateManager 测试**
   - 测试状态的读写操作
   - 测试清除操作
   - 测试默认值处理

2. **AuthService 测试**
   - 使用 mock HTTP 客户端测试 API 调用
   - 测试成功和失败响应的处理
   - 测试错误情况（网络错误、超时等）

3. **Message Handler 测试**
   - 测试各种消息类型的处理
   - 测试消息验证和错误处理

4. **Webview UI 测试**
   - 测试用户交互（按钮点击、输入等）
   - 测试消息发送和接收
   - 测试 UI 状态更新

### 基于属性的测试

使用 **fast-check** 库进行基于属性的测试：

配置：每个属性测试运行至少 100 次迭代

1. **属性 1 测试**：生成随机非空字符串作为授权码，验证 API 调用被触发
   - 标签：**Feature: vscode-vip-manager, Property 1: 授权验证触发 API 调用**

2. **属性 2 测试**：生成随机成功响应，验证状态保存和 UI 更新
   - 标签：**Feature: vscode-vip-manager, Property 2: 成功验证后状态持久化**

3. **属性 3 测试**：生成随机失败响应，验证错误消息显示
   - 标签：**Feature: vscode-vip-manager, Property 3: 失败验证显示错误**

4. **属性 4 测试**：生成随机初始代理状态，验证切换和持久化
   - 标签：**Feature: vscode-vip-manager, Property 4: 代理状态切换和持久化**

5. **属性 5 测试**：生成随机扩展状态，验证保存和恢复的一致性
   - 标签：**Feature: vscode-vip-manager, Property 5: 状态恢复往返一致性**

6. **属性 6 测试**：生成随机授权状态对象，验证所有字段都被渲染
   - 标签：**Feature: vscode-vip-manager, Property 6: 授权状态完整渲染**

7. **属性 7 测试**：生成随机扩展状态，验证切换账号后完全清除
   - 标签：**Feature: vscode-vip-manager, Property 7: 切换账号完全清除状态**

8. **属性 8 测试**：生成随机授权码和会话状态，验证重新登录保留授权码
   - 标签：**Feature: vscode-vip-manager, Property 8: 重新登录保留授权码**

9. **属性 9 测试**：生成随机授权码，验证重新登录后状态刷新
   - 标签：**Feature: vscode-vip-manager, Property 9: 重新登录刷新状态**

10. **属性 10 测试**：验证教程链接打开操作被触发
    - 标签：**Feature: vscode-vip-manager, Property 10: 教程链接可访问**

11. **属性 11 测试**：验证 QQ 号码被复制到剪贴板
    - 标签：**Feature: vscode-vip-manager, Property 11: QQ 号码复制功能**

### 边缘情况测试

在单元测试中覆盖以下边缘情况：

1. 空授权码输入（需求 1.5）
2. 授权信息不可用时的默认值显示（需求 3.5）
3. 教程链接无效时的错误处理（需求 6.3）
4. 本地存储数据损坏时的恢复（需求 8.4）

### 集成测试

1. 端到端流程测试：
   - 打开面板 → 输入授权码 → 验证 → 查看状态
   - 切换代理 → 关闭面板 → 重新打开 → 验证状态保持

2. 错误场景测试：
   - 网络错误时的用户体验
   - 无效授权码的处理流程

## 实现注意事项

### VS Code Extension 最佳实践

1. **资源清理**：确保在 deactivate 时清理所有资源
2. **错误处理**：所有异步操作都应该有适当的错误处理
3. **性能**：避免在主线程执行耗时操作
4. **安全性**：不在代码中硬编码敏感信息（API 端点应该可配置）

### Webview 安全

1. 使用 Content Security Policy (CSP) 限制 Webview 中的脚本执行
2. 验证所有来自 Webview 的消息
3. 使用 nonce 确保只有授权的脚本可以执行

### 状态管理

1. 所有状态变更应该是原子操作
2. 提供状态变更的事件通知机制
3. 实现状态迁移策略以支持未来的数据格式变更

### API 集成

1. 实现请求重试机制（指数退避）
2. 设置合理的超时时间（建议 10 秒）
3. 实现请求取消机制
4. 缓存授权状态以减少 API 调用

### UI/UX

1. 所有操作应该有加载状态指示
2. 错误消息应该清晰且可操作
3. 使用 VS Code 的主题颜色变量以适应不同主题
4. 确保键盘导航和可访问性
