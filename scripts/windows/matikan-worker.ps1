# Mematikan worker dengan rapi: menunggu siklus yang sedang berjalan selesai, lalu menutup jendela
# "SemarSight worker" beserta prosesnya, sehingga worker tidak dinyalakan ulang otomatis.
# Web tidak perlu diapa-apakan: lewat 15 menit tanpa siklus baru, web menampilkan "Data tertunda" sendiri.
$python = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker\.main' -and $_.CommandLine -notmatch 'dry-run' }
$loop = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker\.main' -and $_.CommandLine -match 'while' }
if (-not $python -and -not $loop) {
    Write-Host "Worker memang sedang mati." -ForegroundColor Yellow
    return
}
if ($python) {
    # Siklus dimulai saat worker dinyalakan lalu tiap 5 menit dan selesai dalam 1-2 menit.
    $sinceCycleStart = [int](((Get-Date) - ($python | Select-Object -First 1).CreationDate).TotalSeconds) % 300
    if ($sinceCycleStart -lt 120) {
        Write-Host "Menunggu siklus yang sedang berjalan selesai (sekitar $(125 - $sinceCycleStart) detik)..."
        Start-Sleep -Seconds (125 - $sinceCycleStart)
    }
}
# Jendela pengulang dimatikan lebih dulu supaya tidak menyalakan worker lagi.
$loop | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }
$python | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 3
$left = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'semarsight_worker\.main' -and $_.CommandLine -notmatch 'dry-run' }
if ($left) {
    Write-Host "Worker belum berhenti (PID $($left.ProcessId -join ', ')). Coba jalankan skrip ini sekali lagi." -ForegroundColor Red
} else {
    Write-Host "Worker sudah mati $(Get-Date -Format 'HH.mm') (jam PC). Web akan menampilkan 'Data tertunda' bila tidak dinyalakan lagi dalam 15 menit." -ForegroundColor Green
}
