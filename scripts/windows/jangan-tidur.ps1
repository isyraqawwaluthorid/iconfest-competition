# Mengatur semua profil daya agar mesin tidak tidur, tidak hibernasi, dan layar tidak mati selama tercolok listrik.
# Worker berhenti saat mesin tidur, jadi ini wajib di mesin yang menjalankan worker.
# Jalankan sekali sebagai Administrator.
powercfg /list | Select-String "GUID" | ForEach-Object {
    if ($_ -match 'GUID: ([0-9a-f-]+)\s+\((.+?)\)') {
        $guid = $Matches[1]
        powercfg /setacvalueindex $guid SUB_SLEEP STANDBYIDLE 0
        powercfg /setacvalueindex $guid SUB_SLEEP HIBERNATEIDLE 0
        powercfg /setacvalueindex $guid SUB_VIDEO VIDEOIDLE 0
        Write-Host "Profil '$($Matches[2])': tidak tidur saat tercolok."
    }
}
powercfg /setactive SCHEME_CURRENT
