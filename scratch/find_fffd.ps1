$rootPath = Split-Path -Parent $PSCommandPath | Split-Path -Parent
$results = @()

Get-ChildItem -Path $rootPath -Recurse -Include '*.html','*.js','*.css','*.md' | ForEach-Object {
    $file = $_.FullName
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $matches_found = @()
    for ($idx = 0; $idx -lt ($bytes.Length - 2); $idx++) {
        if ($bytes[$idx] -eq 0xEF -and $bytes[$idx+1] -eq 0xBF -and $bytes[$idx+2] -eq 0xBD) {
            $matches_found += $idx
        }
    }
    if ($matches_found.Count -gt 0) {
        Write-Host "FILE: $file  |  Occurrences: $($matches_found.Count)  |  Byte offsets: $($matches_found -join ', ')"
        $results += $file
    }
}

Write-Host "---"
Write-Host "Total files with U+FFFD: $($results.Count)"
