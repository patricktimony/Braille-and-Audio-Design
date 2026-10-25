; Talking Scanner installer (Inno Setup 6).
; Built by build_windows.ps1:  ISCC /DAppVersion=0.2.0 /DSourceDir=..\dist\TalkingScanner TalkingScanner.iss
;
; Kept as short as possible for screen reader users: one "Install" page and
; one "Finish" page, both made of standard Windows controls that JAWS and
; Narrator read.  Installs for the current user only, so no administrator
; (UAC) prompt appears.  Nothing is added to Windows startup.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\dist\TalkingScanner"
#endif

[Setup]
AppId={{6C1E3A52-2F7B-4F0B-9C55-7A3D2B8E4F10}
AppName=Talking Scanner
AppVersion={#AppVersion}
AppVerName=Talking Scanner {#AppVersion}
AppPublisher=Braille and Audio Design
AppPublisherURL=https://github.com/patricktimony/Braille-and-Audio-Design
DefaultDirName={autopf}\Talking Scanner
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
DisableWelcomePage=yes
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyMemo=yes
CloseApplications=yes
UninstallDisplayName=Talking Scanner
UninstallDisplayIcon={app}\TalkingScanner.exe
OutputDir=..\dist
OutputBaseFilename=TalkingScannerSetup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120

[Messages]
SetupWindowTitle=Install Talking Scanner
ReadyLabel1=Talking Scanner is ready to install.
ReadyLabel2b=Press Enter to install. Installing takes about one minute.
FinishedHeadingLabel=Talking Scanner is installed
FinishedLabelNoIcons=Talking Scanner is installed.
ClickFinish=
FinishedLabel=Talking Scanner is installed. To start it at any time, press Control plus Alt plus T. Or press the Windows key, type Talking Scanner, and press Enter. Press Enter now to finish.

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; Ctrl+Alt+T starts the program from anywhere.
Name: "{autoprograms}\Talking Scanner"; Filename: "{app}\TalkingScanner.exe"; WorkingDir: "{app}"; HotKey: ctrl+alt+t; Comment: "Scan a page and hear it read aloud"
Name: "{autodesktop}\Talking Scanner"; Filename: "{app}\TalkingScanner.exe"; WorkingDir: "{app}"; Comment: "Scan a page and hear it read aloud"
Name: "{autoprograms}\Talking Scanner Tools\Talking Scanner practice with sample pages"; Filename: "{app}\TalkingScanner.exe"; Parameters: "--practice"; WorkingDir: "{app}"
Name: "{autoprograms}\Talking Scanner Tools\Talking Scanner key test"; Filename: "{app}\TalkingScanner.exe"; Parameters: "--key-test"; WorkingDir: "{app}"
Name: "{autoprograms}\Talking Scanner Tools\Talking Scanner self test"; Filename: "{app}\TalkingScanner.exe"; Parameters: "--self-test"; WorkingDir: "{app}"
Name: "{autoprograms}\Talking Scanner Tools\Talking Scanner user guide"; Filename: "{app}\USER-GUIDE.txt"
Name: "{autoprograms}\Talking Scanner Tools\Uninstall Talking Scanner"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\TalkingScanner.exe"; Description: "Start Talking Scanner now"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Private scan sessions only.  Saved books and settings are kept.
Type: filesandordirs; Name: "{localappdata}\TalkingScanner\sessions"

[Code]
// The installer speaks each step with the Windows voice, so a blind person
// can install without a screen reader.  When a screen reader (JAWS, NVDA,
// Narrator) is running it reads the pages itself, so the installer stays
// quiet rather than talking over it.  Every spoken line is also written to
// the setup log (/LOG), which the automated installer test checks.
const
  SPI_GETSCREENREADER = $0046;
  SVSF_ASYNC_PURGE = 3;  // speak in the background, interrupting earlier speech

function SystemParametersInfo(uiAction, uiParam: Cardinal; var pvParam: Integer; fWinIni: Cardinal): Integer;
  external 'SystemParametersInfoW@user32.dll stdcall';

var
  Voice: Variant;
  HaveVoice: Boolean;

function ScreenReaderRunning: Boolean;
var
  Flag: Integer;
begin
  Flag := 0;
  Result := (SystemParametersInfo(SPI_GETSCREENREADER, 0, Flag, 0) <> 0) and (Flag <> 0);
end;

procedure Say(Text: String);
begin
  Log('Speech: ' + Text);
  if WizardSilent then
    exit;
  if ScreenReaderRunning then begin
    Log('Speech: not spoken, a screen reader is running');
    exit;
  end;
  try
    if not HaveVoice then begin
      Voice := CreateOleObject('SAPI.SpVoice');
      HaveVoice := True;
    end;
    Voice.Speak(Text, SVSF_ASYNC_PURGE);
    Log('Speech: spoken');
  except
    Log('Speech: could not speak: ' + GetExceptionMessage);
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  case CurPageID of
    wpReady:
      Say('Talking Scanner installer. Press Enter to install. Press Escape to cancel.');
    wpInstalling:
      Say('Installing Talking Scanner. Please wait.');
    wpFinished:
      Say('Talking Scanner is installed. Press Enter to finish, and Talking Scanner will start. ' +
          'Later, press Control plus Alt plus T to start it again.');
  end;
end;
