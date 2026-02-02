(function() {
    const vscode = acquireVsCodeApi();

    const loginBtn = document.getElementById('loginBtn');
    const langToggle = document.getElementById('langToggle');
    const accountList = document.getElementById('accountList');
    
    // I18n Resources
    const translations = {
        'en': {
            'title': 'Gemini CLI Account Manager',
            'addAccount': '+ Add Account',
            'switch': 'Switch',
            'remove': 'Remove',
            'active': 'Active',
            'lastLogin': 'Last login',
            'noAccounts': 'No accounts found. Please login.',
            'confirmRemove': 'Are you sure you want to remove this account?',
            'unknown': 'Unknown',
            'loginSuccess': 'Successfully logged in',
            'switched': 'Switched to'
        },
        'zh': {
            'title': 'Gemini CLI 账号助手',
            'addAccount': '+ 添加账号',
            'switch': '切换',
            'remove': '移除',
            'active': '当前使用',
            'lastLogin': '上次登录',
            'noAccounts': '暂无账号，请点击添加。',
            'confirmRemove': '确定要移除该账号吗？',
            'unknown': '未知',
            'loginSuccess': '登录成功',
            'switched': '已切换至'
        }
    };

    let currentLang = 'zh'; // Default

    // Event Listeners
    loginBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'loginWithGoogle' });
    });

    langToggle.addEventListener('click', () => {
        const newLang = currentLang === 'zh' ? 'en' : 'zh';
        vscode.postMessage({ 
            type: 'setLanguage', 
            payload: { language: newLang } 
        });
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'updateState':
                if (message.payload.language) {
                    currentLang = message.payload.language;
                    updateStaticText();
                }
                renderAccounts(message.payload.accounts);
                break;
            case 'error':
                console.error(message.payload.message);
                break;
        }
    });

    // Initial Request
    vscode.postMessage({ type: 'getState' });

    function t(key) {
        return translations[currentLang][key] || key;
    }

    function updateStaticText() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });
        
        // Update button title if needed
        langToggle.textContent = currentLang === 'zh' ? '中' : 'EN';
    }

    function renderAccounts(accounts) {
        accountList.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            accountList.innerHTML = `<div style="text-align:center; color: var(--vscode-descriptionForeground);">${t('noAccounts')}</div>`;
            return;
        }

        accounts.forEach(account => {
            const card = document.createElement('div');
            card.className = `account-card ${account.isActive ? 'active' : ''}`;
            
            const avatarSrc = account.avatarUrl || 'https://www.gstatic.com/lam/qp/images/icons/default_avatar.svg';
            
            // Localized model info (hardcoded structure for now)
            const modelsHtml = `
                <div class="models-container">
                    <div class="model-chip">
                        <div class="model-name">G3 Pro</div>
                        <div class="model-info">
                            <span>${t('unknown')}</span>
                            <span>100%</span>
                        </div>
                    </div>
                    <div class="model-chip">
                        <div class="model-name">G3 Flash</div>
                        <div class="model-info">
                            <span>${t('unknown')}</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>
            `;

            const lastUsed = new Date(account.createdAt).toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US');

            card.innerHTML = `
                <div class="card-header">
                    <img src="${avatarSrc}" class="avatar" alt="Avatar">
                    <div class="user-info">
                        <div class="email" title="${account.email}">${account.email}</div>
                        ${account.type === 'PRO' 
                            ? `<div class="badge" style="background-color: var(--vscode-badge-background); color: var(--vscode-badge-foreground);">PRO</div>` 
                            : `<div class="badge" style="background-color: var(--vscode-charts-lines); color: var(--vscode-editor-background);">FREE</div>`
                        }
                    </div>
                </div>
                ${modelsHtml}
                <div class="footer">
                    <div class="last-used">${t('lastLogin')}: ${lastUsed}</div>
                    <div class="actions">
                        ${!account.isActive 
                            ? `<button class="btn btn-sm action-switch" data-id="${account.id}">${t('switch')}</button>` 
                            : `<button class="btn btn-sm" disabled style="opacity: 0.7; cursor: default;">${t('active')}</button>`}
                        <button class="btn btn-secondary btn-sm action-remove" data-id="${account.id}">${t('remove')}</button>
                    </div>
                </div>
            `;

            accountList.appendChild(card);

            // Add Event Listeners directly
            const switchBtn = card.querySelector('.action-switch');
            const removeBtn = card.querySelector('.action-remove');

            if (switchBtn) {
                switchBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent bubbling issues
                    vscode.postMessage({
                        type: 'switchAccount',
                        payload: { id: account.id }
                    });
                });
            }

            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    vscode.postMessage({
                        type: 'removeAccount',
                        payload: { id: account.id }
                    });
                });
            }
        });
    }

})();
