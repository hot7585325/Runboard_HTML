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
        if (data.tasks) {
            data.tasks.forEach(cat => {
                if (cat.items) {
                    cat.items.forEach(t => {
                        totalTasks++;
                        if (t.status === 'done') doneTasks++;
                        else if (t.status === 'in_progress') inProgressTasks++;
                    });
                }
            });
        }
        const statTasksEl = document.getElementById('stat-tasks');
        if (statTasksEl) {
            statTasksEl.innerText = `進行中 ${inProgressTasks} 項 · 已完成 ${doneTasks}/${totalTasks}`;
        }

        // 密碼區統計
        let pwdCount = data.passwords ? data.passwords.length : 0;
        const statPwdEl = document.getElementById('stat-passwords');
        if (statPwdEl) statPwdEl.innerText = `共儲存 ${pwdCount} 組帳號密碼`;
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
