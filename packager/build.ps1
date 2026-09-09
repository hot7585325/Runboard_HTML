# CPE Tool 一鍵編譯 PowerShell 腳本
param (
    [switch]$Standalone = $false
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$desktopProj = Join-Path $scriptDir "src\CpeDesktop.csproj"

# 1. 檢查是否有正在運行的 CPE_Tool 實體，避免檔案鎖定導致編譯失敗
$runningProcs = Get-Process -Name "CPE_Tool" -ErrorAction SilentlyContinue
if ($runningProcs) {
    Write-Host ">>> 偵測到 CPE_Tool.exe 正在執行中，正在自動關閉以利覆蓋編譯..." -ForegroundColor Yellow
    $runningProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
}

try {
    if ($Standalone) {
        $outDir = Join-Path $scriptDir "dist-standalone"
        Write-Host ">>> [1/2] 正在編譯獨立免安裝版本 (包含 .NET 執行階段)..." -ForegroundColor Cyan
        dotnet publish $desktopProj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true -o $outDir
    } else {
        $outDir = Join-Path $scriptDir "dist"
        Write-Host ">>> [1/2] 正在編譯標準單檔版本 (依賴 .NET 執行階段)..." -ForegroundColor Cyan
        dotnet publish $desktopProj -c Release -r win-x64 --self-contained false -o $outDir
    }

    Write-Host ">>> [2/2] 正在清理除錯符號與快取..." -ForegroundColor Cyan
    Get-ChildItem -Path $outDir -Include *.pdb, *.xml -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue

    $exePath = Join-Path $outDir "CPE_Tool.exe"
    if (Test-Path $exePath) {
        $sizeMb = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
        Write-Host ""
        Write-Host "========================================================" -ForegroundColor Green
        Write-Host "  [成功] 打包完成！" -ForegroundColor Green
        Write-Host "  產出路徑: $exePath" -ForegroundColor Green
        Write-Host "  檔案大小: $sizeMb MB" -ForegroundColor Green
        Write-Host "========================================================" -ForegroundColor Green
    } else {
        throw "找不到預期的輸出檔案: $exePath"
    }
} catch {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Red
    Write-Host "  [錯誤] 打包過程發生異常！" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "========================================================" -ForegroundColor Red
    exit 1
}
