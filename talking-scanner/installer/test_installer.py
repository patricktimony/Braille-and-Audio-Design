"""Tests the real installer the way a keyboard and screen reader user meets it.

Uses Windows' native UI Automation (the interface Narrator uses; JAWS reads
the same controls), through the `uiautomation` package:

  1. Starts TalkingScannerSetup.exe and installs by pressing Enter only.
     Every control on each page is listed with its type and name, and the
     focused control is checked.
  2. The Finish page starts Talking Scanner.  Its window must be readable
     through UI Automation and must answer a real Enter key press.
  3. Checks the shortcuts, including the Ctrl+Alt+T hotkey.
  4. Runs the installed program's self test (OCR on the sample pages and the
     Windows voice) with the system Tesseract hidden, so the bundled copy is used.
  5. Installs again over the top (upgrade), then uninstalls and checks that
     the program and its shortcuts are gone.

Usage (Windows, do not touch the keyboard while it runs):
    py -m pip install uiautomation
    py installer\\test_installer.py dist\\TalkingScannerSetup.exe
"""

import os
import shutil
import subprocess
import sys
import tempfile
import time

import uiautomation as auto
import win32com.client

SETUP = os.path.abspath(sys.argv[1])
APP_DIR = os.path.join(os.environ["LOCALAPPDATA"], "Programs", "Talking Scanner")
EXE = os.path.join(APP_DIR, "TalkingScanner.exe")
SHELL = win32com.client.Dispatch("WScript.Shell")
PROGRAMS = SHELL.SpecialFolders("Programs")
DESKTOP = SHELL.SpecialFolders("Desktop")
MAIN_LNK = os.path.join(PROGRAMS, "Talking Scanner.lnk")
TOOLS = os.path.join(PROGRAMS, "Talking Scanner Tools")
DESKTOP_LNK = os.path.join(DESKTOP, "Talking Scanner.lnk")


def step(text):
    print(f"\n=== {text}", flush=True)


def check(ok, text):
    if not ok:
        raise SystemExit(f"FAILED: {text}")
    print(f"  ok: {text}", flush=True)


def wait_until(seconds, what, test):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = test()
        if result:
            return result
        time.sleep(0.5)
    print("  Top-level windows at the time of failure:")
    for w in auto.GetRootControl().GetChildren():
        print(f"  - {w.ControlTypeName} '{w.Name}' class={w.ClassName}")
        if "Talking Scanner" in w.Name:
            describe(w)
    raise SystemExit(f"FAILED: timed out after {seconds} s waiting for {what}")


def describe(window):
    """Print every named control, as a screen reader would find them."""
    for control, depth in auto.WalkControl(window, maxDepth=6):
        if control.Name:
            focus = "  <- focused" if control.HasKeyboardFocus else ""
            print(f"    {'  ' * depth}{control.ControlTypeName:<20} '{control.Name}'{focus}", flush=True)


def find(window, control_type, name_part):
    for control, _ in auto.WalkControl(window, maxDepth=6):
        if control.ControlTypeName == control_type and name_part in control.Name and not control.IsOffscreen:
            return control
    return None


def top_window(name_part=None, class_name=None):
    for w in auto.GetRootControl().GetChildren():
        if (class_name is None or w.ClassName == class_name) and (name_part is None or name_part in w.Name):
            return w
    return None


def press_enter(window):
    window.SetActive()
    window.SetFocus()
    time.sleep(0.5)
    auto.SendKeys("{Enter}", waitTime=0.5)


def kill_app():
    subprocess.run(["taskkill", "/F", "/IM", "TalkingScanner.exe"], capture_output=True)
    time.sleep(2)


