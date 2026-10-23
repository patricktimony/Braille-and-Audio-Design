<#
  SCAN READER (simple version)
  ----------------------------
  Put a page face down on the scanner, press F5, and hear it read aloud.

  KEYS
    F5 or Enter   scan a page and read it
    Space         pause / continue (remembers the word)
    Left, Right   previous / next word
    Up, Down      previous / next line
    Page Up/Down  previous / next page
    Escape        stop talking
    Minus, Plus   slower / faster voice
    Ctrl+N twice  start a new document
    F1            help

  Uses only parts of Windows: the scanner system (WIA), the text-recognition
  engine (Windows.Media.Ocr) and the Windows voices (SAPI). No internet,
  no installing, no administrator rights, no settings changed.

  Saves pages to:   Documents\Scanned Pages\<date and time>\Page 001.txt
  Remembers place:  %LOCALAPPDATA%\ScanReader\position.txt

  Start it with "Start Scan Reader.cmd". For testing without a scanner:
    powershell -STA -ExecutionPolicy Bypass -File ScanReader.ps1 -TestImagesFolder "C:\some\pictures"
#>
param(
    [string]$TestImagesFolder,   # use these images instead of the scanner (testing)
    [switch]$SelfTest            # check the reading logic only, then quit
)

$ErrorActionPreference = 'Stop'

# ============================================================== SETTINGS ===
$Dpi        = 300     # scan resolution; 300 suits normal print
$StartSpeed = -1      # voice speed -10 (slow) .. 10 (fast); Minus/Plus change it


# ============================================================== WORDING ===
$Msg = @{
    Ready        = 'Scan reader is ready.'
    PlacePage    = 'Put a page face down on the scanner glass, close the lid, and press F5.'
    Scanning     = 'Scanning.'
    Recognizing  = 'Recognizing text.'
    Paused       = 'Paused.'
    Nothing      = 'There is nothing to read yet. Put a page face down on the scanner glass, close the lid, and press F5.'
    NoText       = 'I could not find any text on this page. Please check that the printed side is face down on the glass, and press F5 again.'
    Poor         = 'I could only read part of this page, so some words may be wrong.'
    NoScanner    = 'I cannot find the scanner. Please check that the scanner cable is plugged into the computer, then press F5 to try again.'
    Busy         = 'The scanner is busy. Please wait a moment, then press F5 to try again.'
    LostScanner  = 'I lost contact with the scanner. Please check the cable, then press F5 to try again.'
    WarmingUp    = 'The scanner is warming up. Please wait a few seconds, then press F5 again.'
    ScanFailed   = 'Something went wrong while scanning. Please press F5 to try again. If this keeps happening, ask your helper.'
    NoOcr        = 'Text recognition is not installed on this computer. Please ask your helper.'
    OcrFailed    = 'Something went wrong while recognizing the text. Please press F5 to try again.'
    SaveFailed   = 'I could not save this page, but I will read it to you. Please tell your helper.'
    StartOfPage  = 'Beginning of the page.'
    EndOfPage    = 'End of the page.'
    TopOfPage    = 'Top of the page.'
    BottomOfPage = 'Bottom of the page.'
    FirstPage    = 'This is the first page.'
    LastPage     = 'This is the last page. Press F5 to scan another page.'
    Slower       = 'Slower.'
    Faster       = 'Faster.'
    Slowest      = 'This is the slowest speed.'
    Fastest      = 'This is the fastest speed.'
    ConfirmNew   = 'To start a new document, press Control N again. Your pages so far are saved.'
    NewStarted   = 'New document started. Put a page face down on the scanner glass, close the lid, and press F5.'
    UnknownKey   = 'That key does nothing. Press F1 for help.'
    Error        = 'Something unexpected went wrong. Please try again. If it keeps happening, ask your helper.'
    Goodbye      = 'Scan reader is closing. Goodbye.'
    Keys         = 'Here are the keys. F5 scans a page. Space starts or pauses reading. Left and Right arrows move one word. Up and Down arrows move one line. Page Up and Page Down go to the previous or next page. Escape stops speaking. Minus and Plus make the voice slower or faster. Control N, pressed twice, starts a new document. F1 repeats this help.'
}

