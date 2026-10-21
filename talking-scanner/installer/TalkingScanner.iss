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
