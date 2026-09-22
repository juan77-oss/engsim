$repoRoot = "c:\Users\Usuario\Documents\engsim\engsim"

# Use Windows-1252 encoding to correctly decode bytes 0x80-0x9F
$win1252   = [System.Text.Encoding]::GetEncoding(1252)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Map: Windows-1252 character (as Unicode code point) -> HTML entity
# Only the 0x80-0x9F range needs special treatment; 0xA0-0xFF is same as Latin-1 and
# those chars are also valid Unicode, so we can use numeric entities or named ones.
$entityMap = @{}

# Build map for ALL Windows-1252 chars > 127 by decoding the byte as Win-1252
for ($b = 0x80; $b -le 0xFF; $b++) {
    $char = $win1252.GetChars([byte[]]@($b))[0]
    $cp   = [int]$char

    # Named entities for the most common engineering / typography chars
    $named = switch ($cp) {
        0x20AC { '&euro;'    }   # € (0x80 win1252)
        0x201A { '&sbquo;'   }   # ‚
        0x0192 { '&fnof;'    }   # ƒ
        0x201E { '&bdquo;'   }   # „
        0x2026 { '&hellip;'  }   # …
        0x2020 { '&dagger;'  }   # †
        0x2021 { '&Dagger;'  }   # ‡
        0x02C6 { '&circ;'    }   # ˆ
        0x2030 { '&permil;'  }   # ‰
        0x0160 { '&Scaron;'  }   # Š
        0x2039 { '&lsaquo;'  }   # ‹
        0x0152 { '&OElig;'   }   # Œ
        0x017D { '&#381;'    }   # Ž
        0x2018 { '&lsquo;'   }   # '
        0x2019 { '&rsquo;'   }   # '
        0x201C { '&ldquo;'   }   # "
        0x201D { '&rdquo;'   }   # "
        0x2022 { '&bull;'    }   # •
        0x2013 { '&ndash;'   }   # – (en dash)
        0x2014 { '&mdash;'   }   # — (em dash)  ← 0x97 in Win-1252
        0x02DC { '&tilde;'   }   # ˜
        0x2122 { '&trade;'   }   # ™
        0x0161 { '&scaron;'  }   # š
        0x203A { '&rsaquo;'  }   # ›
        0x0153 { '&oelig;'   }   # œ
        0x017E { '&#382;'    }   # ž
        0x0178 { '&Yuml;'    }   # Ÿ
        0x00A0 { '&nbsp;'    }   # non-breaking space
        0x00A1 { '&iexcl;'   }
        0x00A2 { '&cent;'    }
        0x00A3 { '&pound;'   }
        0x00A4 { '&curren;'  }
        0x00A5 { '&yen;'     }
        0x00A6 { '&brvbar;'  }
        0x00A7 { '&sect;'    }
        0x00A8 { '&uml;'     }
        0x00A9 { '&copy;'    }
        0x00AA { '&ordf;'    }
        0x00AB { '&laquo;'   }
        0x00AC { '&not;'     }
        0x00AD { '&shy;'     }
        0x00AE { '&reg;'     }
        0x00AF { '&macr;'    }
        0x00B0 { '&deg;'     }   # °  ← 0xB0 in Win-1252
        0x00B1 { '&plusmn;'  }   # ±
        0x00B2 { '&sup2;'    }   # ²  ← 0xB2 in Win-1252
        0x00B3 { '&sup3;'    }   # ³
        0x00B4 { '&acute;'   }
        0x00B5 { '&micro;'   }   # µ
        0x00B6 { '&para;'    }
        0x00B7 { '&middot;'  }
        0x00B8 { '&cedil;'   }
        0x00B9 { '&sup1;'    }
        0x00BA { '&ordm;'    }
        0x00BB { '&raquo;'   }
        0x00BC { '&frac14;'  }
        0x00BD { '&frac12;'  }
        0x00BE { '&frac34;'  }
        0x00BF { '&iquest;'  }
        0x00C0 { '&Agrave;'  }
        0x00C1 { '&Aacute;'  }
        0x00C2 { '&Acirc;'   }
        0x00C3 { '&Atilde;'  }
        0x00C4 { '&Auml;'    }
        0x00C5 { '&Aring;'   }
        0x00C6 { '&AElig;'   }
        0x00C7 { '&Ccedil;'  }
        0x00C8 { '&Egrave;'  }
        0x00C9 { '&Eacute;'  }
        0x00CA { '&Ecirc;'   }
        0x00CB { '&Euml;'    }
        0x00CC { '&Igrave;'  }
        0x00CD { '&Iacute;'  }
        0x00CE { '&Icirc;'   }
        0x00CF { '&Iuml;'    }
        0x00D0 { '&ETH;'     }
        0x00D1 { '&Ntilde;'  }
        0x00D2 { '&Ograve;'  }
        0x00D3 { '&Oacute;'  }
        0x00D4 { '&Ocirc;'   }
        0x00D5 { '&Otilde;'  }
        0x00D6 { '&Ouml;'    }
        0x00D7 { '&times;'   }
        0x00D8 { '&Oslash;'  }
        0x00D9 { '&Ugrave;'  }
        0x00DA { '&Uacute;'  }
        0x00DB { '&Ucirc;'   }
        0x00DC { '&Uuml;'    }
        0x00DD { '&Yacute;'  }
        0x00DE { '&THORN;'   }
        0x00DF { '&szlig;'   }
        0x00E0 { '&agrave;'  }
        0x00E1 { '&aacute;'  }
        0x00E2 { '&acirc;'   }
        0x00E3 { '&atilde;'  }
        0x00E4 { '&auml;'    }
        0x00E5 { '&aring;'   }
        0x00E6 { '&aelig;'   }
        0x00E7 { '&ccedil;'  }
        0x00E8 { '&egrave;'  }
        0x00E9 { '&eacute;'  }
        0x00EA { '&ecirc;'   }
        0x00EB { '&euml;'    }
        0x00EC { '&igrave;'  }
        0x00ED { '&iacute;'  }
        0x00EE { '&icirc;'   }
        0x00EF { '&iuml;'    }
        0x00F0 { '&eth;'     }
        0x00F1 { '&ntilde;'  }
        0x00F2 { '&ograve;'  }
        0x00F3 { '&oacute;'  }
        0x00F4 { '&ocirc;'   }
        0x00F5 { '&otilde;'  }
        0x00F6 { '&ouml;'    }
        0x00F7 { '&divide;'  }
        0x00F8 { '&oslash;'  }
        0x00F9 { '&ugrave;'  }
        0x00FA { '&uacute;'  }
        0x00FB { '&ucirc;'   }
        0x00FC { '&uuml;'    }
        0x00FD { '&yacute;'  }
        0x00FE { '&thorn;'   }
        0x00FF { '&yuml;'    }
        default { "&#$cp;" }
    }
    $entityMap[$char] = $named
}

