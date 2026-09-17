/**
 * Runboard - 通用編輯器智慧快開路由器 (smart_editor.js)
 * 輕量中樞：分析選取的副檔名，自動無縫導向至專屬的實體編輯器頁面
 */
(function () {
    const btnSmartOpen = document.getElementById('btn-smart-open');
    if (!btnSmartOpen) return;

    btnSmartOpen.addEventListener('click', async () => {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: '所有支援的檔案',
                    accept: {
                        'text/plain': ['.txt', '.md', '.csv', '.json', '.js', '.html', '.css'],
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                    }
                }]
            });

            if (handle) {
                const ext = handle.name.split('.').pop().toLowerCase();

                // 根據副檔名導向至專屬工具頁面
                if (['md', 'markdown'].includes(ext)) {
                    window.location.href = 'editor_md.html';
                } else if (['csv', 'tsv'].includes(ext)) {
                    window.location.href = 'editor_csv.html';
                } else if (['json'].includes(ext)) {
                    window.location.href = 'editor_json.html';
                } else if (['docx', 'xlsx'].includes(ext)) {
                    window.location.href = 'editor_doc.html';
                } else {
                    // 純文字預設導向 Markdown 筆記編輯器
                    window.location.href = 'editor_md.html';
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.error('智慧開啟檔案失敗:', e);
            }
        }
    });
})();
