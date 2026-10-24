<#
  SCAN READER (simple version)
  ----------------------------
  A scanning and reading machine, like a SARA, made from the laptop and the
  Canon scanner. Put a page face down on the scanner, press S (or F5 or Enter),
  and it is read aloud.

  WITH JAWS RUNNING
    JAWS does all the talking, in its own voice and at its own speed. This
    program never turns JAWS off or changes any JAWS setting. It only hands
    JAWS text to say.
    The pages appear in a normal text window, so all the usual JAWS reading
    keys work (arrows, Say All, Control to stop, Control+A and Control+C).

  WITHOUT JAWS
    The program reads aloud with the Windows voice.

  KEYS
    S, F5, Enter  scan a page and read it
    Space         start reading / pause (remembers the place)
    Page Up/Down  previous / next page
    Escape        stop talking
    Ctrl+C        copy (copies all pages if nothing is selected)
    Ctrl+S        save all pages as one file on the desktop
    Ctrl+N twice  start a new document
    F1            help
    Without JAWS also: arrows move by word / line, Minus / Plus change speed.

  It is an ordinary window: Alt+Tab goes to other programs, Ctrl+Alt+S
  comes back. It starts by itself when the laptop starts.

  Uses only parts of Windows: the scanner system (WIA), the text-recognition
  engine (Windows.Media.Ocr) and the Windows voice (SAPI). No internet,
  no installing, no administrator rights, no Windows or JAWS settings changed.

  Saves pages to:   Documents\Scanned Pages\<date and time>\Page 001.txt
  Remembers place:  %LOCALAPPDATA%\ScanReader\position.txt

  The first time, start it with "Start Scan Reader.cmd". It then puts a
  "Scan Reader" icon on the desktop and in the Startup folder.

  For testing without a scanner:
    powershell -STA -ExecutionPolicy Bypass -File ScanReader.ps1 -TestImagesFolder "C:\some\pictures"
#>
param(
    [string]$TestImagesFolder,   # use these images instead of the scanner (testing)
    [switch]$SelfTest            # check the reading logic only, then quit
)

$ErrorActionPreference = 'Stop'

# ============================================================== SETTINGS ===
$Dpi        = 300     # scan resolution; 300 suits normal print
$StartSpeed = -1      # Windows voice speed -10 (slow) .. 10 (fast); not used with JAWS

# ============================================================== WORDING ===
$Msg = @{
    Ready        = 'Scan reader is ready.'
    PlacePage    = 'Put a page face down on the scanner glass, close the lid, and press S.'
    Scanning     = 'Scanning.'
    Recognizing  = 'Recognizing text.'
    Reading      = 'Reading.'
    Paused       = 'Paused.'
    Nothing      = 'There is nothing to read yet. Put a page face down on the scanner glass, close the lid, and press S.'
    NoText       = 'I could not find any text on this page. Please check that the printed side is face down on the glass, and press S again.'
    Poor         = 'I could only read part of this page, so some words may be wrong.'
    NoScanner    = 'I cannot find the scanner. Please check that the scanner cable is plugged into the computer, then press S to try again.'
    Busy         = 'The scanner is busy. Please wait a moment, then press S to try again.'
    LostScanner  = 'I lost contact with the scanner. Please check the cable, then press S to try again.'
    WarmingUp    = 'The scanner is warming up. Please wait a few seconds, then press S again.'
    ScanFailed   = 'Something went wrong while scanning. Please press S to try again. If this keeps happening, ask your helper.'
    NoOcr        = 'Text recognition is not installed on this computer. Please ask your helper.'
    OcrFailed    = 'Something went wrong while recognizing the text. Please press S to try again.'
    SaveFailed   = 'I could not save this page, but I will read it to you. Please tell your helper.'
    EndOfDoc     = 'End of the last page. Press S to scan another page.'
    StartOfDoc   = 'Beginning of the first page.'
    FirstPage    = 'This is the first page.'
    LastPage     = 'This is the last page. Press S to scan another page.'
    Slower       = 'Slower.'
    Faster       = 'Faster.'
    Slowest      = 'This is the slowest speed.'
    Fastest      = 'This is the fastest speed.'
    ConfirmNew   = 'To start a new document, press Control N again. Your pages so far are saved.'
    NewStarted   = 'New document started. Put a page face down on the scanner glass, close the lid, and press S.'
    UnknownKey   = 'That key does nothing. Press F1 for help.'
    Error        = 'Something unexpected went wrong. Please try again. If it keeps happening, ask your helper.'
    Goodbye      = 'Scan reader is closing. Goodbye.'
    SelectedAll  = 'All pages are selected. Press Control C to copy them.'
    CopiedAll    = 'Copied all pages. You can now paste them into an email or a document.'
    SavedDesktop = 'Saved. The file is on the desktop. Its name starts with Scanned document.'
    SaveDeskFail = 'Sorry, I could not save the file on the desktop.'
    KeysJaws     = 'Here are the keys. S scans a page. F5 and Enter also scan. Space starts or pauses reading. Your usual JAWS keys work for reading. Page Up and Page Down go to the previous or next page. Escape stops speaking. Control C copies all pages. Control S saves all pages on the desktop. Control N, pressed twice, starts a new document. Alt Tab goes to your other programs, and Control Alt S comes back here. F1 repeats this help.'
    KeysVoice    = 'Here are the keys. S scans a page. F5 and Enter also scan. Space starts or pauses reading. Left and Right arrows move one word. Up and Down arrows move one line. Page Up and Page Down go to the previous or next page. Escape stops speaking. Minus and Plus make the voice slower or faster. Control C copies all pages. Control S saves all pages on the desktop. Control N, pressed twice, starts a new document. F1 repeats this help.'
}

