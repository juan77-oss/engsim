$lines = Get-Content 'simulators\static-beam\index.html' -Encoding UTF8
Write-Host "Line 231 (index 230):"
Write-Host $lines[230]
Write-Host ""
Write-Host "Line 229-233 context:"
for ($i = 228; $i -le 233; $i++) {
    Write-Host ("Line {0}: {1}" -f ($i+1), $lines[$i])
}

Write-Host ""
Write-Host "=== Check kapp-diagram tilde occurrences ==="
$klines = Get-Content 'simulators\kapp-diagram\index.html' -Encoding UTF8
$klines | Select-String 'tilde' | ForEach-Object { Write-Host ("Line {0}: {1}" -f $_.LineNumber, $_.Line.Trim()) }
