/**
 * Runboard - 全域共用彈跳對話框 (Modal) 組件
 */
const Modal = (function () {
    let currentConfirmCallback = null;

    function ensureModalDOM() {
        if (!document.getElementById('modal')) {
            const modalEl = document.createElement('div');
            modalEl.id = 'modal';
            modalEl.className = 'modal-overlay';
            modalEl.innerHTML = `
                <div class="modal-content">
                    <h3 id="modal-title" class="modal-title"></h3>
                    <div id="modal-form"></div>
                    <div class="modal-actions">
                        <button class="btn btn-small" id="modal-btn-cancel">取消</button>
                        <button class="btn btn-small primary" id="modal-btn-confirm">確認儲存</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);

            modalEl.querySelector('#modal-btn-cancel').onclick = close;
            modalEl.querySelector('#modal-btn-confirm').onclick = async () => {
                if (typeof currentConfirmCallback === 'function') {
                    const result = await currentConfirmCallback();
                    if (result !== false) {
                        close();
                    }
                } else {
                    close();
                }
            };

            // 點擊遮罩外層關閉
            modalEl.onclick = (e) => {
                if (e.target === modalEl) close();
            };

            // Enter 鍵快速確認 (排除 textarea)
            modalEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    modalEl.querySelector('#modal-btn-confirm').click();
                } else if (e.key === 'Escape') {
                    close();
                }
            });
        }
    }

    function open({ title, html, onConfirm }) {
        ensureModalDOM();
        document.getElementById('modal-title').innerText = title || '';
        document.getElementById('modal-form').innerHTML = html || '';
        currentConfirmCallback = onConfirm;
        document.getElementById('modal').classList.add('active');

        // 自動聚焦於第一個輸入框
        const firstInput = document.getElementById('modal-form').querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 60);
        }
    }

    function close() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('active');
        }
        currentConfirmCallback = null;
    }

    return {
        open,
        close
    };
})();

window.Modal = Modal;
