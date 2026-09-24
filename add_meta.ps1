$tag = "`n    <meta name=""google-site-verification"" content=""IsonpLQAguEXEzaXseWH8GDbOLo6xvF0BJBOlMVcE4A"" />"
$files = Get-ChildItem -Path . -Filter "*.html" -Recurse | Where-Object { $_.FullName -notmatch '\\scratch\\' }
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName)
    if ($content -notmatch "google-site-verification") {
        # use regex replace for case insensitive <head>
        $content = [regex]::Replace($content, "(?i)<head>", "<head>$tag")
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
        Write-Host "Updated $($f.FullName)"
    }
}
