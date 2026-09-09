/**
 * Runboard - 全域側邊導覽列元件 (參照 CPE_Tool 設計)
 * 集中管理所有工具連結，自動偵測當前頁面並高亮 active 項目
 * 整合資料庫連線狀態區
 */
(function () {
    const NAV_ITEMS = [
        { title: '🏠 首頁總覽', url: 'index.html' },
        { title: '🔖 常用網站', url: 'favorites.html' },
        { title: '📝 便條紙', url: 'notes.html' },
        { title: '📋 任務清單', url: 'tasks.html' },
        { title: '🔒 密碼區', url: 'passwords.html' },
        { title: '🗂️ 目錄節點圖', url: 'folder_graph.html' }
    ];

    function renderSidebar() {
        const container = document.getElementById('sidebar') || document.querySelector('.sidebar');
        if (!container) return;

        // 取得當前檔名 (例如 index.html 或 favorites.html)
        const currentPath = window.location.pathname;
        let currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1);
        if (!currentPage || currentPage === '') {
            currentPage = 'index.html';
        }

        const navLinksHtml = NAV_ITEMS.map(item => {
            const isActive = (item.url.toLowerCase() === currentPage.toLowerCase()) ? ' class="active"' : '';
            return `<li><a href="${item.url}"${isActive}>${item.title}</a></li>`;
        }).join('\n            ');

        container.className = 'sidebar';
        container.innerHTML = `
        <div class="sidebar-title">RunBoard 工作區</div>
        <ul class="nav-links">
            ${navLinksHtml}
        </ul>
        <div id="file-status-area" class="file-status-area">
            <!-- 由 storage.js 動態注入連線狀態與按鈕 -->
        </div>`;

        // 若 Storage 已載入，即時更新連線狀態 UI
        if (window.Storage && typeof window.Storage.updateUIStatus === 'function') {
            window.Storage.updateUIStatus();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderSidebar);
    } else {
        renderSidebar();
    }
})();
