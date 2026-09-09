/**
 * Runboard - 首頁儀表板 (Dashboard) 邏輯
 */
const DashboardApp = (function () {
    function renderStats() {
        const data = Storage.getData();

        // 常用網站統計
        let favCats = 0;
        let favItems = 0;
        if (data.favorites) {
            favCats = data.favorites.length;
            favItems = data.favorites.reduce((acc, cat) => acc + (cat.items ? cat.items.length : 0), 0);
        }
        const statFavEl = document.getElementById('stat-favorites');
        if (statFavEl) statFavEl.innerText = `${favCats} 個分類 · 共 ${favItems} 個常用網址`;

        // 便條紙統計
        let noteCats = 0;
        let noteItems = 0;
        if (data.notes) {
            noteCats = data.notes.length;
            noteItems = data.notes.reduce((acc, cat) => acc + (cat.items ? cat.items.length : 0), 0);
        }
        const statNotesEl = document.getElementById('stat-notes');
        if (statNotesEl) statNotesEl.innerText = `${noteCats} 個分類 · 共 ${noteItems} 則便條`;

        // 任務清單統計
        let totalTasks = 0;
        let doneTasks = 0;
        let inProgressTasks = 0;
        let overdueTasks = 0;

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (data.tasks) {
            data.tasks.forEach(cat => {
                if (cat.items) {
                    cat.items.forEach(t => {
                        totalTasks++;
                        if (t.status === 'done') {
                            doneTasks++;
                        } else {
                            if (t.status === 'in_progress') inProgressTasks++;
                            if (t.dueDate && t.dueDate < todayStr) {
                                overdueTasks++;
                            }
                        }
                    });
                }
            });
        }
        const statTasksEl = document.getElementById('stat-tasks');
        if (statTasksEl) {
            let statHtml = `進行中 ${inProgressTasks} 項 · 已完成 ${doneTasks}/${totalTasks}`;
            if (overdueTasks > 0) {
                statHtml += ` · <span class="stat-overdue-highlight">⚠️ 逾期 ${overdueTasks} 項</span>`;
            }
            statTasksEl.innerHTML = statHtml;
        }

        // 密碼區統計
        let pwdCount = data.passwords ? data.passwords.length : 0;
        const statPwdEl = document.getElementById('stat-passwords');
        if (statPwdEl) statPwdEl.innerText = `共儲存 ${pwdCount} 組帳號密碼`;

        // 目錄節點圖統計
        const statGraphEl = document.getElementById('stat-foldergraph');
        if (statGraphEl) {
            if (data.folderGraphSnapshot && data.folderGraphSnapshot.rootName) {
                statGraphEl.innerText = `快照：${data.folderGraphSnapshot.rootName}`;
            } else {
                statGraphEl.innerText = `尚未載入快照 · 點擊掃描`;
            }
        }

        // 系統資訊卡片摘要
        const statSysEl = document.getElementById('stat-sysinfo');
        if (statSysEl) {
            const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} 核心` : '硬體偵測';
            statSysEl.innerText = `${navigator.onLine ? '🟢 網路正常' : '🔴 離線'} · ${cores} · 點擊查看完整報告`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        Storage.init(() => {
            renderStats();
        });
    });

    return {
        renderStats
    };
})();

window.DashboardApp = DashboardApp;