# ======================================================= TEXT LOGIC ===
# The whole document is one text: "Page 1", its text, a blank line, "Page 2", ...
# For moving around we note where every word and line starts in that text.
function New-TextMap([string]$Text) {
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

# Joins the pages into one text and notes where each "Page N" heading starts.
function New-DocumentText([string[]]$Pages) {
    $starts = New-Object System.Collections.Generic.List[int]
    $sb = New-Object System.Text.StringBuilder
    for ($i = 0; $i -lt $Pages.Count; $i++) {
        if ($i -gt 0) { [void]$sb.Append("`n`n") }
        $starts.Add($sb.Length)
        [void]$sb.Append("Page $($i + 1)`n").Append($Pages[$i])
    }
    [pscustomobject]@{ Text = $sb.ToString(); PageStarts = $starts }
}

function Get-CleanPageText([string]$Text) { ($Text -replace "`r`n", "`n" -replace "`r", "`n").Trim() }

function Get-WordText($Map, [int]$i) { $Map.Text.Substring($Map.Starts[$i], $Map.Lengths[$i]) }

function Get-LineText($Map, [int]$line) {
    $a = $Map.Starts[$Map.LineFirst[$line]]
    $z = $Map.LineLast[$line]
    $Map.Text.Substring($a, $Map.Starts[$z] + $Map.Lengths[$z] - $a)
}

# The word that contains (or last started before) a character position.
function Get-WordAt($Map, [int]$charIndex) {
    $found = 0
    for ($i = 0; $i -lt $Map.Starts.Count; $i++) {
        if ($Map.Starts[$i] -le $charIndex) { $found = $i } else { break }
    }
    $found
}

# Which page (0, 1, 2...) a character position is on.
function Get-PageAt($PageStarts, [int]$charIndex) {
    $page = 0
    for ($i = 0; $i -lt $PageStarts.Count; $i++) { if ($PageStarts[$i] -le $charIndex) { $page = $i } }
    $page
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
    $clean = Get-CleanPageText "  Hello   world `r`n`r`nSecond line here`n"
    Check 'clean text' ($clean -eq "Hello   world `n`nSecond line here")
    $p = New-TextMap $clean
    Check 'five words' ($p.Starts.Count -eq 5)
    Check 'two lines (blank line skipped)' ($p.LineFirst.Count -eq 2)
    Check 'word text' ((Get-WordText $p 1) -eq 'world')
    Check 'line text' ((Get-LineText $p 1) -eq 'Second line here')
    Check 'line of word' ($p.LineOf[2] -eq 1)
    $q = New-TextMap "The quick brown fox`njumps over the lazy dog."
    Check 'char 0 is word 0' ((Get-WordAt $q 0) -eq 0)
    Check 'char 4 is word 1' ((Get-WordAt $q 4) -eq 1)
    Check 'jumps is word 4' ((Get-WordAt $q $q.Text.IndexOf('jumps')) -eq 4)
    Check 'past end is last word' ((Get-WordAt $q 9999) -eq 8)
    Check 'empty text has no words' ((New-TextMap '').Starts.Count -eq 0)
    $d = New-DocumentText @('first page text', "second page`nline two", 'third')
    Check 'document has headings' ($d.Text.StartsWith("Page 1`nfirst page text`n`nPage 2`nsecond page"))
    Check 'page starts point at headings' (($d.PageStarts | ForEach-Object { $d.Text.Substring($_, 6) }) -join ',' -eq 'Page 1,Page 2,Page 3')
    Check 'position on page 2' ((Get-PageAt $d.PageStarts $d.Text.IndexOf('line two')) -eq 1)
    Check 'position on page 3' ((Get-PageAt $d.PageStarts ($d.Text.Length - 1)) -eq 2)
    Check 'empty document' ((New-DocumentText @()).Text -eq '')
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

# Only one copy at a time; starting it again (desktop icon or Ctrl+Alt+S)
# just brings the open window to the front.
$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\ScanReaderSimple', [ref]$created)
if (-not $created) {
    $null = (New-Object -ComObject WScript.Shell).AppActivate('Scan Reader')
    exit 0
}

$script:testIndex = 0

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


# ================================================================ SPEECH ===
# With JAWS: everything is handed to JAWS to say. JAWS is never switched off,
# muted or reconfigured; we only use its "say this" and "stop talking" calls
# (the same as pressing Control) and its Say All command.
# Without JAWS: the Windows voice (SAPI) is used.
$voice = New-Object -ComObject SAPI.SpVoice
$HasVoice = $voice.GetVoices().Count -gt 0
$SpeakAsync = 1 + 16          # SVSFlagsAsync + SVSFIsNotXML (read "<" as text)
$SpeakPurge = 1 + 2 + 16      # ...plus SVSFPurgeBeforeSpeak (stop what is playing)
$script:jaws = $null

function Test-Jaws {
    if (-not (Get-Process -Name jfw -ErrorAction SilentlyContinue)) { return $false }
    if (-not $script:jaws) {
        try { $script:jaws = New-Object -ComObject FreedomSci.JawsApi } catch { return $false }
    }
    $true
}

function Say([string]$Text, [switch]$Interrupt) {
    $lblStatus.Text = $Text
    Write-Log "Said: $Text"
    if (Test-Jaws) {
        try { $null = $script:jaws.SayString($Text, [bool]$Interrupt); return }
        catch { Write-Log "JAWS SayString failed: $_"; $script:jaws = $null }
    }
    if ($Interrupt -and $HasVoice) { $null = $voice.Speak('', $SpeakPurge) }
    if ($HasVoice) { $null = $voice.Speak($Text, $SpeakAsync) } else { [System.Media.SystemSounds]::Exclamation.Play() }
}

# Stop reading and anything being said, then say something.
function Say-Now([string]$Text) { Stop-Reading; Say $Text -Interrupt }

function Stop-Reading {
    $S.Reading = $false
    $S.ReadStream = 0
    if ($HasVoice) { $null = $voice.Speak('', $SpeakPurge) }
    if ($S.JawsReading) {
        $S.JawsReading = $false
        if (Test-Jaws) { try { $null = $script:jaws.StopSpeech() } catch { } }
    }
}

# ================================================================= STATE ===
$S = @{
    Folder = $null; Pages = (New-Object System.Collections.ArrayList)
    Map = (New-TextMap ''); PageStarts = (New-Object System.Collections.Generic.List[int])
    Reading = $false; ReadStream = 0; ReadStart = 0; JawsReading = $false
    Busy = $false; LastCaret = -1; NewDocUntil = [datetime]::MinValue; LastSave = [datetime]::MinValue
    Down = @{}
}

function Get-Caret { $box.SelectionStart }

function Set-Caret([int]$Index) {
    $box.SelectionStart = [Math]::Max(0, [Math]::Min($Index, $box.TextLength))
    $box.SelectionLength = 0
    $box.ScrollToCaret()
}

# Puts all pages into the text window.
function Update-Document {
    $doc = New-DocumentText ([string[]]$S.Pages.ToArray())
    $S.Map = New-TextMap $doc.Text
    $S.PageStarts = $doc.PageStarts
    $box.Text = $doc.Text
    $form.Text = if ($S.Pages.Count) { "Scan Reader - $($S.Pages.Count) page$(if ($S.Pages.Count -ne 1) { 's' })" } else { 'Scan Reader' }
}

function Save-Position([switch]$Force) {
    if (-not $Force -and (((Get-Date) - $S.LastSave).TotalSeconds -lt 3 -or (Get-Caret) -eq $S.LastCaret)) { return }
    $S.LastSave = Get-Date
    $S.LastCaret = Get-Caret
    try { Set-Content -Path $PositionFile -Value @($S.Folder, (Get-Caret), $voice.Rate) -Encoding UTF8 } catch { Write-Log "Save position failed: $_" }
}

function New-DocumentFolder { Join-Path $DocsRoot (Get-Date -Format 'yyyy-MM-dd HH-mm-ss') }

function Load-Document([string]$Folder) {
    $S.Pages.Clear()
    if ($Folder -and (Test-Path $Folder)) {
        Get-ChildItem -Path $Folder -Filter 'Page *.txt' | Sort-Object Name | ForEach-Object {
            $text = Get-CleanPageText ([IO.File]::ReadAllText($_.FullName))
            if ($text) { [void]$S.Pages.Add($text) }
        }
    }
    Update-Document
}

function Save-Page([int]$Number, [string]$Text) {
    New-Item -ItemType Directory -Path $S.Folder -Force | Out-Null
    [IO.File]::WriteAllText((Join-Path $S.Folder ('Page {0:000}.txt' -f $Number)), ($Text -replace "`n", "`r`n"), [Text.Encoding]::UTF8)
    [IO.File]::WriteAllText((Join-Path $S.Folder 'All pages.txt'), (Get-AllText), [Text.Encoding]::UTF8)
}

function Get-AllText { $box.Text -replace "`r?`n", "`r`n" }

# ========================================================= SHORTCUTS ===
# A desktop icon (with the key Ctrl+Alt+S) and a Startup-folder icon, so the
# reader is always there after the laptop starts. Plain shortcuts only.
function Set-Shortcuts {
    $target = Join-Path $PSScriptRoot 'Start Scan Reader.cmd'
    $shell = New-Object -ComObject WScript.Shell
    foreach ($place in @(@('Desktop', 'CTRL+ALT+S'), @('Startup', ''))) {
        try {
            $path = Join-Path ([Environment]::GetFolderPath($place[0])) 'Scan Reader.lnk'
            if ((Test-Path $path) -and $shell.CreateShortcut($path).TargetPath -eq $target) { continue }
            $link = $shell.CreateShortcut($path)
            $link.TargetPath = $target
            $link.WorkingDirectory = $PSScriptRoot
            $link.WindowStyle = 7                    # minimised: no black box on screen
            if ($place[1]) { $link.Hotkey = $place[1] }
            $link.Description = 'Scan a page and hear it read aloud'
            $link.Save()
            Write-Log "Shortcut created: $path"
        } catch { Write-Log "Could not create shortcut in $($place[0]): $_" }
    }
}

# =============================================================== READING ===
function Test-HavePages {
    if ($S.Pages.Count -gt 0) { return $true }
    Say-Now $Msg.Nothing
    $false
}

# Reads from the cursor to the end of the document.
function Start-Reading {
    if (-not (Test-HavePages)) { return }
    $map = $S.Map
    $w = Get-WordAt $map (Get-Caret)
    if ($w -ge $map.Starts.Count - 1) {        # at the very end: start the last page again
        Set-Caret $S.PageStarts[$S.PageStarts.Count - 1]
        $w = Get-WordAt $map (Get-Caret)
    }
    $start = $map.Starts[$w]
    Set-Caret $start
    if (Test-Jaws) {
        $box.Focus() | Out-Null
        $ok = $false
        try { $ok = $script:jaws.RunScript('SayAll') } catch { Write-Log "JAWS SayAll failed: $_" }
        if (-not $ok) { try { $null = $script:jaws.SayString($map.Text.Substring($start), $false) } catch { } }
        $S.JawsReading = $true
        return
    }
    $S.ReadStart = $start
    $S.Reading = $true
    if ($HasVoice) { $S.ReadStream = $voice.Speak($map.Text.Substring($start), $SpeakAsync) }
}

# Called ten times a second. Without JAWS: moves the cursor along with the voice.
function Watch-Reading {
    Save-Position
    if (-not $S.Reading -or -not $S.ReadStream) { return }
    $st = $voice.Status
    if ($st.CurrentStreamNumber -eq $S.ReadStream) {
        $pos = $S.Map.Starts[(Get-WordAt $S.Map ($S.ReadStart + $st.InputWordPosition))]
        if ($pos -ne (Get-Caret)) { Set-Caret $pos }
    }
    if ($voice.WaitUntilDone(0)) {
        $S.Reading = $false; $S.ReadStream = 0
        Save-Position -Force
        Say $Msg.EndOfDoc
    }
}

function Switch-Reading {
    if ($S.Reading -or $S.JawsReading) { Stop-Reading; Save-Position -Force; Say $Msg.Paused -Interrupt }
    else { Stop-Reading; Start-Reading }
}

function Move-Word([int]$Delta) {
    if (-not (Test-HavePages)) { return }
    Stop-Reading
    $map = $S.Map; $t = (Get-WordAt $map (Get-Caret)) + $Delta
    if ($t -lt 0) { Say-Now $Msg.StartOfDoc; return }
    if ($t -ge $map.Starts.Count) { Say-Now $Msg.EndOfDoc; return }
    Set-Caret $map.Starts[$t]; Save-Position -Force
    Say (Get-WordText $map $t) -Interrupt
}

function Move-Line([int]$Delta) {
    if (-not (Test-HavePages)) { return }
    Stop-Reading
    $map = $S.Map; $t = $map.LineOf[(Get-WordAt $map (Get-Caret))] + $Delta
    if ($t -lt 0) { Set-Caret 0; Say-Now $Msg.StartOfDoc; return }
    if ($t -ge $map.LineFirst.Count) { Say-Now $Msg.EndOfDoc; return }
    Set-Caret $map.Starts[$map.LineFirst[$t]]; Save-Position -Force
    Say (Get-LineText $map $t) -Interrupt
}

function Move-Page([int]$Delta) {
    if (-not (Test-HavePages)) { return }
    Stop-Reading
    $t = (Get-PageAt $S.PageStarts (Get-Caret)) + $Delta
    if ($t -lt 0) { Say-Now $Msg.FirstPage; return }
    if ($t -ge $S.Pages.Count) { Say-Now $Msg.LastPage; return }
    Set-Caret $S.PageStarts[$t]; Save-Position -Force
    Start-Reading                               # reads "Page N" and then the page
}

function Set-Speed([int]$Delta) {
    $wasReading = $S.Reading
    $new = [Math]::Max(-10, [Math]::Min(10, $voice.Rate + $Delta))
    if ($new -eq $voice.Rate) { Say-Now $(if ($Delta -lt 0) { $Msg.Slowest } else { $Msg.Fastest }) }
    else { $voice.Rate = $new; Save-Position -Force; Say-Now $(if ($Delta -lt 0) { $Msg.Slower } else { $Msg.Faster }) }
    if ($wasReading) { Start-Reading }
}

# ============================================================== SCANNING ===
function Invoke-ScanCommand {
    Stop-Reading
    $S.Busy = $true
    Say $Msg.Scanning -Interrupt
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
        try { $text = Get-CleanPageText (Get-PageText $png) } catch { Write-Log "OCR error: $_"; Say-Now $Msg.OcrFailed; return }
        if (-not $text) { Remove-Item $png -ErrorAction SilentlyContinue; Say-Now $Msg.NoText; return }

        [void]$S.Pages.Add($text)
        Update-Document
        Set-Caret $S.PageStarts[$S.PageStarts.Count - 1]
        $intro = @()
        try { Save-Page $number $text } catch { Write-Log "Save failed: $_"; $intro += $Msg.SaveFailed }
        Save-Position -Force
        if (Test-PoorText $text) { $intro += $Msg.Poor }
        $intro += $Msg.Reading
        Say ($intro -join ' ')
        Start-Reading
    } finally {
        [System.Windows.Forms.Application]::DoEvents()   # throw away keys pressed while busy
        $S.Busy = $false
    }
}

# ========================================================== COPY / SAVE ===
function Copy-AllPages {
    if (-not (Test-HavePages)) { return }
    [System.Windows.Forms.Clipboard]::SetText((Get-AllText))
    Say-Now $Msg.CopiedAll
}

function Save-ToDesktop {
    if (-not (Test-HavePages)) { return }
    try {
        $name = 'Scanned document ' + (Get-Date -Format 'yyyy-MM-dd HH-mm') + '.txt'
        [IO.File]::WriteAllText((Join-Path ([Environment]::GetFolderPath('Desktop')) $name), (Get-AllText), [Text.Encoding]::UTF8)
        Say-Now $Msg.SavedDesktop
    } catch { Write-Log "Desktop save failed: $_"; Say-Now $Msg.SaveDeskFail }
}

function Start-NewDocument {
    if ((Get-Date) -le $S.NewDocUntil) {
        $S.NewDocUntil = [datetime]::MinValue
        Stop-Reading
        $S.Folder = New-DocumentFolder; $S.Pages.Clear(); Update-Document
        Save-Position -Force; Say-Now $Msg.NewStarted
    } else {
        $S.NewDocUntil = (Get-Date).AddSeconds(10); Say-Now $Msg.ConfirmNew
    }
}

# ================================================================= KEYS ===
# Returns $true if the key was used here; other keys go on to the text window
# (and to JAWS) as normal.
function Invoke-Key([System.Windows.Forms.KeyEventArgs]$e) {
    $key = $e.KeyCode.ToString()
    if ($S.Busy) { return $true }               # keys pressed during a scan are ignored
    $repeat = $S.Down.ContainsKey($key); $S.Down[$key] = $true
    if ($key -ne 'N' -or -not $e.Control) { $S.NewDocUntil = [datetime]::MinValue }
    if ($key -ne 'Space') { $S.JawsReading = $false }   # JAWS stops Say All on any key
    $jawsOn = Test-Jaws

    if ($e.Alt) { return $false }
    if ($e.Control) {
        switch ($key) {
            'C' { if ($box.SelectionLength -gt 0) { return $false }; if (-not $repeat) { Copy-AllPages }; return $true }
            'A' { if (-not $jawsOn -and $S.Pages.Count) { Say $Msg.SelectedAll -Interrupt }; return $false }
            'S' { if (-not $repeat) { Save-ToDesktop }; return $true }
            'N' { if (-not $repeat) { Start-NewDocument }; return $true }
        }
        return $false
    }

    switch -Regex ($key) {
        '^(S|F5|Return|Enter)$' { if (-not $repeat) { Invoke-ScanCommand }; return $true }
        '^Space$'  { if (-not $repeat) { Switch-Reading }; return $true }
        '^Escape$' { Stop-Reading; Save-Position -Force; return $true }
        '^F1$'     { if (-not $repeat) { Say-Now $(if ($jawsOn) { $Msg.KeysJaws } else { $Msg.KeysVoice }) }; return $true }
        '^(PageUp|Prior)$'  { Move-Page -1; return $true }
        '^(PageDown|Next)$' { Move-Page 1; return $true }
    }
    if ($jawsOn) {
        # With JAWS, arrows and the other reading keys work exactly as usual.
        return ($key -match '^([A-Z]|D[0-9])$')   # swallow letters so the window does not beep
    }
    switch -Regex ($key) {
        '^Left$'  { Move-Word -1; return $true }
        '^Right$' { Move-Word 1; return $true }
        '^Up$'    { Move-Line -1; return $true }
        '^Down$'  { Move-Line 1; return $true }
        '^(OemMinus|Subtract)$' { Set-Speed -1; return $true }
        '^(Oemplus|Add)$'       { Set-Speed 1; return $true }
        '^([A-Z]|D[0-9])$'      { if (-not $S.Reading -and -not $repeat) { Say-Now $Msg.UnknownKey }; return $true }
    }
    $false
}

# ================================================================ WINDOW ===
# An ordinary window: Alt+Tab leaves it, Ctrl+Alt+S (or the icon) comes back.
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Scan Reader'
$form.BackColor = 'Black'
$form.WindowState = 'Maximized'
$form.KeyPreview = $true

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Dock = 'Top'; $lblStatus.Height = 70; $lblStatus.ForeColor = 'Gold'; $lblStatus.BackColor = 'Black'
$lblStatus.Font = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
$lblStatus.Padding = New-Object System.Windows.Forms.Padding(20, 10, 20, 10)
$lblStatus.UseMnemonic = $false

$lblKeys = New-Object System.Windows.Forms.Label
$lblKeys.Dock = 'Bottom'; $lblKeys.Height = 50; $lblKeys.ForeColor = 'Silver'; $lblKeys.BackColor = 'Black'
$lblKeys.Font = New-Object System.Drawing.Font('Segoe UI', 12)
$lblKeys.Padding = New-Object System.Windows.Forms.Padding(20, 10, 20, 10)
$lblKeys.Text = 'S / F5 / Enter: scan  |  Space: read / pause  |  Page Up/Down: page  |  Esc: stop  |  Ctrl+C: copy  |  Ctrl+S: save to desktop  |  Ctrl+N twice: new document  |  F1: help'

# The pages, in a normal read-only text box that JAWS can read like any document.
$box = New-Object System.Windows.Forms.RichTextBox
$box.Dock = 'Fill'
$box.ReadOnly = $true
$box.BackColor = 'Black'; $box.ForeColor = 'White'
$box.Font = New-Object System.Drawing.Font('Segoe UI', 26)
$box.BorderStyle = 'None'
$box.HideSelection = $false
$box.DetectUrls = $false
$box.AccessibleName = 'Scanned pages'

$form.Controls.AddRange(@($box, $lblStatus, $lblKeys))
$form.ActiveControl = $box

$form.add_KeyDown({
    param($sender, $e)
    try {
        if (Invoke-Key $e) { $e.Handled = $true; $e.SuppressKeyPress = $true }
    } catch { Write-Log "Key error: $_"; $e.Handled = $true; Say-Now $Msg.Error }
})
$form.add_KeyUp({ param($sender, $e) $S.Down.Remove($e.KeyCode.ToString()) })

# Leaving the window stops our own voice, so it never talks over other programs.
$form.add_Deactivate({ if ($S.Reading) { Stop-Reading; Save-Position -Force } })

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 100
$timer.add_Tick({ try { Watch-Reading } catch { Write-Log "Timer error: $_" } })

function Start-Up {
    $form.Activate()
    $box.Focus() | Out-Null
    Set-Shortcuts
    $rate = $StartSpeed; $caret = 0
    if (Test-Path $PositionFile) {
        $saved = @(Get-Content $PositionFile)
        if ($saved.Count -ge 3) {
            Load-Document $saved[0]
            if ($S.Pages.Count) { $S.Folder = $saved[0]; $caret = [int]$saved[1] }
            $rate = [int]$saved[2]
        }
    }
    Set-Caret $caret
    $voice.Rate = [Math]::Max(-10, [Math]::Min(10, $rate))

    $parts = @($Msg.Ready)
    if (-not $ocr) { $parts += $Msg.NoOcr }
    if ($S.Pages.Count) {
        $parts += "You have $($S.Pages.Count) page$(if ($S.Pages.Count -ne 1) { 's' }) from last time. You are on page $((Get-PageAt $S.PageStarts (Get-Caret)) + 1). Press Space to continue reading, or S to scan another page."
    } else {
        $parts += $Msg.PlacePage
    }
    Say ($parts -join ' ')
    $timer.Start()
}

$form.add_Shown({ try { Start-Up } catch { Write-Log "Start-up error: $_"; Say-Now $Msg.Error } })

$form.add_FormClosing({
    $timer.Stop()
    Save-Position -Force
    Stop-Reading
    if (Test-Jaws) { try { $null = $script:jaws.SayString($Msg.Goodbye, $true) } catch { } }
    elseif ($HasVoice) { $null = $voice.Speak($Msg.Goodbye, 16) }   # wait until said
})

try {
    Write-Log 'Scan Reader started.'
    [System.Windows.Forms.Application]::Run($form)
} catch {
    Write-Log "Fatal: $_"
    if ($HasVoice -and -not (Test-Jaws)) { $null = $voice.Speak($Msg.Error, 16) }
} finally {
    $mutex.ReleaseMutex()
}
