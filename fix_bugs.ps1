$files = "combustion-chimenea\index.html", "entropy-diagram\index.html", "kapp-diagram\index.html", "static-beam\index.html"
$basePath = "C:\Users\Usuario\Documents\engsim\simulators\"

$replacedKapp = 0
$svgCount = @{}

foreach ($f in $files) {
    $fullPath = Join-Path $basePath $f
    if (-not (Test-Path $fullPath)) { continue }
    
    $content = Get-Content $fullPath -Raw
    
    if ($f -eq "kapp-diagram\index.html") {
        $matches = [regex]::Matches($content, "--color-accent")
        $replacedKapp += $matches.Count
        $content = $content -replace "--color-accent", "--brand-accent"
    }
    
    $count = 0
    $content = [regex]::Replace($content, '(?si)<svg([^>]+)>', {
        param($match)
        $attrs = $match.Groups[1].Value
        
        # Skip functional SVGs
        if ($attrs -match 'role="img"' -or $attrs -match 'id="') {
            return $match.Value
        }
        
        $newAttrs = $attrs
        if ($newAttrs -notmatch 'aria-hidden') { $newAttrs += ' aria-hidden="true"' }
        if ($newAttrs -notmatch 'xmlns=') { $newAttrs += ' xmlns="http://www.w3.org/2000/svg"' }
        if ($newAttrs -match 'fill="currentColor"') { 
            $newAttrs = $newAttrs -replace 'fill="currentColor"', 'fill="none"'
        } elseif ($newAttrs -notmatch 'fill=') {
            $newAttrs += ' fill="none"'
        }
        if ($newAttrs -notmatch 'stroke=') { $newAttrs += ' stroke="currentColor"' }
        if ($newAttrs -notmatch 'stroke-width=') { $newAttrs += ' stroke-width="2"' }
        if ($newAttrs -notmatch 'stroke-linecap=') { $newAttrs += ' stroke-linecap="round"' }
        if ($newAttrs -notmatch 'stroke-linejoin=') { $newAttrs += ' stroke-linejoin="round"' }
        
        $script:count++
        return "<svg$newAttrs>"
    })
    
    $svgCount[$f] = $count
    Set-Content -Path $fullPath -Value $content
}

Write-Host "Kapp replacements: $replacedKapp"
foreach ($k in $svgCount.Keys) {
    Write-Host "SVGs fixed in $k : $($svgCount[$k])"
}
