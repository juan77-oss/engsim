param([string]$FilePath)

$bytes = [System.IO.File]::ReadAllBytes($FilePath)

# Check for BOM
$hasBOM = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
Write-Host "BOM: $hasBOM"

# Find bytes in range 0x80-0xFF (non-ASCII)
$nonAscii = @()
for ($i = 0; $i -lt $bytes.Length; $i++) {
    if ($bytes[$i] -gt 0x7F) {
        $nonAscii += [PSCustomObject]@{
            Offset = $i
            Byte   = $bytes[$i]
            Hex    = ('0x{0:X2}' -f $bytes[$i])
        }
    }
}

Write-Host "Total non-ASCII bytes: $($nonAscii.Count)"
Write-Host ""

# Show context around each non-ASCII byte
foreach ($entry in $nonAscii) {
    $start = [Math]::Max(0, $entry.Offset - 40)
    $end   = [Math]::Min($bytes.Length - 1, $entry.Offset + 40)
    $contextBytes = $bytes[$start..$end]
    # Try to decode as latin1 for display
    $context = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($contextBytes)
    Write-Host ("Offset {0,6} | Byte {1} | Context: ...{2}..." -f $entry.Offset, $entry.Hex, $context)
}
