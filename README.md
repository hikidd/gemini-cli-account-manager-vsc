# Gemini CLI Account Manager (Gemini CLI 账号助手)

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## 🇬🇧 English

**Gemini CLI Account Manager** is a VS Code extension designed to manage multiple Google account credentials for the Gemini CLI tool efficiently.

### Features

- 🔐 **OAuth2 Login**: Securely authenticate using Google Accounts.
- 👥 **Multi-Account Management**: Save and view multiple accounts in a clean sidebar list.
- ⚡ **One-Click Switch**: Instantly switch between accounts. This automatically updates your `~/.gemini/settings.json` with the selected account's credentials.
- 🌐 **I18n Support**: Switch between English and Simplified Chinese interfaces.

### Usage

1. Click the **Gemini Manager** icon in the VS Code Activity Bar.
2. Click **"+ Add Account"** to log in with a new Google Account via browser.
3. Click the **"Switch"** button on an account card to make it active.
4. Use the **"ZH/EN"** button in the header to toggle languages.

### Development

This project uses **Webpack** for bundling and credential injection.

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Setup Environment**:
   Create a `.env` file in the root directory and add your Google OAuth credentials (these will be injected during build):
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

3. **Run in Debug Mode**:
   Press `F5` in VS Code.

4. **Build Package**:
   ```bash
   npm run package
   ```

---

<a name="简体中文"></a>
## 🇨🇳 简体中文

**Gemini CLI 账号助手** 是一款 VS Code 扩展，专为管理 Gemini CLI 工具的多个 Google 账号凭证而设计。

### 功能特性

- 🔐 **OAuth2 登录**: 使用 Google 账号安全登录。
- 👥 **多账号管理**: 在侧边栏列表中保存和查看多个账号状态。
- ⚡ **一键切换**: 快速在不同账号间切换。切换后会自动更新本地 `~/.gemini/settings.json` 配置文件。
- 🌐 **多语言支持**: 支持英文和简体中文界面切换。

### 使用说明

1. 点击 VS Code 活动栏上的 **Gemini Manager** 图标。
2. 点击 **"+ 添加账号"** 按钮，通过浏览器完成 Google 登录。
3. 在账号卡片上点击 **"切换"** 按钮即可激活该账号。
4. 点击顶部的 **"ZH/EN"** 按钮可切换语言。

### 开发指南

本项目使用 **Webpack** 进行构建和凭证注入。

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **环境配置**:
   在项目根目录创建一个 `.env` 文件，并填入您的 Google OAuth 凭证（构建时会自动注入）：
   ```env
   GOOGLE_CLIENT_ID=您的客户端ID
   GOOGLE_CLIENT_SECRET=您的客户端密钥
   ```

3. **调试运行**:
   在 VS Code 中按 `F5`。

4. **打包发布**:
   ```bash
   npm run package
   ```

## License

MIT