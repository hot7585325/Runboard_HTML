/**
 * Runboard - 任務清單歸檔與匯出模組 (Tasks Exporter)
 * 職責：過濾已完成任務、產生帶時間戳記的 Markdown/CSV 檔案、觸發瀏覽器下載並清除已完成任務
 */
const TasksExporter = (function () {

    // 格式化當前時間戳記: YYYYMMDDHHmm (例如 202609111228)
    function getTimestampString(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${y}${m}${d}${h}${min}`;
    }

    // 格式化標準日期時間顯示: YYYY-MM-DD HH:mm:ss
    function formatFullDateTime(date = new Date()) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}:${s}`;
    }

    // 產生已完成任務的 Markdown 內容
    function generateMarkdown(categories) {
        const now = new Date();
        const archiveTimeStr = formatFullDateTime(now);
        let totalCount = 0;

        let body = '';

        categories.forEach(cat => {
            const doneItems = (cat.items || []).filter(item => item.status === 'done');
            if (doneItems.length === 0) return;

            totalCount += doneItems.length;
            body += `\n## 📂 ${cat.category || '未命名分類'} (${doneItems.length} 項)\n\n`;

            doneItems.forEach((task, idx) => {
                body += `### ${idx + 1}. ${task.text || '無標題任務'}\n`;

                // 排程時間
                const dateParts = [];
                if (task.startDate) dateParts.push(`開始: ${task.startDate}`);
                if (task.dueDate) dateParts.push(`截止: ${task.dueDate}`);
                if (dateParts.length > 0) {
                    body += `- **排程時間**：${dateParts.join('  ~  ')}\n`;
                }

                // 詳細內文描述
                if (task.description && task.description.trim()) {
                    body += `- **詳細說明**：\n`;
                    const indentedDesc = task.description.trim().split('\n').map(l => `  ${l}`).join('\n');
                    body += `${indentedDesc}\n`;
                }

                // 完成解法與備註
                if (task.solution && task.solution.trim()) {
                    body += `- **💡 完成解法與備註**：\n`;
                    const indentedSol = task.solution.trim().split('\n').map(l => `  ${l}`).join('\n');
                    body += `${indentedSol}\n`;
                }

                body += `\n---\n\n`;
            });
        });

        const header = `# 📋 已完成任務歸檔清單\n\n- **歸檔時間**：${archiveTimeStr}\n- **歸檔任務總數**：${totalCount} 項\n\n=========================================\n`;

        return { content: header + body, totalCount };
    }

    // 觸發純前端檔案下載
    function triggerDownload(content, filename, mimeType = 'text/markdown;charset=utf-8;') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 一鍵歸檔並清除已完成任務
    async function archiveAndClearCompleted() {
        const data = Storage.getData();
        const categories = data.tasks || [];

        // 檢查是否有已完成項目
        let totalDone = 0;
        categories.forEach(cat => {
            if (cat.items) {
                totalDone += cat.items.filter(item => item.status === 'done').length;
            }
        });

        if (totalDone === 0) {
            alert('目前沒有任何已完成的任務可供歸檔！');
            return;
        }

        const confirmMsg = `即將匯出 ${totalDone} 項「已完成」任務為 Markdown 檔案，並從清單中清除。\n\n是否確認執行歸檔清除？`;
        if (!confirm(confirmMsg)) {
            return;
        }

        // 1. 產出 Markdown
        const { content } = generateMarkdown(categories);
        const filename = `已完成任務_${getTimestampString()}.md`;

        // 2. 觸發下載
        triggerDownload(content, filename);

        // 3. 自資料中清除已完成項目
        categories.forEach(cat => {
            if (cat.items) {
                cat.items = cat.items.filter(item => item.status !== 'done');
            }
        });

        // 4. 持久化存檔並重繪視圖
        await Storage.save();
        if (window.TasksApp && typeof TasksApp.render === 'function') {
            TasksApp.render();
        }

        // 5. 若首頁有開啟或在儀表板，可通知
        setTimeout(() => {
            alert(`🎉 已成功歸檔並清除 ${totalDone} 項任務！\n檔案已下載為：${filename}`);
        }, 100);
    }

    return {
        getTimestampString,
        generateMarkdown,
        triggerDownload,
        archiveAndClearCompleted
    };
})();

window.TasksExporter = TasksExporter;