# ======================================================= PAGE LOGIC ===
# A page is its text plus where each word and line starts, for moving around.
function New-Page([string]$Text) {
    $Text = $Text -replace "`r`n", "`n" -replace "`r", "`n"
    $starts = New-Object System.Collections.Generic.List[int]
    $lengths = New-Object System.Collections.Generic.List[int]
    $lineOf = New-Object System.Collections.Generic.List[int]
    $lineFirst = New-Object System.Collections.Generic.List[int]
    $lineLast = New-Object System.Collections.Generic.List[int]
    $offset = 0
    foreach ($line in $Text.Split("`n")) {
        $first = $starts.Count
        foreach ($m in [regex]::Matches($line, '\S+')) {
            $starts.Add($offset + $m.Index); $lengths.Add($m.Length); $lineOf.Add($lineFirst.Count)
        }
        if ($starts.Count -gt $first) { $lineFirst.Add($first); $lineLast.Add($starts.Count - 1) }
        $offset += $line.Length + 1
    }
    [pscustomobject]@{ Text = $Text; Starts = $starts; Lengths = $lengths; LineOf = $lineOf; LineFirst = $lineFirst; LineLast = $lineLast }
}

function Get-WordText($Page, [int]$i) { $Page.Text.Substring($Page.Starts[$i], $Page.Lengths[$i]) }

function Get-LineText($Page, [int]$line) {
    $a = $Page.Starts[$Page.LineFirst[$line]]
    $z = $Page.LineLast[$line]
    $Page.Text.Substring($a, $Page.Starts[$z] + $Page.Lengths[$z] - $a)
}

# The word that contains (or last started before) a character position.
function Get-WordAt($Page, [int]$charIndex) {
    $found = 0
    for ($i = 0; $i -lt $Page.Starts.Count; $i++) {
        if ($Page.Starts[$i] -le $charIndex) { $found = $i } else { break }
    }
    $found
}

# How much of the text looks like real words (used to spot upside-down pages).
function Get-TextScore([string]$Text) {
    $score = 0
    foreach ($m in [regex]::Matches($Text, '\b[A-Za-z][a-z]+\b')) {
        if ($m.Value -match '[aeiouyAEIOUY]') { $score++ }
    }
    $score
}

function Test-PoorText([string]$Text) {
    $tokens = @($Text -split '\s+' | Where-Object { $_ })
    if ($tokens.Count -eq 0) { return $false }
    (Get-TextScore $Text) -lt ($tokens.Count / 2)
}

# ============================================================ SELF-TEST ===
if ($SelfTest) {
    $fails = 0
    function Check($name, $ok) { if ($ok) { "PASS  $name" } else { "FAIL  $name"; $script:fails++ } }
    $p = New-Page "  Hello   world `r`n`r`nSecond line here`n"
    Check 'five words' ($p.Starts.Count -eq 5)
    Check 'two lines (blank line skipped)' ($p.LineFirst.Count -eq 2)
    Check 'word text' ((Get-WordText $p 1) -eq 'world')
    Check 'line text' ((Get-LineText $p 1) -eq 'Second line here')
    Check 'line of word' ($p.LineOf[2] -eq 1)
    $q = New-Page "The quick brown fox`njumps over the lazy dog."
    Check 'char 0 is word 0' ((Get-WordAt $q 0) -eq 0)
    Check 'char 4 is word 1' ((Get-WordAt $q 4) -eq 1)
    Check 'jumps is word 4' ((Get-WordAt $q $q.Text.IndexOf('jumps')) -eq 4)
    Check 'past end is last word' ((Get-WordAt $q 9999) -eq 8)
    Check 'empty page has no words' ((New-Page '').Starts.Count -eq 0)
    Check 'real text scores higher than noise' ((Get-TextScore 'This is a sentence with words') -gt (Get-TextScore '~| ;: ^^ lI1 ,,, ][ xzq'))
    Check 'noise is poor' (Test-PoorText '~|| ;:. ^^ lI1 ,,, ][ %% xzq')
    Check 'short real text is not poor' (-not (Test-PoorText 'Thank you'))
    "`n$fails failed"
    exit $fails
}

# =========================================================== WINDOWS PARTS ===
Add-Type -AssemblyName System.Windows.Forms, System.Drawing, System.Runtime.WindowsRuntime
$DataFolder   = Join-Path $env:LOCALAPPDATA 'ScanReader'
$DocsRoot     = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Scanned Pages'
$PositionFile = Join-Path $DataFolder 'position.txt'
$LogFile      = Join-Path $DataFolder 'log.txt'
New-Item -ItemType Directory -Path $DataFolder -Force | Out-Null

