# Memuat ulang worker setelah kodenya berubah, di antara dua siklus agar tidak ada siklus yang terpotong.
# Jendela "SemarSight worker" menjalankannya lagi sendiri dalam 15 detik.
$procs = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker\.main' -and $_.CommandLine -notmatch 'dry-run' }
if (-not $procs) {
    Write-Host "Worker tidak berjalan. Jalankan scripts\windows\mulai-worker.ps1." -ForegroundColor Yellow
    return
}
$sinceCycleStart = [int](((Get-Date) - ($procs | Select-Object -First 1).CreationDate).TotalSeconds) % 300
if ($sinceCycleStart -lt 120) {
    Write-Host "Menunggu siklus yang sedang berjalan selesai..."
    Start-Sleep -Seconds (125 - $sinceCycleStart)
}
$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 25
$now = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker\.main' }
if ($now) { Write-Host "Worker berjalan lagi sejak $(($now | Select-Object -First 1).CreationDate)." } else { Write-Host "Worker belum berjalan lagi; periksa jendela worker." -ForegroundColor Red }
