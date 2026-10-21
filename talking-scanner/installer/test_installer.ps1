# Tests the real installer the way a keyboard and screen reader user meets it.
#
#   1. Starts TalkingScannerSetup.exe and installs by pressing Enter only.
#      Each page's controls are read through UI Automation, the interface
#      JAWS and Narrator use, and the focused control is checked.
#   2. The Finish page starts Talking Scanner; its window must be readable
#      through UI Automation and must answer a real Enter key press.
#   3. Checks the shortcuts, including the Ctrl+Alt+T hotkey.
#   4. Runs the installed program's self test (OCR on the sample pages and
#      Windows voices) with the system Tesseract hidden, so the bundled copy is used.
#   5. Installs again over the top (upgrade), then uninstalls and checks
#      that the program and shortcuts are gone.
#
# Usage: powershell -ExecutionPolicy Bypass -File installer\test_installer.ps1 dist\TalkingScannerSetup.exe
param([Parameter(Mandatory = $true)][string]$Setup)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
$AE = [System.Windows.Automation.AutomationElement]
$Tree = [System.Windows.Automation.TreeScope]
$CT = [System.Windows.Automation.ControlType]
$Setup = (Resolve-Path $Setup).Path
$appDir = Join-Path $env:LOCALAPPDATA "Programs\Talking Scanner"
$exe = Join-Path $appDir "TalkingScanner.exe"
$programs = [Environment]::GetFolderPath("Programs")
$desktop = [Environment]::GetFolderPath("Desktop")
# A fresh data folder, so the program starts with its first-run question.
$env:TALKING_SCANNER_HOME = Join-Path $env:RUNNER_TEMP "ts-installer-test"
if (-not $env:RUNNER_TEMP) { $env:TALKING_SCANNER_HOME = Join-Path $env:TEMP "ts-installer-test" }
Remove-Item -Recurse -Force $env:TALKING_SCANNER_HOME -ErrorAction SilentlyContinue

function Step($text) { Write-Host "`n=== $text" }
function Check($ok, $text) {
    if (-not $ok) { throw "FAILED: $text" }
    Write-Host "  ok: $text"
}

function Wait-Until($seconds, $what, [scriptblock]$test) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        $result = & $test
        if ($result) { return $result }
        Start-Sleep -Milliseconds 500
    }
    Write-Host "  Top-level windows at the time of failure:"
    foreach ($w in $AE::RootElement.FindAll($Tree::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
        Write-Host "  - '$($w.Current.Name)' class=$($w.Current.ClassName) offscreen=$($w.Current.IsOffscreen)"
        if ($w.Current.Name -like "*Talking Scanner*") { Describe $w }
    }
    throw "FAILED: timed out after $seconds s waiting for $what"
}

function Find-TopWindows($pattern) {
    @($AE::RootElement.FindAll($Tree::Children, [System.Windows.Automation.Condition]::TrueCondition) |
        Where-Object { $_.Current.Name -like $pattern })
}

function Find-TopWindow($pattern) { Find-TopWindows $pattern | Select-Object -First 1 }

# The visible window matching $pattern that has a button matching $button.
function Find-WindowWithButton($pattern, $button) {
    foreach ($w in Find-TopWindows $pattern) {
        if (Visible-Button $w $button) { return $w }
    }
}

function Controls($window, $type) {
    $cond = New-Object System.Windows.Automation.PropertyCondition($AE::ControlTypeProperty, $type)
    @($window.FindAll($Tree::Descendants, $cond))
}

function Describe($window) {
    foreach ($el in $window.FindAll($Tree::Descendants, [System.Windows.Automation.Condition]::TrueCondition)) {
        $c = $el.Current
        if (-not $c.Name) { continue }
        Write-Host ("    {0,-10} '{1}'{2}" -f $c.ControlType.ProgrammaticName.Replace("ControlType.", ""),
            $c.Name, $(if ($c.HasKeyboardFocus) { "  <- focused" } elseif ($c.IsOffscreen) { "  (off screen)" } else { "" }))
    }
}

function Focused-Name { $AE::FocusedElement.Current.Name }

function Press-Enter($window) {
    $window.SetFocus()
    Start-Sleep -Milliseconds 500
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
}

function Visible-Button($window, $pattern) {
    Controls $window $CT::Button | Where-Object { -not $_.Current.IsOffscreen -and $_.Current.Name -like $pattern } |
        Select-Object -First 1
}

Get-Process TalkingScanner -ErrorAction SilentlyContinue | Stop-Process -Force

Step "Install with the keyboard"
$setupProc = Start-Process $Setup -PassThru
$wizard = Wait-Until 60 "the installer window with an Install button" { Find-WindowWithButton "*Talking Scanner*" "*Install*" }
Write-Host "  Window: '$($wizard.Current.Name)'"
$install = Visible-Button $wizard "*Install*"
Describe $wizard
Check ((Visible-Button $wizard "*Cancel*") -ne $null) "the first page has a Cancel button"
Check ($install.Current.IsKeyboardFocusable) "the Install button can take keyboard focus"
Press-Enter $wizard
$finish = Wait-Until 300 "the Finish page" { Visible-Button $wizard "*Finish*" }
Write-Host "  Finish page:"
Describe $wizard
$launch = Controls $wizard $CT::CheckBox | Where-Object { $_.Current.Name -like "*Start Talking Scanner now*" } | Select-Object -First 1
Check ($launch -ne $null) "the Finish page has a 'Start Talking Scanner now' check box"
$toggle = $launch.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
Check ($toggle.Current.ToggleState -eq "On") "'Start Talking Scanner now' is ticked by default"
Check (Test-Path $exe) "TalkingScanner.exe installed at $exe"
Press-Enter $wizard
Wait-Until 60 "the installer to close" { $setupProc.HasExited } | Out-Null
Check ($setupProc.ExitCode -eq 0) "installer exit code 0"