function Write-Log([string]$Text) {
    try { Add-Content -Path $LogFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Text" } catch { }
}

# Only one copy at a time; a second copy just brings the first to the front.
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\ScanReaderSimple', [ref]$created)
if (-not $created) {
    $null = (New-Object -ComObject WScript.Shell).AppActivate('Scan Reader')
    exit 0
}

# ------------------------------------------------------------------ voice ---
$voice = New-Object -ComObject SAPI.SpVoice
$HasVoice = $voice.GetVoices().Count -gt 0
$SpeakAsync = 1 + 16          # SVSFlagsAsync + SVSFIsNotXML (read "<" as text)
$SpeakPurge = 1 + 2 + 16      # ...plus SVSFPurgeBeforeSpeak (stop what is playing)

# ------------------------------------------------------------------ state ---
$script:testIndex = 0
$S = @{
    Folder = $null; Pages = (New-Object System.Collections.ArrayList); Page = 0; Word = 0
    Reading = $false; ReadStream = 0; ReadStart = 0
    Busy = $false; NewDocUntil = [datetime]::MinValue; LastSave = [datetime]::MinValue
    Status = ''; Down = @{}
}

function Update-Screen {
    $lblStatus.Text = $S.Status
    if ($S.Pages.Count -eq 0) { $lblPage.Text = 'No pages yet'; $lblLine.Text = ''; return }
    $p = $S.Pages[$S.Page]
    $lblPage.Text = "Page $($S.Page + 1) of $($S.Pages.Count)" + $(if ($S.Reading) { '  -  reading' } else { '' })
    $lblLine.Text = if ($p.Starts.Count) { Get-LineText $p $p.LineOf[$S.Word] } else { '' }
}

# Speak after whatever is already being said.
function Say([string]$Text) {
    $S.Status = $Text
    Write-Log "Said: $Text"
    if ($HasVoice) { $null = $voice.Speak($Text, $SpeakAsync) } else { [System.Media.SystemSounds]::Exclamation.Play() }
    Update-Screen
}

# Stop everything, then speak.
function Say-Now([string]$Text) { Stop-Talking; Say $Text }

function Stop-Talking {
    $S.Reading = $false
    $S.ReadStream = 0
    if ($HasVoice) { $null = $voice.Speak('', $SpeakPurge) }
}

function Speak-Content([string]$Text) {
    Stop-Talking
    if ($HasVoice) { $null = $voice.Speak($Text, $SpeakAsync) }
    Update-Screen
}

# ---------------------------------------------------------- saving / place ---
function Save-Position([switch]$Force) {
    if (-not $Force -and ((Get-Date) - $S.LastSave).TotalSeconds -lt 3) { return }
    $S.LastSave = Get-Date
    try { Set-Content -Path $PositionFile -Value @($S.Folder, $S.Page, $S.Word, $voice.Rate) -Encoding UTF8 } catch { Write-Log "Save position failed: $_" }
}

function New-DocumentFolder { Join-Path $DocsRoot (Get-Date -Format 'yyyy-MM-dd HH-mm-ss') }

function Load-Document([string]$Folder) {
    $S.Pages.Clear()
    if (-not $Folder -or -not (Test-Path $Folder)) { return }
    Get-ChildItem -Path $Folder -Filter 'Page *.txt' | Sort-Object Name | ForEach-Object {
        $p = New-Page ([IO.File]::ReadAllText($_.FullName))
        if ($p.Starts.Count) { [void]$S.Pages.Add($p) }
    }
}

function Save-Page([int]$Number, [string]$Text) {
    New-Item -ItemType Directory -Path $S.Folder -Force | Out-Null
    $windowsText = $Text -replace "`n", "`r`n"
    [IO.File]::WriteAllText((Join-Path $S.Folder ('Page {0:000}.txt' -f $Number)), $windowsText, [Text.Encoding]::UTF8)
    $all = for ($i = 0; $i -lt $S.Pages.Count; $i++) { "----- Page $($i + 1) -----`r`n" + ($S.Pages[$i].Text -replace "`n", "`r`n") }
    [IO.File]::WriteAllText((Join-Path $S.Folder 'All pages.txt'), ($all -join "`r`n`r`n"), [Text.Encoding]::UTF8)
}

# ---------------------------------------------------------------- scanner ---
function Set-WiaProperty($Item, [int]$Id, $Value, [switch]$Max) {
    foreach ($p in $Item.Properties) {
        if ($p.PropertyID -eq $Id) {
            try { if ($Max) { $p.Value = $p.SubTypeMax } else { $p.Value = $Value } } catch { Write-Log "WIA property $Id : $_" }
        }
    }
}

# Scans the whole glass with no dialog and saves a PNG. Throws on failure.
function Invoke-Scan([string]$PngPath) {
    if ($TestImagesFolder) {
        $files = @(Get-ChildItem $TestImagesFolder -File | Where-Object { $_.Extension -match '^\.(png|bmp|jpe?g|tiff?)$' } | Sort-Object Name)
        if ($files.Count -eq 0) { throw 'NoScanner' }
        $file = $files[$script:testIndex % $files.Count]
        $script:testIndex++
        Start-Sleep -Milliseconds 800
        Convert-ToPng $file.FullName $PngPath
        return
    }
    $manager = New-Object -ComObject WIA.DeviceManager
    $info = $null
    foreach ($d in $manager.DeviceInfos) { if ($d.Type -eq 1) { $info = $d; break } }   # 1 = scanner
    if (-not $info) { throw 'NoScanner' }
    $device = $info.Connect()
    $item = $device.Items.Item(1)
    Set-WiaProperty $item 6146 2          # grayscale (set first; it can reset the others)
    Set-WiaProperty $item 6147 $Dpi       # horizontal resolution
    Set-WiaProperty $item 6148 $Dpi       # vertical resolution
    Set-WiaProperty $item 6149 0          # left edge
    Set-WiaProperty $item 6150 0          # top edge
    Set-WiaProperty $item 6151 0 -Max     # whole width of the glass
    Set-WiaProperty $item 6152 0 -Max     # whole height of the glass
    $image = $item.Transfer('{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}')   # BMP, no dialog
    $tmp = "$PngPath.scan.bmp"
    if (Test-Path $tmp) { Remove-Item $tmp }
    $image.SaveFile($tmp)
    Convert-ToPng $tmp $PngPath
    Remove-Item $tmp
}

function Convert-ToPng([string]$From, [string]$To) {
    $bytes = [IO.File]::ReadAllBytes($From)
    $img = [System.Drawing.Image]::FromStream((New-Object IO.MemoryStream(, $bytes)))
    try { $img.Save($To, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $img.Dispose() }
}

# Turns an error into the right spoken sentence.
function Get-ScanErrorMessage($ErrorRecord) {
    if ("$($ErrorRecord.Exception.Message)" -eq 'NoScanner') { return $Msg.NoScanner }
    $ex = $ErrorRecord.Exception
    while ($ex.InnerException) { $ex = $ex.InnerException }
    $code = '{0:X8}' -f $ex.HResult
    Write-Log "Scan error 0x$code : $($ex.Message)"
    switch ($code) {
        '80210015' { $Msg.NoScanner }      # no device available
        '80210006' { $Msg.Busy }           # busy
        '8021000D' { $Msg.Busy }           # locked
        '80210005' { $Msg.LostScanner }    # offline
        '8021000A' { $Msg.LostScanner }    # communication lost
        '80210009' { $Msg.LostScanner }    # device removed
        '80210007' { $Msg.WarmingUp }      # warming up
        default    { $Msg.ScanFailed }
    }
}

# ---------------------------------------------------------- text recognition ---
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Wait-WinRt($Operation, [Type]$ResultType) {
    $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    $null = $task.Wait(-1)
    $task.Result
}

$ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $ocr -and [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages.Count -gt 0) {
    $ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages[0])
}
Write-Log $(if ($ocr) { "OCR language: $($ocr.RecognizerLanguage.LanguageTag)" } else { 'No OCR language installed.' })

function Read-ImageText([System.Drawing.Bitmap]$Bitmap) {
    $ms = New-Object IO.MemoryStream
    $Bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $ms.Position = 0
    $stream = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
    $decoder = Wait-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $soft = Wait-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Wait-WinRt ($ocr.RecognizeAsync($soft)) ([Windows.Media.Ocr.OcrResult])
    $soft.Dispose(); $ms.Dispose()
    ($result.Lines | ForEach-Object { $_.Text }) -join "`n"
}

# Reads the page; if it looks upside down or sideways, tries turning it.
function Get-PageText([string]$PngPath) {
    $bytes = [IO.File]::ReadAllBytes($PngPath)
    $img = [System.Drawing.Image]::FromStream((New-Object IO.MemoryStream(, $bytes)))
    $max = [int][Windows.Media.Ocr.OcrEngine]::MaxImageDimension
    $scale = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height))
    $bmp = New-Object System.Drawing.Bitmap($img, [int]($img.Width * $scale), [int]($img.Height * $scale))
    $img.Dispose()
    try {
        $best = Read-ImageText $bmp
        foreach ($turn in 'Rotate180FlipNone', 'Rotate90FlipNone', 'Rotate180FlipNone') {
            if ((Get-TextScore $best) -ge 15) { break }      # clearly readable already
            $bmp.RotateFlip($turn)                            # 180, then 270, then 90 in total
            $text = Read-ImageText $bmp
            if ((Get-TextScore $text) -gt (Get-TextScore $best) * 1.5 + 3) { $best = $text }
        }
        $best
    } finally { $bmp.Dispose() }
}