def main():
    home = os.path.join(tempfile.gettempdir(), "ts-installer-test")
    shutil.rmtree(home, ignore_errors=True)
    os.environ["TALKING_SCANNER_HOME"] = home  # first-run question appears
    kill_app()

    step("Install with the keyboard only")
    setup_log = os.path.join(tempfile.gettempdir(), "ts-setup.log")
    if os.path.exists(setup_log):
        os.remove(setup_log)
    speech_files = os.path.join(tempfile.gettempdir(), "ts-installer-speech-")
    for i in range(1, 6):
        if os.path.exists(f"{speech_files}{i}.wav"):
            os.remove(f"{speech_files}{i}.wav")
    # No speakers here: the installer's voice goes into speech-1.wav, -2.wav, ...
    setup = subprocess.Popen([SETUP, f"/LOG={setup_log}"],
                             env=dict(os.environ, TALKING_SCANNER_SPEECH_TEST=speech_files))
    wizard = wait_until(60, "the installer window", lambda: top_window(class_name="TWizardForm"))
    install = wait_until(30, "an Install button", lambda: find(wizard, "ButtonControl", "Install"))
    print(f"  Window: '{wizard.Name}'")
    describe(wizard)
    check(wizard.Name == "Install Talking Scanner", "window title is 'Install Talking Scanner'")
    check(find(wizard, "TextControl", "Press Enter to install") is not None, "page says 'Press Enter to install'")
    check(find(wizard, "ButtonControl", "Cancel") is not None, "Cancel is a button")
    check(install.HasKeyboardFocus, "keyboard focus starts on the Install button")
    press_enter(wizard)

    finish = wait_until(300, "the Finish page", lambda: find(wizard, "ButtonControl", "Finish"))
    print("  Finish page:")
    describe(wizard)
    check(find(wizard, "TextControl", "Control plus Alt plus T") is not None, "page tells you Control plus Alt plus T")
    launch = None
    for control, _ in auto.WalkControl(wizard, maxDepth=6):
        if "Start Talking Scanner now" in control.Name:
            launch = control
    check(launch is not None, f"'Start Talking Scanner now' is readable ({launch and launch.ControlTypeName})")
    try:
        state = launch.GetTogglePattern().ToggleState
    except Exception:
        state = launch.GetLegacyIAccessiblePattern().State & 0x10  # STATE_SYSTEM_CHECKED
    check(state, "'Start Talking Scanner now' is ticked by default")
    focused = auto.GetFocusedControl()
    check(focused.ControlTypeName in ("CheckBoxControl", "ButtonControl"),
          f"keyboard focus is on '{focused.Name}' ({focused.ControlTypeName}); Enter presses Finish")
    check(find(wizard, "TextControl", "Click Finish") is None, "no 'Click Finish' wording")
    check(os.path.isfile(EXE), f"TalkingScanner.exe installed at {EXE}")
    press_enter(wizard)
    check(setup.wait(60) == 0, "installer finished with exit code 0")
    spoken = [line.split("Speech: ", 1)[1].strip() for line in open(setup_log, encoding="utf-8", errors="replace")
              if "Speech: " in line]
    print("  Installer speech log:")
    for line in spoken:
        print(f"    {line}")
    for words in ("Press Enter to install", "Installing Talking Scanner", "Press Enter to finish"):
        check(any(words in line for line in spoken), f"installer speaks '{words}'")
    # No screen reader runs here, so the installer must speak every step.
    check(spoken.count("spoken") == 3, f"installer spoke all 3 steps ({spoken.count('spoken')})")
    for i in (1, 2, 3):
        size = os.path.getsize(f"{speech_files}{i}.wav") if os.path.exists(f"{speech_files}{i}.wav") else 0
        check(size > 5000, f"step {i} produced {size} bytes of speech")

    step("Talking Scanner starts from the Finish page and is readable by screen readers")
    app = wait_until(60, "the Talking Scanner window", lambda: top_window("Welcome to Talking Scanner"))
    print(f"  Window: '{app.Name}'")
    describe(app)
    check("choose your keys" in app.Name, "window title holds the spoken first-run question")
    check(find(app, "TextControl", "Welcome to Talking Scanner") is not None, "status line is readable text")
    check(find(app, "EditControl", "") is not None, "page text box is readable")
    press_enter(app)
    # SendKeys may send Enter as number pad Enter; either way a layout is chosen.
    app = wait_until(20, "the reply to the Enter key", lambda: top_window("keys chosen"))
    check(True, f"Enter chose the keys: '{app.Name[:80]}...'")
    kill_app()

    step("Shortcuts")
    check(os.path.isfile(MAIN_LNK), "Start menu shortcut")
    lnk = SHELL.CreateShortcut(MAIN_LNK)
    check(os.path.normcase(lnk.TargetPath) == os.path.normcase(EXE), "Start menu shortcut starts the program")
    check(lnk.Hotkey.replace(" ", "").lower() in ("alt+ctrl+t", "ctrl+alt+t"), f"hotkey is Ctrl+Alt+T ({lnk.Hotkey})")
    check(os.path.isfile(DESKTOP_LNK), "desktop shortcut")
    tools = sorted(os.listdir(TOOLS))
    check(len(tools) == 5, f"5 shortcuts in Talking Scanner Tools: {', '.join(tools)}")
    for name in ("practice with sample pages", "key test", "self test", "user guide"):
        check(os.path.isfile(os.path.join(TOOLS, f"Talking Scanner {name}.lnk")), f"tool shortcut: {name}")
    for rel in ("USER-GUIDE.txt", r"tesseract\tesseract.exe", r"tesseract\tessdata\eng.traineddata",
                r"tesseract\tessdata\osd.traineddata", r"samples\page1.png"):
        check(os.path.isfile(os.path.join(APP_DIR, rel)), f"installed: {rel}")

    step("Self test of the installed program, with no system Tesseract")
    hidden = []
    for root in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")):
        d = root and os.path.join(root, "Tesseract-OCR")
        if d and os.path.isdir(d):
            os.rename(d, d + "-hidden")
            hidden.append(d)
    env = dict(os.environ, TESSERACT_CMD="",
               PATH=";".join(p for p in os.environ["PATH"].split(";") if "tesseract" not in p.lower()))
    try:
        code = subprocess.run([EXE, "--self-test", "--no-speech"], env=env, timeout=300).returncode
        report = open(os.path.join(home, "self-test.txt"), encoding="utf-8").read()
        print(report)
        check(code == 0, "self test exit code 0")
        check("PASSED" in report, "self test passed")
        check(r"Talking Scanner\tesseract\tesseract.exe" in report, "bundled Tesseract was used")
    finally:
        for d in hidden:
            os.rename(d + "-hidden", d)

    step("Install again over the top (upgrade)")
    code = subprocess.run([SETUP, "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], timeout=300).returncode
    check(code == 0, "silent reinstall exit code 0")
    check(os.path.isfile(EXE), "program still installed")

    step("Uninstall")
    uninstallers = [f for f in os.listdir(APP_DIR) if f.lower().startswith("unins") and f.lower().endswith(".exe")]
    check(bool(uninstallers), "uninstaller present")
    subprocess.run([os.path.join(APP_DIR, uninstallers[0]), "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"],
                   timeout=300)
    # The uninstaller hands over to a copy of itself, so wait for the files to go.
    wait_until(120, "the program to be removed", lambda: not os.path.exists(EXE))
    check(not os.path.exists(EXE), "program removed")
    check(not os.path.exists(MAIN_LNK), "Start menu shortcut removed")
    check(not os.path.exists(DESKTOP_LNK), "desktop shortcut removed")
    check(not os.path.exists(TOOLS), "tools folder removed")
    print("\nInstaller test passed.")


if __name__ == "__main__":
    main()
