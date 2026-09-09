/**
 * Runboard - 密碼區 (Passwords) 專屬邏輯
 */
const PasswordsApp = (function () {
    let searchTerm = '';

    function getPasswords() {
        const data = Storage.getData();
        if (!data.passwords) data.passwords = [];
        return data.passwords;
    }

    function escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeHtmlAttr(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function generatePassword(length = 16) {
        const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowers = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*';
        const allChars = uppers + lowers + numbers + symbols;

        const getRandomChar = (chars) => {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            return chars[arr[0] % chars.length];
        };

        // 確保每種類別至少出現一次
        const result = [
            getRandomChar(uppers),
            getRandomChar(lowers),
            getRandomChar(numbers),
            getRandomChar(symbols)
        ];

        for (let i = 4; i < length; i++) {
            result.push(getRandomChar(allChars));
        }

        // Fisher-Yates 洗牌
        for (let i = result.length - 1; i > 0; i--) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            const j = arr[0] % (i + 1);
            [result[i], result[j]] = [result[j], result[i]];
        }

        return result.join('');
    }

    function fillGeneratedPassword() {
        const pwdInput = document.getElementById('ipt-pwd');
        if (pwdInput) {
            pwdInput.value = generatePassword(16);
            pwdInput.focus();
        }
    }

    function render() {
        const listContainer = document.getElementById('passwords-list');
        if (!listContainer) return;

        const passwords = getPasswords();
        if (passwords.length === 0) {
            listContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">尚無儲存的密碼，請點擊右上角「＋新增密碼」開始建立。</div>`;
            return;
        }

        let html = `<div class="pwd-container">`;
        let matchCount = 0;

        passwords.forEach((pwd, actualIdx) => {
            const platform = pwd.platform || '';
            const account = pwd.account || '';

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchPlatform = platform.toLowerCase().includes(term);
                const matchAccount = account.toLowerCase().includes(term);
                if (!matchPlatform && !matchAccount) {
                    return;
                }
            }

            matchCount++;
            html += `
            <div class="pwd-card">
                <button class="edit-btn" onclick="PasswordsApp.openEditPassword(${actualIdx})" title="編輯">✏️</button>
                <button class="delete-btn" onclick="PasswordsApp.deletePassword(${actualIdx})" title="刪除">✕</button>
                <div class="pwd-info">
                    <div class="pwd-platform">${escapeHtml(platform)}</div>
                    <div class="pwd-account">${escapeHtml(account)}</div>
                </div>
                <div class="pwd-actions">
                    <div class="pwd-mask" data-pwd="${escapeHtmlAttr(pwd.password || '')}" onclick="PasswordsApp.togglePassword(this)">********</div>
                    <button class="btn btn-small" onclick="PasswordsApp.copyPassword(this)">複製密碼</button>
                </div>
            </div>`;
        });

        html += `</div>`;

        if (searchTerm && matchCount === 0) {
            listContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">未找到符合「${escapeHtml(searchTerm)}」的密碼項目</div>`;
        } else {
            listContainer.innerHTML = html;
        }
    }

    function togglePassword(element) {
        const realPwd = element.getAttribute('data-pwd');
        if (element.innerText === '********') {
            element.innerText = realPwd;
            element.style.color = 'var(--accent-color)';
        } else {
            element.innerText = '********';
            element.style.color = '';
        }
    }

    function copyPassword(btnElement) {
        const maskElement = btnElement.previousElementSibling;
        const realPwd = maskElement.getAttribute('data-pwd');

        navigator.clipboard.writeText(realPwd).then(() => {
            const originalText = btnElement.innerText;
            btnElement.innerText = '已複製！';
            btnElement.style.color = '#4ade80';
            btnElement.style.borderColor = '#4ade80';

            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.style.color = '';
                btnElement.style.borderColor = '';
            }, 2000);
        }).catch(err => alert('複製失敗: ' + err));
    }

    function openAddPassword() {
        Modal.open({
            title: '新增一組密碼',
            html: `
                <div class="form-group">
                    <label>平台名稱</label>
                    <input type="text" id="ipt-plat" placeholder="例如: Google">
                </div>
                <div class="form-group">
                    <label>帳號 (選填)</label>
                    <input type="text" id="ipt-acc" placeholder="信箱或使用者名稱">
                </div>
                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label style="margin-bottom: 0;">密碼</label>
                        <button type="button" class="btn btn-small" style="font-size: 11px;" onclick="PasswordsApp.fillGeneratedPassword()">⚡ 產生隨機密碼</button>
                    </div>
                    <input type="text" id="ipt-pwd" placeholder="輸入密碼...">
                </div>
            `,
            onConfirm: async () => {
                const platform = document.getElementById('ipt-plat').value.trim();
                const account = document.getElementById('ipt-acc').value.trim();
                const password = document.getElementById('ipt-pwd').value.trim();

                if (!platform || !password) {
                    alert('平台名稱與密碼為必填');
                    return false;
                }

                getPasswords().push({ platform, account, password });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditPassword(idx) {
        const passwords = getPasswords();
        const pwd = passwords[idx];
        if (!pwd) return;

        Modal.open({
            title: '編輯密碼',
            html: `
                <div class="form-group">
                    <label>平台名稱</label>
                    <input type="text" id="ipt-plat" value="${escapeHtmlAttr(pwd.platform || '')}" placeholder="例如: Google">
                </div>
                <div class="form-group">
                    <label>帳號 (選填)</label>
                    <input type="text" id="ipt-acc" value="${escapeHtmlAttr(pwd.account || '')}" placeholder="信箱或使用者名稱">
                </div>
                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <label style="margin-bottom: 0;">密碼</label>
                        <button type="button" class="btn btn-small" style="font-size: 11px;" onclick="PasswordsApp.fillGeneratedPassword()">⚡ 產生隨機密碼</button>
                    </div>
                    <input type="text" id="ipt-pwd" value="${escapeHtmlAttr(pwd.password || '')}" placeholder="輸入密碼...">
                </div>
            `,
            onConfirm: async () => {
                const platform = document.getElementById('ipt-plat').value.trim();
                const account = document.getElementById('ipt-acc').value.trim();
                const password = document.getElementById('ipt-pwd').value.trim();

                if (!platform || !password) {
                    alert('平台名稱與密碼為必填');
                    return false;
                }

                passwords[idx] = { platform, account, password };
                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deletePassword(idx) {
        if (!confirm('確定要刪除此組密碼嗎？')) return;
        getPasswords().splice(idx, 1);
        await Storage.save();
        render();
    }

    // 初始化載入
    document.addEventListener('DOMContentLoaded', () => {
        const searchInput = document.getElementById('pwd-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchTerm = e.target.value.trim();
                render();
            });
        }

        Storage.init(() => {
            render();
        });
    });

    return {
        render,
        togglePassword,
        copyPassword,
        openAddPassword,
        openEditPassword,
        deletePassword,
        fillGeneratedPassword,
        generatePassword
    };
})();

window.PasswordsApp = PasswordsApp;
