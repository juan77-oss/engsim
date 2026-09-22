$win1252 = [System.Text.Encoding]::GetEncoding(1252)

$testBytes = @(0x97, 0x96, 0xB0, 0xB2, 0xB7, 0x85, 0xB1)
foreach ($b in $testBytes) {
    $char = $win1252.GetChars([byte[]]@($b))[0]
    $cp   = [int]$char
    Write-Host ("Byte 0x{0:X2} -> U+{1:X4} = '{2}'" -f $b, $cp, $char)
}
