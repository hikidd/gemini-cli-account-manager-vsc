# 测试指南

## 如何测试扩展

### 1. 启动调试

1. 在 VS Code 中打开项目
2. 按 `F5` 或点击"运行和调试"
3. 选择"Run Extension"
4. 会打开一个新的 VS Code 窗口（扩展开发主机）

### 2. 打开管理面板

在新窗口中：
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "KIRO VIP: 打开管理面板"
3. 面板应该会在侧边打开

### 3. 测试功能

#### 授权验证
- [ ] 输入空授权码，点击验证 → 应显示"请输入授权码"错误
- [ ] 输入有效授权码，点击验证 → 应显示授权状态信息
- [ ] 输入无效授权码 → 应显示错误提示

#### 代理开关
- [ ] 点击代理开关 → 开关状态应切换
- [ ] 关闭面板后重新打开 → 代理状态应保持

#### 授权状态显示
- [ ] 验证成功后 → 应显示剩余次数、已使用、时间信息
- [ ] 所有字段都应正确显示

#### 账号管理
- [ ] 点击"一键切换新账号" → 应清除所有信息并重置界面
- [ ] 点击"重新登录" → 应保留授权码并重新验证

#### 其他功能
- [ ] 点击"使用教程" → 应打开浏览器（当前为示例链接）
- [ ] 点击 QQ 号码 → 应复制到剪贴板并显示成功提示

### 4. 测试持久化

1. 验证授权码并开启代理
2. 关闭 VS Code 扩展开发主机窗口
3. 重新按 `F5` 启动
4. 打开管理面板
5. 验证：授权信息和代理状态应该保持

## 注意事项

### API 配置

当前 AuthService 中的 API 端点是示例地址：
```typescript
private readonly API_BASE_URL = 'https://api.example.com';
```

在实际使用前，需要：
1. 修改 `src/services/AuthService.ts` 中的 `API_BASE_URL`
2. 确保 API 端点返回正确的数据格式

### 教程链接

当前教程链接是示例：
```typescript
const tutorialUrl = 'https://example.com/tutorial';
```

需要在 `src/managers/WebviewPanelManager.ts` 中修改为实际教程地址。

## 已知限制

1. 图标文件 `icon.png` 需要手动创建（128x128 像素）
2. API 端点需要配置实际地址
3. 教程链接需要配置实际地址

## 打包测试

```bash
# 编译
npm run compile

# 打包（需要先安装 vsce）
npm install -g @vscode/vsce
vsce package

# 会生成 .vsix 文件
# 可以通过 VS Code 的"从 VSIX 安装"来测试
```
