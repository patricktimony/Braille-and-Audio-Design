<#
.SYNOPSIS
    Minimal prototype: scan one page, recognise the text offline, read it aloud.

.DESCRIPTION
    Stage 1 of the Scan Reader project. It proves the three building blocks
    work together on a given Windows computer before the full application is
    built:

      1. Windows Image Acquisition (WIA) scans one page WITHOUT showing the
         scanner dialog (WIA.DeviceManager + Item.Transfer, instead of
         WIA.CommonDialog.ShowAcquireImage).
      2. Windows.Media.Ocr (the OCR engine built into Windows 10/11)
         recognises the text. No internet connection is used.
      3. System.Speech (SAPI 5, built into Windows) reads it aloud.

    Requirements: Windows PowerShell 5.1 (the blue "Windows PowerShell" that
    ships with Windows). It does NOT work in PowerShell 7, which cannot load
    Windows Runtime types this way.

    Nothing is installed, no settings are changed, nothing is downloaded.
    It writes two files: scan-prototype.bmp and scan-prototype.txt in the
    folder given by -OutputFolder (default: C:\Users\Public).

    Run it on the TEST computer, not on the final computer, with:
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Scan-Ocr-Speak.ps1
    "-ExecutionPolicy Bypass" applies only to this one PowerShell process;
    it does not change the computer's policy.

.PARAMETER ImagePath
    Skip scanning and recognise an existing image file instead
    (useful on a computer without a scanner).

.PARAMETER Dpi
    Scan resolution. 300 is a good value for printed text.
#>
[CmdletBinding()]
param(
    [string]$OutputFolder = 'C:\Users\Public',
    [string]$ImagePath,
    [int]$Dpi = 300
)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -ne 5) {
    Write-Error 'Please run this script in Windows PowerShell 5.1 (powershell.exe), not PowerShell 7.'
}

# ---------------------------------------------------------------- speech ---
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
if (-not ($voice.GetInstalledVoices() | Where-Object { $_.Enabled })) {
    Write-Error 'No Windows voices are installed.'
}
$voice.Rate = -1
function Say([string]$Text) {
    Write-Host $Text
    $voice.Speak($Text)
}

# ------------------------------------------------- Windows Runtime helper ---
# Windows.Media.Ocr is a Windows Runtime API. PowerShell 5.1 can load it,
# but its asynchronous methods must be turned into .NET Tasks and waited on.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1

function Wait-WinRt($Operation, [Type]$ResultType) {
    $task = $asTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $task.Wait() | Out-Null
    $task.Result
}

[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]

# --------------------------------------------------------- 1. scan page ---
function Set-WiaProperty($Item, [int]$Id, $Value) {
    foreach ($p in $Item.Properties) {
        if ($p.PropertyID -eq $Id) {
            try { $p.Value = $Value } catch { Write-Warning "Could not set WIA property $Id : $_" }
        }
    }
}
function Set-WiaPropertyToMax($Item, [int]$Id) {
    foreach ($p in $Item.Properties) {
        if ($p.PropertyID -eq $Id) {
            try { $p.Value = $p.SubTypeMax } catch { Write-Warning "Could not maximise WIA property $Id : $_" }
        }
    }
}

if (-not $ImagePath) {
    $ImagePath = Join-Path $OutputFolder 'scan-prototype.bmp'
    Say 'Scanning.'

    $manager = New-Object -ComObject WIA.DeviceManager
    $info = $null
    foreach ($d in $manager.DeviceInfos) { if ($d.Type -eq 1) { $info = $d; break } }  # 1 = scanner
    if (-not $info) {
        Say 'I cannot find the scanner. Please check that it is plugged in.'
        exit 1
    }
    $device = $info.Connect()
    $item = $device.Items.Item(1)

    # Order matters: the "intent" can reset the other properties.
    Set-WiaProperty $item 6146 2            # WIA_IPS_CUR_INTENT = grayscale
    Set-WiaProperty $item 6147 $Dpi         # horizontal resolution
    Set-WiaProperty $item 6148 $Dpi         # vertical resolution
    Set-WiaProperty $item 6149 0            # x start
    Set-WiaProperty $item 6150 0            # y start
    Set-WiaPropertyToMax $item 6151         # width  = whole glass
    Set-WiaPropertyToMax $item 6152         # height = whole glass

    $bmpFormat = '{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}'
    $image = $item.Transfer($bmpFormat)      # no dialog is shown
    if (Test-Path $ImagePath) { Remove-Item $ImagePath }
    $image.SaveFile($ImagePath)
    Write-Host "Saved $ImagePath ($($image.Width) x $($image.Height) pixels)"
}

# ------------------------------------------------------- 2. recognise ---
Say 'Recognizing text.'
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    Write-Host 'Installed OCR languages:'
    [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { Write-Host "  $($_.LanguageTag)" }
    Say 'Text recognition is not installed for your Windows language.'
    exit 1
}
Write-Host "OCR language: $($engine.RecognizerLanguage.LanguageTag); max image size $([Windows.Media.Ocr.OcrEngine]::MaxImageDimension) pixels"

$file    = Wait-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $ImagePath).Path)) ([Windows.Storage.StorageFile])
$stream  = Wait-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Wait-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap  = Wait-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$result  = Wait-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$stream.Dispose()

$text = ($result.Lines | ForEach-Object { $_.Text }) -join "`r`n"
$textPath = [IO.Path]::ChangeExtension($ImagePath, '.txt')
[IO.File]::WriteAllText($textPath, $text, [Text.Encoding]::UTF8)
Write-Host "Saved $textPath ($($result.Lines.Count) lines)"

# ----------------------------------------------------------- 3. speak ---
if ([string]::IsNullOrWhiteSpace($text)) {
    Say 'I could not find any text on this page.'
    exit 0
}
Say 'Reading.'
$voice.Speak($text)