# ================================================================ ACTIONS ===
function Start-Reading {
    $p = $S.Pages[$S.Page]
    $S.ReadStart = $p.Starts[$S.Word]
    $S.Reading = $true
    if ($HasVoice) { $S.ReadStream = $voice.Speak($p.Text.Substring($S.ReadStart), $SpeakAsync) }
    Update-Screen
}

# Called ten times a second: follows the voice word by word, and moves on at the end of a page.
function Watch-Reading {
    if (-not $S.Reading -or -not $S.ReadStream) { return }
    $st = $voice.Status
    if ($st.CurrentStreamNumber -eq $S.ReadStream) {
        $w = Get-WordAt $S.Pages[$S.Page] ($S.ReadStart + $st.InputWordPosition)
        if ($w -ne $S.Word) { $S.Word = $w; Save-Position; Update-Screen }
    }
    if ($voice.WaitUntilDone(0)) {
        if ($S.Page -lt $S.Pages.Count - 1) {
            $S.Page++; $S.Word = 0; Save-Position -Force
            Say "Page $($S.Page + 1)."
            Start-Reading
        } else {
            $S.Reading = $false; $S.ReadStream = 0; $S.Word = 0; Save-Position -Force
            Say "End of page $($S.Page + 1). That was the last page. Press F5 to scan another page, or Space to hear this page again."
        }
    }
}

