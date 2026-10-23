using System.Drawing;
using System.Runtime.InteropServices;
using ScanReader.Core;

namespace ScanReader;

/// <summary>
/// The only window. It has no buttons, menus or text boxes: every key goes
/// straight to the reader. The large text is for sighted helpers (and any
/// remaining sight): what was last said, the page number, and the current line.
/// </summary>
internal sealed class MainForm : Form
{
    private const int WmHotkey = 0x0312;
    private const int HotkeyIdF5 = 1;
    private const uint ModNoRepeat = 0x4000;
    private const uint VkF5 = 0x74;

    private readonly ReaderSettings settings;
    private readonly ILog log;
    private readonly IScanner scanner;
    private readonly Label statusLabel = MakeLabel(28f, Color.White);
    private readonly Label pageLabel = MakeLabel(22f, Color.Gold);
    private readonly Label lineLabel = MakeLabel(36f, Color.White);
    private readonly Label warningLabel = MakeLabel(20f, Color.OrangeRed);
    private readonly Label keysLabel = MakeLabel(12f, Color.Silver);
    private SapiSpeech? speech;
    private ReaderController? controller;
    private bool hotkeyRegistered;

    public MainForm(ReaderSettings settings, IScanner scanner, ILog log)
    {
        this.settings = settings;
        this.scanner = scanner;
        this.log = log;

        Text = "Scan Reader";
        BackColor = Color.Black;
        WindowState = FormWindowState.Maximized;
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(640, 480);
        TopMost = settings.AlwaysOnTop;

        keysLabel.Text =
            "F5 or Enter: scan   |   Space: play / pause   |   Left / Right: word   |   Up / Down: line   |   " +
            "Page Up / Page Down: page   |   Esc: stop   |   - / +: speed   |   Ctrl+N: new document   |   F1: help";
        warningLabel.Visible = false;
        lineLabel.AutoSize = false; // fills the remaining space and wraps long lines

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 5,
            Padding = new Padding(40),
            BackColor = Color.Black,
        };
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.Controls.Add(warningLabel, 0, 0);
        layout.Controls.Add(statusLabel, 0, 1);
        layout.Controls.Add(pageLabel, 0, 2);
        layout.Controls.Add(lineLabel, 0, 3);
        layout.Controls.Add(keysLabel, 0, 4);
        Controls.Add(layout);
    }

    protected override async void OnShown(EventArgs e)
    {
        base.OnShown(e);
        try
        {
            // Speech is created only now, once the window exists, so its events can reach this thread.
            speech = new SapiSpeech(this, settings.VoiceName, settings.OcrLanguage, log);
            var docsRoot = AppPaths.DocumentsRoot(settings);
            controller = new ReaderController(
                scanner,
                new WindowsOcrRecognizer(settings, log),
                speech,
                new DocumentStore(docsRoot, () => DateTime.Now),
                new StateStore(AppPaths.StateFile, log),
                settings,
                log);
            controller.Changed += RefreshView;

            if (settings.F5WorksFromAnyWindow)
            {
                hotkeyRegistered = RegisterHotKey(Handle, HotkeyIdF5, ModNoRepeat, VkF5);
                if (!hotkeyRegistered) log.Info("F5 could not be registered for use from other windows; it works only in this window.");
            }

            Activate();
            await controller.StartAsync();
        }
        catch (Exception ex)
        {
            log.Error("Startup failed.", ex);
            statusLabel.Text = Messages.UnexpectedError + "\n" + ex.Message;
            speech?.Say(Messages.UnexpectedError);
        }
    }

    /// <summary>Called when a second copy of the program was started.</summary>
    public void BringToFrontFromSecondInstance()
    {
        BringToFront(announce: true);
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        var command = MapKey(keyData);
        if (command == null) return base.ProcessCmdKey(ref msg, keyData);

        bool isRepeat = (msg.LParam.ToInt64() & 0x40000000) != 0;
        if (isRepeat && command is ReaderCommand.Scan or ReaderCommand.PlayPause or ReaderCommand.NewDocument
                or ReaderCommand.Help or ReaderCommand.Stop or ReaderCommand.UnknownKey)
            return true; // holding a key down must not start ten scans

        Run(command.Value);
        return true;
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmHotkey && m.WParam.ToInt32() == HotkeyIdF5)
        {
            if (ActiveForm == this && WindowState != FormWindowState.Minimized) Run(ReaderCommand.Scan);
            else BringToFront(announce: true);
            return;
        }
        base.WndProc(ref m);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        try
        {
            if (hotkeyRegistered) UnregisterHotKey(Handle, HotkeyIdF5);
            controller?.Shutdown();
            speech?.SayAndWait(Messages.Goodbye);
            speech?.Dispose();
        }
        catch (Exception ex)
        {
            log.Error("Error while closing.", ex);
        }
        base.OnFormClosing(e);
    }

    private static ReaderCommand? MapKey(Keys keyData)
    {
        var key = keyData & Keys.KeyCode;
        var mods = keyData & Keys.Modifiers;

        if (mods == Keys.Control && key == Keys.N) return ReaderCommand.NewDocument;
        if (mods is Keys.Shift or Keys.None)
        {
            switch (key)
            {
                case Keys.OemMinus or Keys.Subtract: return ReaderCommand.Slower;
                case Keys.Oemplus or Keys.Add: return ReaderCommand.Faster;
            }
        }
        if (mods != Keys.None) return null; // leave Alt+F4, Alt+Tab, Ctrl+... to Windows

        return key switch
        {
            Keys.F5 or Keys.Enter => ReaderCommand.Scan,
            Keys.Space => ReaderCommand.PlayPause,
            Keys.Left => ReaderCommand.PreviousWord,
            Keys.Right => ReaderCommand.NextWord,
            Keys.Up => ReaderCommand.PreviousLine,
            Keys.Down => ReaderCommand.NextLine,
            Keys.PageUp => ReaderCommand.PreviousPage,
            Keys.PageDown => ReaderCommand.NextPage,
            Keys.Escape => ReaderCommand.Stop,
            Keys.F1 => ReaderCommand.Help,
            >= Keys.A and <= Keys.Z or >= Keys.D0 and <= Keys.D9 => ReaderCommand.UnknownKey,
            _ => null,
        };
    }

    private async void Run(ReaderCommand command)
    {
        if (controller == null) return;
        try
        {
            await controller.HandleAsync(command);
        }
        catch (Exception ex)
        {
            log.Error($"Command {command} failed.", ex);
            speech?.Stop();
            speech?.Say(Messages.UnexpectedError);
        }
    }

    private void BringToFront(bool announce)
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Maximized;
        Show();
        Activate();
        SetForegroundWindow(Handle);
        if (announce) controller?.AnnounceBroughtToFront();
    }

    private void RefreshView()
    {
        if (controller == null) return;
        if (InvokeRequired) { BeginInvoke(RefreshView); return; }

        statusLabel.Text = controller.IsBusy ? "Working... " + controller.LastMessage : controller.LastMessage;
        pageLabel.Text = controller.PageCount == 0
            ? "No pages yet"
            : $"Page {controller.CurrentPageNumber} of {controller.PageCount}" + (controller.IsReading ? "  -  reading" : "");
        lineLabel.Text = controller.CurrentLineText;

        var warnings = new List<string>();
        if (!controller.SpeechAvailable) warnings.Add("NO VOICE: Windows has no speech voice, so nothing can be read aloud.");
        if (controller.OcrProblem != null) warnings.Add("NO TEXT RECOGNITION: install the OCR language feature in Windows Settings.");
        warningLabel.Text = string.Join("\n", warnings);
        warningLabel.Visible = warnings.Count > 0;
    }

    private static Label MakeLabel(float size, Color color) => new()
    {
        AutoSize = true,
        Dock = DockStyle.Fill,
        ForeColor = color,
        BackColor = Color.Black,
        Font = new Font("Segoe UI", size, FontStyle.Bold),
        Margin = new Padding(0, 0, 0, 24),
        UseMnemonic = false,
    };

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);
}
