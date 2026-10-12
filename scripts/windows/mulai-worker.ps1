# Membuka jendela baru yang menjalankan worker terus-menerus.
# Jika worker berhenti (error, atau sengaja dimuat ulang), jendela itu menjalankannya lagi setelah 15 detik.
# Jalankan dari mana saja:  powershell -ExecutionPolicy Bypass -File scripts\windows\mulai-worker.ps1
$worker = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\..")) "worker"
$running = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker\.main' -and $_.CommandLine -notmatch 'dry-run' }
if ($running) {
    Write-Host "Worker sudah berjalan (PID $($running.ProcessId -join ', ')). Hanya satu worker yang boleh berjalan." -ForegroundColor Yellow
    return
}
$loop = "Set-Location '$worker'; `$host.UI.RawUI.WindowTitle = 'SemarSight worker - JANGAN DITUTUP'; while (`$true) { .\.venv\Scripts\python.exe -m semarsight_worker.main; Start-Sleep -Seconds 15 }"
Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $loop
Write-Host "Jendela worker dibuka. Siklus pertama selesai dalam 1-2 menit."