function Invoke-ScanCommand {
    Stop-Talking
    $S.Busy = $true
    Say $Msg.Scanning
    $form.Refresh()
    try {
        if (-not $ocr) { Say-Now $Msg.NoOcr; return }
        if (-not $S.Folder) { $S.Folder = New-DocumentFolder }
        New-Item -ItemType Directory -Path $S.Folder -Force | Out-Null
        $number = @(Get-ChildItem $S.Folder -Filter 'Page *.txt').Count + 1
        while (Test-Path (Join-Path $S.Folder ('Page {0:000}.txt' -f $number))) { $number++ }
        $png = Join-Path $S.Folder ('Page {0:000}.png' -f $number)

        try { Invoke-Scan $png } catch { Say-Now (Get-ScanErrorMessage $_); return }

        Say $Msg.Recognizing
        $form.Refresh()
        try { $text = Get-PageText $png } catch { Write-Log "OCR error: $_"; Say-Now $Msg.OcrFailed; return }

        $page = New-Page $text
        if ($page.Starts.Count -eq 0) { Remove-Item $png -ErrorAction SilentlyContinue; Say-Now $Msg.NoText; return }

        [void]$S.Pages.Add($page)
        $S.Page = $S.Pages.Count - 1
        $S.Word = 0
        $intro = @()
        try { Save-Page $number $page.Text } catch { Write-Log "Save failed: $_"; $intro += $Msg.SaveFailed }
        Save-Position -Force
        if (Test-PoorText $page.Text) { $intro += $Msg.Poor }
        $intro += "Page $($S.Page + 1). Reading."
        Say ($intro -join ' ')
        Start-Reading
    } finally {
        [System.Windows.Forms.Application]::DoEvents()   # throw away keys pressed while busy
        $S.Busy = $false
        Update-Screen
    }
}