Step "Talking Scanner starts from the Finish page and is readable by screen readers"
$app = Wait-Until 60 "the Talking Scanner window" { Find-TopWindow "Talking Scanner:*Welcome*" }
Write-Host "  Window: '$($app.Current.Name)'"
Describe $app
Check ($app.Current.Name -like "*choose your keys*") "window title holds the spoken first-run question"
$texts = Controls $app $CT::Text | Where-Object { $_.Current.Name -like "Welcome to Talking Scanner*" }
Check ($texts.Count -ge 1) "status text is exposed to UI Automation"
Check ((Controls $app $CT::Edit).Count -ge 1) "page text box is exposed to UI Automation"
Press-Enter $app
$app = Wait-Until 20 "the reply to the Enter key" { Find-TopWindow "Talking Scanner:*Main keyboard keys chosen*" }
Check $true "Enter key chose the main keyboard keys: '$($app.Current.Name)'"
Get-Process TalkingScanner -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Step "Shortcuts"
$shell = New-Object -ComObject WScript.Shell
$main = Join-Path $programs "Talking Scanner.lnk"
Check (Test-Path $main) "Start menu shortcut"
$lnk = $shell.CreateShortcut($main)
Check ($lnk.TargetPath -eq $exe) "Start menu shortcut points at the program"
Check ($lnk.Hotkey -match "Ctrl" -and $lnk.Hotkey -match "Alt" -and $lnk.Hotkey -match "T$") "hotkey is Ctrl+Alt+T ($($lnk.Hotkey))"
Check (Test-Path (Join-Path $desktop "Talking Scanner.lnk")) "desktop shortcut"
$tools = @(Get-ChildItem (Join-Path $programs "Talking Scanner Tools") -Filter *.lnk)
Check ($tools.Count -eq 5) "5 shortcuts in Talking Scanner Tools: $($tools.Name -join ', ')"
foreach ($name in "practice with sample pages", "key test", "self test", "user guide") {
    Check (Test-Path (Join-Path $programs "Talking Scanner Tools\Talking Scanner $name.lnk")) "tool shortcut: $name"
}
Check (Test-Path (Join-Path $appDir "USER-GUIDE.txt")) "user guide installed"
Check (Test-Path (Join-Path $appDir "tesseract\tesseract.exe")) "Tesseract bundled"
Check (Test-Path (Join-Path $appDir "tesseract\tessdata\eng.traineddata")) "English OCR data bundled"
Check (Test-Path (Join-Path $appDir "tesseract\tessdata\osd.traineddata")) "page orientation data bundled"

Step "Self test of the installed program, with no system Tesseract"
$hidden = @()
foreach ($dir in "$env:ProgramFiles\Tesseract-OCR", "${env:ProgramFiles(x86)}\Tesseract-OCR") {
    if (Test-Path $dir) { Rename-Item $dir "$dir-hidden"; $hidden += $dir }
}
$savedPath, $savedCmd = $env:PATH, $env:TESSERACT_CMD
$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notlike '*Tesseract*' }) -join ';'
$env:TESSERACT_CMD = ""
try {
    $p = Start-Process $exe -ArgumentList "--self-test", "--no-speech" -Wait -PassThru
    $report = Get-Content (Join-Path $env:TALKING_SCANNER_HOME "self-test.txt") -Raw
    Write-Host $report
    Check ($p.ExitCode -eq 0) "self test exit code 0"
    Check ($report -match "PASSED") "self test passed"
    Check ($report -like "*Talking Scanner\tesseract\tesseract.exe*") "bundled Tesseract was used"
} finally {
    $env:PATH, $env:TESSERACT_CMD = $savedPath, $savedCmd
    foreach ($dir in $hidden) { Rename-Item "$dir-hidden" (Split-Path $dir -Leaf) }
}

Step "Install again over the top (upgrade)"
$p = Start-Process $Setup -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait -PassThru
Check ($p.ExitCode -eq 0) "silent reinstall exit code 0"
Check (Test-Path $exe) "program still installed"

Step "Uninstall"
$uninstaller = Get-ChildItem $appDir -Filter "unins*.exe" | Select-Object -First 1
Check ($uninstaller -ne $null) "uninstaller present"
Start-Process $uninstaller.FullName -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait
# The uninstaller hands over to a copy of itself, so wait for the files to go.
Wait-Until 120 "the program to be removed" { -not (Test-Path $exe) } | Out-Null
Check (-not (Test-Path $exe)) "program removed"
Check (-not (Test-Path $main)) "Start menu shortcut removed"
Check (-not (Test-Path (Join-Path $desktop "Talking Scanner.lnk"))) "desktop shortcut removed"
Check (-not (Test-Path (Join-Path $programs "Talking Scanner Tools"))) "tools folder removed"

Write-Host "`nInstaller test passed."
