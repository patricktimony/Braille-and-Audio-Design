# Opening Peer Tech Help from the MorphicBar

Peer Tech Help does not depend on Morphic and does not change Morphic. Morphic can add a
button to its toolbar that opens the site in the person's default web browser.

## What Morphic supports (from reading its source code)

Morphic has **no plugin API**. Its source does support two ways to add a button that opens a web page.
Both use Morphic's existing `link` button type.

Checked against `raisingthefloor/morphic-windows` (commit `befc4e4`, October 2026) and
`raisingthefloor/morphic-macos` (commit `6dba890`, October 2026).

### 1. `config.json` extra items: recommended, no Morphic changes

Morphic reads an optional, administrator-managed configuration file at start-up:

| System  | File location |
|---------|---------------|
| Windows | `C:\ProgramData\Morphic\config.json` |
| macOS   | `/Library/Application Support/Morphic/config.json` |

The file must have `"version": 0`. Under `morphicBar.extraItems` you can list **up to three** extra buttons. A
`"type": "link"` item needs a `label` and a `url`, and may have `tooltipHeader` and `tooltipText`.
Morphic only accepts `http` and `https` addresses for link buttons, and opens them in the default browser.
Screen readers use the `label` as the button name.

Source references:
- Windows: `Morphic.Client/App.xaml.cs` (reads `config.json`, checks `version`, and takes the first 3 `extraItems`),
  `Morphic.Client/Bar/Data/BarData.cs` (adds extra items to the basic MorphicBar),
  `Morphic.Client/Bar/Data/Actions/WebAction.cs` (opens the URL with the shell; http/https only).
- macOS: `Morphic/Morphic/AppDelegate.swift` (`config.json` under the system Application Support folder,
  `morphicBar.extraItems`), `Morphic/Morphic/MorphicBar/MorphicBarWindow.swift` (adds them to the basic bar).

Files in this folder:
- [`config.json`](config.json): one "Tech Help" button that opens the home page.
- [`config-three-buttons.json`](config-three-buttons.json): three buttons, "Get Help", "Help Someone", and
  "My Instructions", that go straight to each page.

To install:
1. Deploy Peer Tech Help (see the main README) and note its HTTPS address.
2. Replace `https://YOUR-DEPLOYMENT.example.org/` in the chosen file with that address.
3. Copy the file to the location above and name it `config.json`. Writing to that folder needs
   administrator rights. It is intended for IT staff and for deployment tools such as Intune or Jamf.
   **If a `config.json` already exists, merge the `morphicBar.extraItems` entry into it**, because it may hold
   other organisation settings.
4. Restart Morphic. The button(s) appear on the left of the basic MorphicBar.

Limitations:
- On both Windows and macOS, extra items appear on the **basic** MorphicBar, not on a custom bar.
- There is a maximum of three extra items, and these may be shared with other organisation buttons.
- Morphic only shows a warning in its log when the file is invalid. Check the JSON with any JSON validator first.

### 2. Custom MorphicBar link button: per person

Morphic's custom bars (the `customMorphicBars` feature) are built in Morphic's web-based bar editor. They are
stored as bar JSON in which a button has `"kind": "link"` and `configuration.url` (see
`Morphic.Client/Bar/BarData.md`). Where a person or organisation uses custom bars, add a link button whose
address is the Peer Tech Help site. No files need editing. I have not tested the editor's interface
itself, so follow Morphic's own instructions for adding a web link button.

## Later, deeper integration (not built)

These ideas need nothing from Morphic beyond what already exists:
- Pass a source marker in the URL, for example `index.html?from=morphic`, to measure use without tracking people.
- Once the site has real accounts, Morphic's sign-in could be offered as one way to log in. That would need
  agreement with the Morphic team and is out of scope for this prototype.
