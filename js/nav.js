/**
 * Runboard - 全域側邊導覽列元件 (參照 CPE_Tool 設計)
 * 集中管理所有工具連結，自動偵測當前頁面並高亮 active 項目
 * 支援拖曳重新排序 (Drag & Drop Reorder) 與跨頁持久化
 * 整合資料庫連線狀態區
 */
(function () {
    const STORAGE_KEY = 'runboard_nav_order';

    const DEFAULT_NAV_ITEMS = [
        { title: '🏠 首頁總覽', url: 'index.html' },
        { title: '🔖 常用網站', url: 'favorites.html' },
        { title: '📝 便條紙', url: 'notes.html' },
        { title: '📋 任務清單', url: 'tasks.html' },
        { title: '🔒 密碼區', url: 'passwords.html' },
        { title: '🗂️ 目錄節點圖', url: 'folder_graph.html' },
        { title: '🖥️ 系統資訊', url: 'sysinfo.html' },
        { title: '✨ 通用編輯器', url: 'smart_editor.html' }
    ];

    /**
     * 讀取導覽項目清單，若有儲存自訂順序則依自訂順序排列，並確保新項目不遺失
     */
    function getNavItems() {
        try {
            const savedOrder = localStorage.getItem(STORAGE_KEY);
            if (!savedOrder) {
                return DEFAULT_NAV_ITEMS.slice();
            }
            const orderUrls = JSON.parse(savedOrder);
            if (!Array.isArray(orderUrls) || orderUrls.length === 0) {
                return DEFAULT_NAV_ITEMS.slice();
            }

            const itemMap = new Map();
            DEFAULT_NAV_ITEMS.forEach(item => itemMap.set(item.url, item));

            const orderedItems = [];
            orderUrls.forEach(url => {
                if (itemMap.has(url)) {
                    orderedItems.push(itemMap.get(url));
                    itemMap.delete(url);
                }
            });

            // 若有未來新增但尚未記錄在自訂順序的項目，附加在末尾
            itemMap.forEach(item => {
                orderedItems.push(item);
            });

            return orderedItems;
        } catch (err) {
            console.warn('[nav.js] 讀取選單順序失敗，使用預設順序:', err);
            return DEFAULT_NAV_ITEMS.slice();
        }
    }

    /**
     * 儲存當前選單順序
     */
    function saveCurrentNavOrder(container) {
        try {
            const items = container.querySelectorAll('.nav-item');
            const urls = Array.from(items).map(el => el.dataset.url).filter(Boolean);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(urls));

            const resetBtn = container.querySelector('#btn-reset-nav');
            if (resetBtn) resetBtn.style.display = 'block';
        } catch (err) {
            console.error('[nav.js] 儲存選單順序失敗:', err);
        }
    }

    /**
     * 渲染側邊欄
     */
    function renderSidebar() {
        const container = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (!container) return;

        // 取得當前檔名 (例如 index.html 或 favorites.html)
        const currentPath = window.location.pathname;
        let currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1);
        if (!currentPage || currentPage === '') {
            currentPage = 'index.html';
        }

        const navItems = getNavItems();
        const hasCustomOrder = !!localStorage.getItem(STORAGE_KEY);

        const navLinksHtml = navItems.map(item => {
            const isActive = (item.url.toLowerCase() === currentPage.toLowerCase()) ? ' class="active"' : '';
            return `
            <li class="nav-item" draggable="true" data-url="${item.url}">
                <a href="${item.url}"${isActive} draggable="false">
                    <span class="nav-text">${item.title}</span>
                    <span class="drag-handle" title="按住拖曳以重新排序">⋮⋮</span>
                </a>
            </li>`;
        }).join('');

        container.className = 'sidebar';
        container.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-title">RunBoard 工作區</div>
            <button id="btn-reset-nav" class="btn-reset-nav" title="重設為預設排序" style="${hasCustomOrder ? 'display:block;' : 'display:none;'}">↺ 重設</button>
        </div>
        <ul class="nav-links">
            ${navLinksHtml}
        </ul>
        <div id="file-status-area" class="file-status-area">
            <!-- 由 storage.js 動態注入連線狀態與按鈕 -->
        </div>`;

        // 綁定拖曳與重設事件
        setupDragAndDrop(container);

        // 若 Storage 已載入，即時更新連線狀態 UI
        if (window.Storage && typeof window.Storage.updateUIStatus === 'function') {
            window.Storage.updateUIStatus();
        }
    }

    /**
     * 綁定拖曳重排事件與防止誤觸點擊跳轉機制
     */
    function setupDragAndDrop(container) {
        const navList = container.querySelector('.nav-links');
        if (!navList) return;

        const navItems = navList.querySelectorAll('.nav-item');
        const resetBtn = container.querySelector('#btn-reset-nav');

        let draggedItem = null;
        let isDragging = false;

        function clearDropIndicators() {
            navItems.forEach(item => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        }

        navItems.forEach(item => {
            // 監聽點擊，防止拖曳放開時觸發 <a> 導航跳轉
            const link = item.querySelector('a');
            if (link) {
                link.addEventListener('click', (e) => {
                    if (isDragging) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }

            item.addEventListener('dragstart', (e) => {
                isDragging = true;
                draggedItem = item;
                item.classList.add('dragging');

                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.dataset.url || '');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (!draggedItem || draggedItem === item) return;

                const rect = item.getBoundingClientRect();
                const isTopHalf = (e.clientY - rect.top) < (rect.height / 2);

                if (isTopHalf) {
                    item.classList.add('drag-over-top');
                    item.classList.remove('drag-over-bottom');
                } else {
                    item.classList.add('drag-over-bottom');
                    item.classList.remove('drag-over-top');
                }
            });

            item.addEventListener('dragleave', (e) => {
                // 只有滑鼠真正離開元素範圍時才移除指示線
                const rect = item.getBoundingClientRect();
                if (e.clientY < rect.top || e.clientY >= rect.bottom || e.clientX < rect.left || e.clientX >= rect.right) {
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;

                const rect = item.getBoundingClientRect();
                const isTopHalf = (e.clientY - rect.top) < (rect.height / 2);

                if (isTopHalf) {
                    navList.insertBefore(draggedItem, item);
                } else {
                    navList.insertBefore(draggedItem, item.nextSibling);
                }

                clearDropIndicators();
                saveCurrentNavOrder(container);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                clearDropIndicators();
                draggedItem = null;

                // 稍微延遲解除 isDragging，確保 drop/mouseup 時不會觸發 click 事件
                setTimeout(() => {
                    isDragging = false;
                }, 100);
            });
        });

        // 重設按鈕事件
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch (err) {
                    console.error('[nav.js] 清除選單順序失敗:', err);
                }
                renderSidebar();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderSidebar);
    } else {
        renderSidebar();
    }
})();
