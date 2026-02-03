(function () {
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
            'refresh': 'Refresh',
            'active': 'Active',
            'lastRefreshed': 'Last refresh',
            'noAccounts': 'No accounts found. Please login.',
            'confirmRemove': 'Are you sure you want to remove this account?',
            'unknown': 'Unknown',
            'loginSuccess': 'Successfully logged in',
            'switched': 'Switched to'
        },
        'zh': {
            'title': 'Gemini CLI Account Manager',
            'addAccount': '+ 添加账号',
            'switch': '切换',
            'remove': '移除',
            'refresh': '刷新',
            'active': '当前使用',
            'lastRefreshed': '上次刷新',
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

    // Bottom Panel Listeners
    const btnRules = document.getElementById('btnRules');
    if (btnRules) {
        btnRules.addEventListener('click', () => {
            vscode.postMessage({ type: 'openFile', payload: { file: 'rules' } });
        });
    }

    const btnMCP = document.getElementById('btnMCP');
    if (btnMCP) {
        btnMCP.addEventListener('click', () => {
            vscode.postMessage({ type: 'openFile', payload: { file: 'mcp' } });
        });
    }

    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            vscode.postMessage({ type: 'restart' });
        });
    }

    const btnFeedback = document.getElementById('btnFeedback');
    if (btnFeedback) {
        btnFeedback.addEventListener('click', () => {
            vscode.postMessage({ type: 'openUrl', payload: { url: 'https://github.com/hikidd/gemini-cli-account-manager-vsc/issues' } });
        });
    }

    const btnStar = document.getElementById('btnStar');
    if (btnStar) {
        btnStar.addEventListener('click', () => {
            vscode.postMessage({ type: 'openUrl', payload: { url: 'https://github.com/hikidd/gemini-cli-account-manager-vsc' } });
        });
    }

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
        console.log('Rendering accounts:', accounts); // Debug log
        accountList.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            accountList.innerHTML = `<div style="text-align:center; color: var(--vscode-descriptionForeground);">${t('noAccounts')}</div>`;
            return;
        }

        accounts.forEach(account => {
            try {
                const card = document.createElement('div');
                card.className = `account-card ${account.isActive ? 'active' : ''}`;

                const avatarSrc = account.avatarUrl || 'https://www.gstatic.com/lam/qp/images/icons/default_avatar.svg';

                // Dynamic Quota Display
                let quotaHtml = '';

                // Refresh Icon SVG
                const refreshIcon = `<svg class="action-refresh-quota" data-id="${account.id}" style="cursor:pointer; width:12px; height:12px;" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.681 3H2V2h3.5l.5.5V6H5V4a5 5 0 1 0 1.454-9.645l-.908.419A4 4 0 1 1 5 3.06L4.681 3z"/></svg>`;

                // Targets
                const targetModels = [
                    { id: 'gemini-3-pro-preview', name: 'G3 Pro' },
                    { id: 'gemini-3-flash-preview', name: 'G3 Flash' }
                ];

                if (account.quota && account.quota.buckets) {
                    let barsHtml = '';

                    targetModels.forEach(target => {
                        // Find bucket or use default full quota
                        let bucket = account.quota.buckets.find(b => b.modelId === target.id);
                        if (!bucket) {
                            bucket = {
                                modelId: target.id,
                                remainingFraction: 1.0,
                                resetTime: null
                            };
                        }

                        if (bucket) {
                            // Remaining Capacity Bar
                            const remaining = bucket.remainingFraction;
                            const remainingPercent = Math.max(0, Math.min(100, remaining * 100));

                            // Color Logic based on Remaining
                            let barColor = '#f44336'; // Red (Critical < 20% left)
                            if (remaining > 0.8) {
                                barColor = '#4caf50'; // Green (Safe > 80% left)
                            } else if (remaining > 0.2) {
                                barColor = '#ff9800'; // Orange (Warning 20-80% left)
                            }

                            // Calculate Reset Time
                            let resetText = '';
                            if (bucket.resetTime) {
                                const resetDate = new Date(bucket.resetTime);
                                const now = new Date();
                                const diffMs = resetDate.getTime() - now.getTime();

                                if (diffMs > 0) {
                                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                    resetText = `${hours}h ${minutes}m`;
                                } else {
                                    resetText = 'Ready';
                                }
                            }

                            barsHtml += `
                                <div class="quota-row" style="margin-bottom:4px;">
                                    <div class="quota-header" style="display:grid; grid-template-columns: 1fr auto 1fr; align-items:center; font-size:10px;">
                                        <span style="justify-self:start; font-weight:600;">${target.name}</span>
                                        <span class="reset-text" style="justify-self:center;">${resetText ? resetText : ''}</span>
                                        <span style="justify-self:end;">${(remaining * 100).toFixed(1)}%</span>
                                    </div>
                                    <div class="progress-track">
                                        <div class="progress-fill" style="width: ${remainingPercent}%; background-color: ${barColor}"></div>
                                    </div>
                                </div>
                            `;
                        }
                    });

                    if (barsHtml) {
                        quotaHtml = `
                            <div class="quota-section">
                                ${barsHtml}
                            </div>
                        `;
                    } else {
                        quotaHtml = `
                            <div class="quota-section" style="opacity:0.5; font-size:10px; display:flex; align-items:center; gap:4px;">
                                <span>No usage data for G3 models</span>
                            </div>`;
                    }

                } else if (!account.quota) {
                    // Placeholder if no quota fetched yet (or fetch failed)
                    quotaHtml += `
                        <div class="quota-section" style="opacity:0.5; font-size:10px; display:flex; align-items:center; gap:4px;">
                            <span>Waiting for quota...</span>
                        </div>`;
                }

                // Wrap it in a container
                const modelsHtml = `<div class="models-container" style="display:block; padding-top:4px;">${quotaHtml}</div>`;

                // Use lastRefreshed if available, otherwise use createdAt
                const timeToDisplay = account.lastRefreshed ? new Date(account.lastRefreshed) : new Date(account.createdAt);
                const lastUsed = timeToDisplay.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US') + ' ' + 
                                 timeToDisplay.toLocaleTimeString(currentLang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
                
                // Construct Last Refreshed HTML for Header
                const lastRefreshedHtml = `<div class="last-refreshed" style="font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px;">${t('lastRefreshed')}: ${lastUsed}</div>`;

                const tierTooltip = account.tierId ? `Tier: ${account.tierId}` : 'Tier: Unknown';

                let badgeHtml = '';
                if (account.type === 'ULTRA') {
                    badgeHtml = `<div class="badge ultra" title="${tierTooltip}" style="cursor:help;">ULTRA</div>`;
                } else if (account.type === 'PRO') {
                    badgeHtml = `<div class="badge pro" title="${tierTooltip}" style="cursor:help;">PRO</div>`;
                } else {
                    badgeHtml = `<div class="badge free" title="${tierTooltip}" style="cursor:help;">FREE</div>`;
                }

                const isProAccount = account.type === 'PRO' || account.type === 'ULTRA';
                const avatarClass = isProAccount ? 'avatar pro-ring' : 'avatar';

                card.innerHTML = `
                    <div class="card-header">
                        <img src="${avatarSrc}" class="${avatarClass}" alt="Avatar">
                        <div class="user-info">
                            <div class="email" title="${account.email}">${account.email}</div>
                            <div style="display:flex; gap: 8px; align-items: center;">
                                ${badgeHtml}
                                ${lastRefreshedHtml}
                            </div>
                        </div>
                    </div>
                    ${modelsHtml}
                    <div class="footer">
                        <div class="actions" style="width: 100%; display: flex; justify-content: flex-end; gap: 8px;">
                            <button class="btn btn-sm action-refresh-quota" data-id="${account.id}">${t('refresh')}</button>
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
                const refreshQuotaBtn = card.querySelector('.action-refresh-quota');

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

                if (refreshQuotaBtn) {
                    refreshQuotaBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Visual feedback: disable button briefly
                        refreshQuotaBtn.disabled = true;
                        refreshQuotaBtn.style.opacity = '0.7';
                        refreshQuotaBtn.textContent = '...';

                        vscode.postMessage({
                            type: 'refreshQuota',
                            payload: { id: account.id }
                        });
                    });
                }
            } catch (err) {
                console.error('Error rendering account card:', err);
                accountList.innerHTML += `<div style="color:red; padding:10px;">Error rendering account: ${err.message}</div>`;
            }
        });
    }

})();
