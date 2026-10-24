# Scan Reader

Turns the laptop and the Canon scanner into a reading machine, like a SARA.
She puts a page face down on the scanner and presses **S**, and the page is read aloud.

**With JAWS:** JAWS does all the talking, in her usual voice and speed.
Scan Reader never turns JAWS off and never changes any JAWS setting.
The pages appear in a normal text window, so all her usual JAWS keys work.

**Doing other things:** it's an ordinary window. **Alt+Tab** goes to
other programs, and **Ctrl+Alt+S** comes back. It starts by itself when the
laptop starts.

## Setting it up

1. Put the two files, `ScanReader.ps1` and `Start Scan Reader.cmd`, in a
   folder called `C:\ScanReader`.
2. Double-click **Start Scan Reader.cmd** once.

That's all. From then on there is a **Scan Reader** icon on the desktop,
and it starts by itself when the laptop starts.

Try it on your own computer before putting it on hers.

## Keys

| Key | What it does |
|---|---|
| **S** (or F5, or Enter) | Scan a page and read it |
| **Space** | Start reading / pause |
| **Page Up / Page Down** | Page before / after |
| **Escape** | Stop talking |
| **Control + C** | Copy all pages, to paste into an email |
| **Control + S** | Save all pages as a file on the desktop |
| **Control + N**, twice | Start a new document |
| **F1** | Hear the keys |
| **Alt + Tab** | Go to another program |
| **Control + Alt + S** | Come back to Scan Reader |

Her usual JAWS reading keys (arrows, Say All, Control to stop) also work.
Every page is also saved by itself in **Documents → Scanned Pages**.

## Not yet tested

It hasn't been run on Windows, with the scanner, or with JAWS. Please try it on
your own computer first.
