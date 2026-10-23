<#
.SYNOPSIS
    Removes Scan Reader for the current user. Scanned documents are KEPT.

.DESCRIPTION
    Deletes the program folder %LOCALAPPDATA%\Programs\ScanReader and the three
    shortcuts the installer made. Settings/log (%LOCALAPPDATA%\ScanReader) are kept
    unless -RemoveSettings is given. Documents\Scanned Pages is never touched.
#>
[CmdletBinding()]
param([switch]$RemoveSettings)

$paths = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop'))  'Scan Reader.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Scan Reader.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Startup'))  'Scan Reader.lnk'),
    (Join-Path $env:LOCALAPPDATA 'Programs\ScanReader')
)
if ($RemoveSettings) { $paths += (Join-Path $env:LOCALAPPDATA 'ScanReader') }

foreach ($p in $paths) {
    if (Test-Path $p) { Remove-Item $p -Recurse -Force; Write-Host "Removed $p" }
}
Write-Host 'Scan Reader removed. Scanned documents were kept in Documents\Scanned Pages.'
