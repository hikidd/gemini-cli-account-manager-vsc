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
                    <div class="email">${account.email}</div>
                    <div class="badge">PRO</div>
                </div>
                ${modelsHtml}
                <div class="last-used">${t('lastLogin')}: ${lastUsed}</div>
                <div class="actions">
                    ${!account.isActive ? `<button class="btn btn-sm" onclick="switchAccount('${account.id}')">${t('switch')}</button>` : `<span style="font-size:11px; align-self:center; margin-right:5px; color:#4caf50;">${t('active')}</span>`}
                    <button class="btn btn-secondary btn-sm" onclick="removeAccount('${account.id}')">${t('remove')}</button>
                </div>
            `;

            accountList.appendChild(card);
        });
    }

    // Expose functions to global scope
    window.switchAccount = (id) => {
        vscode.postMessage({
            type: 'switchAccount',
            payload: { id }
        });
    };

    window.removeAccount = (id) => {
        if (confirm(t('confirmRemove'))) {
            vscode.postMessage({
                type: 'removeAccount',
                payload: { id }
            });
        }
    };

})();
