# Membangun web lalu menjalankannya di http://localhost:3000 dalam jendela sendiri.
# Build memakai banyak CPU dan bisa membuat pengambilan gambar worker kehabisan waktu,
# jadi skrip ini menunggu sampai worker sedang diam di antara dua siklus.
$web = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) "web"
Set-Location $web
$worker = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker\.main' } | Select-Object -First 1
if ($worker) {
    $s = [int](((Get-Date) - $worker.CreationDate).TotalSeconds) % 300
    if ($s -lt 100) { Start-Sleep -Seconds (105 - $s) } elseif ($s -gt 225) { Start-Sleep -Seconds (405 - $s) }
}
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { Stop-Process -Id $listener.OwningProcess -Force -Confirm:$false -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'next start' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build gagal; server tidak dijalankan." -ForegroundColor Red; return }
$serve = "Set-Location '$web'; `$host.UI.RawUI.WindowTitle = 'SemarSight web lokal (localhost:3000)'; npx next start -p 3000"
Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $serve -WindowStyle Minimized
Write-Host "Web berjalan di http://localhost:3000"
