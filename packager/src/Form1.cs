using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CpeDesktop;

public partial class Form1 : Form
{
    private const string VirtualHostName = "appassets.example";
    private WebView2 _webView = null!;
    private string? _tempWebDir;

    public Form1()
    {
        InitializeComponent();
        SetupForm();
        CleanOldTempDirectories();
        ExtractEmbeddedWebAssets();
        InitializeWebView();
    }

    private void SetupForm()
    {
        this.Text = "CPE Tool";
        this.Width = 1360;
        this.Height = 860;
        this.StartPosition = FormStartPosition.CenterScreen;
        this.MinimumSize = new Size(960, 640);
        this.BackColor = Color.FromArgb(15, 23, 42); // 配合 Slate 深色主題

        this.FormClosing += (s, e) => CleanupCurrentTempDir();
        Application.ApplicationExit += (s, e) => CleanupCurrentTempDir();
    }

    /// <summary>
    /// 清理先前可能未正常關閉時殘留的舊暫存目錄
    /// </summary>
    private static void CleanOldTempDirectories()
    {
        try
        {
            var tempBase = Path.GetTempPath();
            var oldDirs = Directory.GetDirectories(tempBase, "CPE_Tool_Web_*");
            foreach (var dir in oldDirs)
            {
                try
                {
                    Directory.Delete(dir, true);
                }
                catch
                {
                    // 忽略可能正被其他實體開啟的暫存目錄
                }
            }
        }
        catch
        {
            // 忽略排查例外
        }
    }

    /// <summary>
    /// 從 .exe 內嵌二進位資源解壓縮到隔離的隨機暫存目錄
    /// </summary>
    private void ExtractEmbeddedWebAssets()
    {
        _tempWebDir = Path.Combine(
            Path.GetTempPath(),
            $"CPE_Tool_Web_{Guid.NewGuid():N}"
        );

        Directory.CreateDirectory(_tempWebDir);

        var assembly = Assembly.GetExecutingAssembly();
        using var stream = assembly.GetManifestResourceStream("web.zip");
        if (stream == null)
        {
            MessageBox.Show("找不到內嵌網頁資源 (web.zip)！請重新編譯。", "錯誤", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        archive.ExtractToDirectory(_tempWebDir, true);
    }

    private async void InitializeWebView()
    {
        _webView = new WebView2
        {
            Dock = DockStyle.Fill
        };
        this.Controls.Add(_webView);

        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CPE_Tool",
            "WebViewData"
        );

        // 核心關鍵優化：
        // 1. --disable-features=msSmartScreenProtection：關閉虛擬主機的 SmartScreen 雲端聲譽檢查（避免每次換頁聯網等待）
        // 2. --host-resolver-rules：直接在 Chromium 內部將虛擬網域名稱映射至本機，徹底避開 Windows mDNS / DNS 3~4 秒的網路廣播逾時延遲！
        var options = new CoreWebView2EnvironmentOptions(
            additionalBrowserArguments: $"--disable-features=msSmartScreenProtection --host-resolver-rules=\"MAP {VirtualHostName} 127.0.0.1\""
        );

        var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
        await _webView.EnsureCoreWebView2Async(env);

        // 基本設置
        _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
        _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        _webView.CoreWebView2.Settings.IsZoomControlEnabled = true;

        // 使用 Chromium 官方標準虛擬主機對應 (RFC 2606 保留網域 appassets.example)
        if (!string.IsNullOrEmpty(_tempWebDir) && Directory.Exists(_tempWebDir))
        {
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                VirtualHostName,
                _tempWebDir,
                CoreWebView2HostResourceAccessKind.Allow
            );
        }

        // 攔截另開新視窗事件 (如 target="_blank" 或 window.open)，改用系統預設瀏覽器開啟
        _webView.CoreWebView2.NewWindowRequested += (s, e) =>
        {
            e.Handled = true;
            try
            {
                Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true });
            }
            catch
            {
                // 忽略外部呼叫例外
            }
        };

        // 監聽網頁標題更新
        _webView.CoreWebView2.DocumentTitleChanged += (s, e) =>
        {
            if (!string.IsNullOrEmpty(_webView.CoreWebView2.DocumentTitle))
            {
                this.Text = $"CPE Tool - {_webView.CoreWebView2.DocumentTitle}";
            }
        };

        // 導航至首頁 (極速加載)
        _webView.CoreWebView2.Navigate($"https://{VirtualHostName}/index.html");
    }

    private void CleanupCurrentTempDir()
    {
        if (string.IsNullOrEmpty(_tempWebDir) || !Directory.Exists(_tempWebDir)) return;
        try
        {
            Directory.Delete(_tempWebDir, true);
        }
        catch
        {
            // 忽略因非同步行程尚未釋放 handle 產生的例外
        }
    }
}