$report        = @()
$modifiedFiles = @()

$htmlFiles = Get-ChildItem -Path $repoRoot -Recurse -Include '*.html' |
    Where-Object { $_.FullName -notmatch '\\.git\\' -and $_.FullName -notmatch '\\scratch\\' }

foreach ($file in $htmlFiles) {
    $rawBytes = [System.IO.File]::ReadAllBytes($file.FullName)

    # Skip files that look like valid UTF-8 (BOM or no non-ASCII issues)
    # Strategy: try decoding as UTF-8 strictly; if it fails, treat as Win-1252
    $isValidUtf8 = $true
    $i = 0
    while ($i -lt $rawBytes.Length) {
        $b = $rawBytes[$i]
        if ($b -lt 0x80) { $i++; continue }
        elseif ($b -ge 0xC2 -and $b -le 0xDF) {
            if ($i+1 -lt $rawBytes.Length -and ($rawBytes[$i+1] -band 0xC0) -eq 0x80) { $i+=2; continue }
            else { $isValidUtf8 = $false; break }
        }
        elseif ($b -ge 0xE0 -and $b -le 0xEF) {
            if ($i+2 -lt $rawBytes.Length -and ($rawBytes[$i+1] -band 0xC0) -eq 0x80 -and ($rawBytes[$i+2] -band 0xC0) -eq 0x80) { $i+=3; continue }
            else { $isValidUtf8 = $false; break }
        }
        elseif ($b -ge 0xF0 -and $b -le 0xF4) {
            if ($i+3 -lt $rawBytes.Length -and ($rawBytes[$i+1] -band 0xC0) -eq 0x80 -and ($rawBytes[$i+2] -band 0xC0) -eq 0x80 -and ($rawBytes[$i+3] -band 0xC0) -eq 0x80) { $i+=4; continue }
            else { $isValidUtf8 = $false; break }
        }
        else { $isValidUtf8 = $false; break }
    }

    if ($isValidUtf8) {
        # Already valid UTF-8 — check if it also has no non-ASCII, skip silently
        $hasNonAscii = ($rawBytes | Where-Object { $_ -gt 0x7F }) -ne $null
        if (-not $hasNonAscii) { continue }
        # Valid UTF-8 with multibyte chars — no fix needed for encoding
        # But check if the file still renders non-ASCII inline that should be entities
        # For now skip — these are truly UTF-8 encoded
        continue
    }

    # File has invalid UTF-8 bytes → decode as Windows-1252
    $relPath  = $file.FullName.Replace($repoRoot + '\', '')
    $win1252Text = $win1252.GetString($rawBytes)

    # Build fixed text replacing non-ASCII chars with HTML entities
    $sb = [System.Text.StringBuilder]::new($win1252Text.Length * 2)
    $localReport = @()

    $lineNo = 1
    foreach ($ch in $win1252Text.ToCharArray()) {
        if ($ch -eq "`n") { $lineNo++ }
        $cp = [int]$ch
        if ($cp -gt 0x7F) {
            $entity = $entityMap[$ch]
            if (-not $entity) { $entity = "&#$cp;" }
            [void]$sb.Append($entity)
            $localReport += [PSCustomObject]@{
                File   = $relPath
                Line   = $lineNo
                Char   = $ch
                CP     = ('U+{0:X4}' -f $cp)
                Entity = $entity
            }
        } else {
            [void]$sb.Append($ch)
        }
    }

    $fixedText = $sb.ToString()
    $utf8Bytes = $utf8NoBom.GetBytes($fixedText)
    [System.IO.File]::WriteAllBytes($file.FullName, $utf8Bytes)

    Write-Host "=== $relPath === ($($localReport.Count) replacements)"
    foreach ($r in $localReport) {
        Write-Host ("  Line {0,5} | {1,-10} {2,-10} -> {3}" -f $r.Line, $r.CP, "($($r.Char))", $r.Entity)
    }
    Write-Host "  -> FIXED: saved as UTF-8 (no BOM)"
    $report       += $localReport
    $modifiedFiles += $relPath
}

Write-Host ""
Write-Host "================================="
Write-Host "SUMMARY"
Write-Host "================================="
Write-Host "Files modified : $($modifiedFiles.Count)"
foreach ($f in $modifiedFiles) { Write-Host "  - $f" }
Write-Host "Total chars fixed: $($report.Count)"

$report | Export-Csv "$repoRoot\scratch\fix_report.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Report -> scratch\fix_report.csv"
