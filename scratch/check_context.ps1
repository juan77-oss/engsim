$repoRoot = "c:\Users\Usuario\Documents\engsim\engsim"

# Check kapp-diagram for brvbar context
Write-Host "=== KAPP-DIAGRAM brvbar occurrences (lines 4-5) ==="
$lines = Get-Content "$repoRoot\simulators\kapp-diagram\index.html" -Encoding UTF8
for ($i = 0; $i -lt [Math]::Min($lines.Length, 10); $i++) {
    Write-Host ("Line {0,3}: {1}" -f ($i+1), $lines[$i])
}

Write-Host ""
Write-Host "=== STATIC-BEAM tilde occurrences (lines 410, 422) ==="
for ($i = 407; $i -le 425; $i++) {
    if ($i -lt $lines.Length) { }
}
$lines2 = Get-Content "$repoRoot\simulators\static-beam\index.html" -Encoding UTF8
for ($i = 407; $i -le 425; $i++) {
    if ($i -lt $lines2.Length) {
        Write-Host ("Line {0,3}: {1}" -f ($i+1), $lines2[$i])
    }
}

Write-Host ""
Write-Host "=== GAS-COMBUSTION middot (line 337 approx) ==="
$lines3 = Get-Content "$repoRoot\simulators\gas-combustion\index.html" -Encoding UTF8
for ($i = 334; $i -le 340; $i++) {
    if ($i -lt $lines3.Length) {
        Write-Host ("Line {0,3}: {1}" -f ($i+1), $lines3[$i])
    }
}
