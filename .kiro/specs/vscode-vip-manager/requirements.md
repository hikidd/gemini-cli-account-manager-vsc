# 需求文档

## 简介

开发一个 Visual Studio Code 扩展插件，用于管理 KIRO VIP 账号，提供授权验证、代理开关控制、授权状态查看等功能。该插件通过 Webview 面板提供用户界面。

## 术语表

- **Extension（扩展）**：Visual Studio Code 的插件程序
- **Webview**：VS Code 中用于显示自定义 HTML/CSS/JavaScript 界面的组件
- **Authorization Code（授权码）**：用户用于验证身份的密钥字符串
- **Proxy Agent（代理）**：用户可以开启或关闭的代理功能
- **License Status（授权状态）**：包括剩余次数、已使用次数、激活时间、过期时间、剩余时间和当前状态

## 需求

### 需求 1

**用户故事：** 作为用户，我想要输入授权码并进行验证，以便激活我的 VIP 功能

#### 验收标准

1. WHEN 用户打开扩展面板 THEN Extension SHALL 显示一个授权码输入框和验证按钮
2. WHEN 用户在输入框中输入授权码并点击验证按钮 THEN Extension SHALL 向后端服务发送验证请求
3. WHEN 授权码验证成功 THEN Extension SHALL 保存授权信息并更新界面状态
4. WHEN 授权码验证失败 THEN Extension SHALL 显示错误提示信息
5. WHEN 输入框为空时用户点击验证按钮 THEN Extension SHALL 阻止提交并提示用户输入授权码

### 需求 2

**用户故事：** 作为用户，我想要通过开关控制代理功能的启用状态，以便根据需要开启或关闭代理

#### 验收标准

1. WHEN 用户查看界面 THEN Extension SHALL 显示一个带有"开启代理"标签的切换开关
2. WHEN 用户点击切换开关 THEN Extension SHALL 切换代理的启用状态
3. WHEN 代理状态改变 THEN Extension SHALL 保存新的状态设置
4. WHEN 用户重新打开面板 THEN Extension SHALL 显示上次保存的代理状态

### 需求 3

**用户故事：** 作为用户，我想要查看我的授权状态信息，以便了解我的 VIP 账号使用情况

#### 验收标准

1. WHEN 用户已完成授权验证 THEN Extension SHALL 显示授权状态区域
2. WHEN 显示授权状态 THEN Extension SHALL 展示剩余次数和已使用次数
3. WHEN 显示授权状态 THEN Extension SHALL 展示激活时间、过期时间和剩余时间
4. WHEN 显示授权状态 THEN Extension SHALL 展示当前状态（如"未激活"）
5. WHEN 授权信息不可用 THEN Extension SHALL 显示默认值（如 0 或 "-"）

### 需求 4

**用户故事：** 作为用户，我想要使用一键切换新账号功能，以便快速更换不同的 VIP 账号

#### 验收标准

1. WHEN 用户查看界面 THEN Extension SHALL 显示"一键切换新账号"按钮
2. WHEN 用户点击"一键切换新账号"按钮 THEN Extension SHALL 清除当前授权信息
3. WHEN 授权信息被清除 THEN Extension SHALL 重置界面到初始授权输入状态
4. WHEN 切换账号操作完成 THEN Extension SHALL 清空代理状态和授权状态显示

### 需求 5

**用户故事：** 作为用户，我想要使用重新登录功能，以便在授权过期或出现问题时重新验证

#### 验收标准

1. WHEN 用户查看界面 THEN Extension SHALL 显示"重新登录"按钮
2. WHEN 用户点击"重新登录"按钮 THEN Extension SHALL 清除当前会话信息
3. WHEN 重新登录操作触发 THEN Extension SHALL 保留授权码但要求重新验证
4. WHEN 重新登录完成 THEN Extension SHALL 刷新授权状态信息

### 需求 6

**用户故事：** 作为用户，我想要访问使用教程，以便了解如何正确使用该扩展

#### 验收标准

1. WHEN 用户查看界面 THEN Extension SHALL 显示"使用教程"按钮
2. WHEN 用户点击"使用教程"按钮 THEN Extension SHALL 打开教程页面或文档链接
3. WHEN 教程链接无效 THEN Extension SHALL 显示友好的错误提示

### 需求 7

**用户故事：** 作为用户，我想要查看联系方式，以便在遇到问题时能够获得支持

#### 验收标准

1. WHEN 用户查看界面 THEN Extension SHALL 显示联系方式区域
2. WHEN 显示联系方式 THEN Extension SHALL 展示 QQ 群号码
3. WHEN 用户点击联系方式 THEN Extension SHALL 允许复制 QQ 号码到剪贴板

### 需求 8

**用户故事：** 作为用户，我想要扩展能够持久化保存我的设置和授权信息，以便下次打开 VS Code 时无需重新配置

#### 验收标准

1. WHEN 用户完成授权验证 THEN Extension SHALL 将授权信息保存到本地存储
2. WHEN 用户更改代理状态 THEN Extension SHALL 将代理设置保存到本地存储
3. WHEN 用户重新启动 VS Code THEN Extension SHALL 从本地存储恢复授权信息和设置
4. WHEN 本地存储数据损坏或不可用 THEN Extension SHALL 使用默认值并提示用户重新配置

### 需求 9

**用户故事：** 作为开发者，我想要扩展具有清晰的界面结构和样式，以便提供良好的用户体验

#### 验收标准

1. WHEN 界面渲染 THEN Extension SHALL 使用深色主题配色方案
2. WHEN 显示按钮 THEN Extension SHALL 使用不同颜色区分不同功能（紫色、深灰色、蓝色、绿色）
3. WHEN 用户与界面交互 THEN Extension SHALL 提供视觉反馈（如按钮悬停效果）
4. WHEN 界面元素布局 THEN Extension SHALL 确保元素间距合理且对齐一致
5. WHEN 文本显示 THEN Extension SHALL 使用清晰易读的字体和字号
