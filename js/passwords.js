/**
 * Runboard - 密碼區 (Passwords) 專屬邏輯
 */
const PasswordsApp = (function () {
    function getPasswords() {
        const data = Storage.getData();
        if (!data.passwords) data.passwords = [];
        return data.passwords;
    }

    function render() {
        const listContainer = document.getElementById('passwords-list');
        if (!listContainer) return;

        const passwords = getPasswords();
        let html = `<div class="pwd-container">`;

        passwords.forEach((pwd, idx) => {
            html += `
            <div class="pwd-card">
                <button class="delete-btn" onclick="PasswordsApp.deletePassword(${idx})">✕</button>
                <div class="pwd-info">
                    <div class="pwd-platform">${pwd.platform || ''}</div>
                    <div class="pwd-account">${pwd.account || ''}</div>
                </div>
                <div class="pwd-actions">
                    <div class="pwd-mask" data-pwd="${pwd.password || ''}" onclick="PasswordsApp.togglePassword(this)">********</div>
                    <button class="btn btn-small" onclick="PasswordsApp.copyPassword(this)">複製密碼</button>
                </div>
            </div>`;
        });

        html += `</div>`;
        listContainer.innerHTML = html;
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
                <div class="form-group"><label>平台名稱</label><input type="text" id="ipt-plat" placeholder="例如: Google"></div>
                <div class="form-group"><label>帳號 (選填)</label><input type="text" id="ipt-acc" placeholder="信箱或使用者名稱"></div>
                <div class="form-group"><label>密碼</label><input type="text" id="ipt-pwd" placeholder="輸入密碼..."></div>
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

    async function deletePassword(idx) {
        if (!confirm('確定要刪除此組密碼嗎？')) return;
        getPasswords().splice(idx, 1);
        await Storage.save();
        render();
    }

    // 初始化載入
    document.addEventListener('DOMContentLoaded', () => {
        Storage.init(() => {
            render();
        });
    });

    return {
        render,
        togglePassword,
        copyPassword,
        openAddPassword,
        deletePassword
    };
})();

window.PasswordsApp = PasswordsApp;