function Test-HavePages {
    if ($S.Pages.Count -gt 0) { return $true }
    Say-Now $Msg.Nothing
    $false
}

function Move-Word([int]$Delta) {
    if (-not (Test-HavePages)) { return }
    Stop-Talking
    $p = $S.Pages[$S.Page]; $t = $S.Word + $Delta
    if ($t -lt 0) { Say-Now $Msg.StartOfPage; return }
    if ($t -ge $p.Starts.Count) { Say-Now $Msg.EndOfPage; return }
    $S.Word = $t; Save-Position -Force
    Speak-Content (Get-WordText $p $t)
}

function Move-Line([int]$Delta) {
    if (-not (Test-HavePages)) { return }
    Stop-Talking
    $p = $S.Pages[$S.Page]; $t = $p.LineOf[$S.Word] + $Delta
    if ($t -lt 0) { $S.Word = 0; Save-Position -Force; Say-Now $Msg.TopOfPage; return }
    if ($t -ge $p.LineFirst.Count) { Say-Now $Msg.BottomOfPage; return }
    $S.Word = $p.LineFirst[$t]; Save-Position -Force
    Speak-Content (Get-LineText $p $t)
}

function Move-Page([int]$Delta) {
    if (-not (Test-HavePages)) { return }
    $t = $S.Page + $Delta
    if ($t -lt 0) { Say-Now $Msg.FirstPage; return }
    if ($t -ge $S.Pages.Count) { Say-Now $Msg.LastPage; return }
    $S.Page = $t; $S.Word = 0; Save-Position -Force
    Say-Now "Page $($t + 1) of $($S.Pages.Count)."
    Start-Reading
}

function Set-Speed([int]$Delta) {
    $wasReading = $S.Reading
    $new = [Math]::Max(-10, [Math]::Min(10, $voice.Rate + $Delta))
    if ($new -eq $voice.Rate) { Say-Now $(if ($Delta -lt 0) { $Msg.Slowest } else { $Msg.Fastest }) }
    else { $voice.Rate = $new; Save-Position -Force; Say-Now $(if ($Delta -lt 0) { $Msg.Slower } else { $Msg.Faster }) }
    if ($wasReading) { Start-Reading }
}

function Invoke-Key([System.Windows.Forms.KeyEventArgs]$e) {
    $key = $e.KeyCode.ToString()
    if ($S.Busy) { return }                     # keys pressed during a scan are ignored
    $repeat = $S.Down.ContainsKey($key); $S.Down[$key] = $true
    if ($key -ne 'N' -or -not $e.Control) { $S.NewDocUntil = [datetime]::MinValue }

    if ($e.Control) {
        if ($key -eq 'N' -and -not $repeat) {
            if ((Get-Date) -le $S.NewDocUntil) {
                $S.NewDocUntil = [datetime]::MinValue
                $S.Folder = New-DocumentFolder; $S.Pages.Clear(); $S.Page = 0; $S.Word = 0
                Save-Position -Force; Say-Now $Msg.NewStarted
            } else {
                $S.NewDocUntil = (Get-Date).AddSeconds(10); Say-Now $Msg.ConfirmNew
            }
        }
        return
    }
    if ($e.Alt) { return }

    switch -Regex ($key) {
        '^(F5|Return|Enter)$' { if (-not $repeat) { Invoke-ScanCommand }; break }
        '^Space$' {
            if ($repeat) { break }
            if ($S.Reading) { Stop-Talking; Save-Position -Force; Say $Msg.Paused }
            elseif (Test-HavePages) { Stop-Talking; Start-Reading }
            break
        }
        '^Left$'  { Move-Word -1; break }
        '^Right$' { Move-Word 1; break }
        '^Up$'    { Move-Line -1; break }
        '^Down$'  { Move-Line 1; break }
        '^(PageUp|Prior)$'  { Move-Page -1; break }
        '^(PageDown|Next)$' { Move-Page 1; break }
        '^Escape$' { Stop-Talking; Save-Position -Force; Update-Screen; break }
        '^F1$' {
            if ($repeat) { break }
            $where = if ($S.Pages.Count) { "You are on page $($S.Page + 1) of $($S.Pages.Count). " } else { 'No pages scanned yet. ' }
            Say-Now ($where + $Msg.Keys); break
        }
        '^(OemMinus|Subtract)$' { Set-Speed -1; break }
        '^(Oemplus|Add)$'       { Set-Speed 1; break }
        '^([A-Z]|D[0-9])$'      { if (-not $S.Reading -and -not $repeat) { Say-Now $Msg.UnknownKey }; break }
    }
}

# ================================================================= WINDOW ===
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Scan Reader'
$form.BackColor = 'Black'
$form.WindowState = 'Maximized'
$form.TopMost = $true
$form.KeyPreview = $true

function New-Label([float]$Size, [string]$Color, [string]$Dock) {
    $l = New-Object System.Windows.Forms.Label
    $l.ForeColor = $Color; $l.BackColor = 'Black'; $l.Dock = $Dock; $l.UseMnemonic = $false
    $l.Font = New-Object System.Drawing.Font('Segoe UI', $Size, [System.Drawing.FontStyle]::Bold)
    $l.Padding = New-Object System.Windows.Forms.Padding(30, 15, 30, 15)
    $l.AutoSize = $false
    $l
}
$lblKeys = New-Label 12 'Silver' 'Bottom'
$lblKeys.Height = 60
$lblKeys.Text = 'F5 / Enter: scan  |  Space: play/pause  |  Left/Right: word  |  Up/Down: line  |  Page Up/Down: page  |  Esc: stop  |  - / +: speed  |  Ctrl+N twice: new document  |  F1: help'
$lblLine = New-Label 36 'White' 'Fill'
$lblPage = New-Label 22 'Gold' 'Top'
$lblPage.Height = 70
$lblStatus = New-Label 24 'White' 'Top'
$lblStatus.Height = 160
$form.Controls.AddRange(@($lblLine, $lblPage, $lblStatus, $lblKeys))

$form.add_PreviewKeyDown({ $_.IsInputKey = $true })     # let the arrow keys through
$form.add_KeyDown({
    param($sender, $e)
    $e.Handled = $true; $e.SuppressKeyPress = $true
    try { Invoke-Key $e } catch { Write-Log "Key error: $_"; Say-Now $Msg.Error }
})
$form.add_KeyUp({ param($sender, $e) $S.Down.Remove($e.KeyCode.ToString()) })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.add_Tick({ try { Watch-Reading } catch { Write-Log "Timer error: $_" } })

$form.add_Shown({ try { Start-Up } catch { Write-Log "Start-up error: $_"; Say-Now $Msg.Error } })

function Start-Up {
    $form.Activate()
    # Return to the last document and place.
    $rate = $StartSpeed
    if (Test-Path $PositionFile) {
        $saved = @(Get-Content $PositionFile)
        if ($saved.Count -ge 4) {
            Load-Document $saved[0]
            if ($S.Pages.Count) {
                $S.Folder = $saved[0]
                $S.Page = [Math]::Min([int]$saved[1], $S.Pages.Count - 1)
                $S.Word = [Math]::Min([int]$saved[2], $S.Pages[$S.Page].Starts.Count - 1)
            }
            $rate = [int]$saved[3]
        }
    }
    $voice.Rate = [Math]::Max(-10, [Math]::Min(10, $rate))

    $parts = @($Msg.Ready)
    if (-not $ocr) { $parts += $Msg.NoOcr }
    if ($S.Pages.Count) {
        $parts += "You have $($S.Pages.Count) page$(if ($S.Pages.Count -ne 1) { 's' }) from last time. You are on page $($S.Page + 1). Press Space to continue reading, or press F5 to scan another page."
    } else {
        $parts += $Msg.PlacePage
    }
    Say ($parts -join ' ')
    $timer.Start()
}

$form.add_FormClosing({
    $timer.Stop()
    Save-Position -Force
    Stop-Talking
    if ($HasVoice) { $null = $voice.Speak($Msg.Goodbye, 16) }   # wait until said
})

try {
    Write-Log 'Scan Reader started.'
    [System.Windows.Forms.Application]::Run($form)
} catch {
    Write-Log "Fatal: $_"
    if ($HasVoice) { $null = $voice.Speak($Msg.Error, 16) }
} finally {
    $mutex.ReleaseMutex()
}
