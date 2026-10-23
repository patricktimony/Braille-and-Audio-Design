using ScanReader.Core;

namespace ScanReader;

/// <summary>
/// Starts the reader.
///   ScanReader.exe                                   normal use
///   ScanReader.exe --check                           helper's read-only system check (no scanning)
///   ScanReader.exe --simulate-scanner "C:\images"    test without a scanner (see FolderScanner)
/// </summary>
internal static class Program
{
    private const string MutexName = @"Local\ScanReader.SingleInstance";
    private const string ActivateEventName = @"Local\ScanReader.Activate";

    [STAThread]
    private static int Main(string[] args)
    {
        var log = new FileLog(AppPaths.LogFile);
        log.Info($"Scan Reader {typeof(Program).Assembly.GetName().Version} starting. Arguments: {string.Join(' ', args)}");

        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var settings = ReaderSettings.LoadOrCreate(AppPaths.SettingsFile, log);

        if (args.Contains("--check", StringComparer.OrdinalIgnoreCase))
            return Diagnostics.Run(settings, log);

        // Only one copy at a time: two copies would fight over the scanner and talk over each other.
        using var mutex = new Mutex(initiallyOwned: true, MutexName, out bool firstInstance);
        if (!firstInstance)
        {
            try
            {
                using var activate = EventWaitHandle.OpenExisting(ActivateEventName);
                activate.Set();
            }
            catch (Exception ex)
            {
                log.Error("Second copy could not signal the first one.", ex);
            }
            return 0;
        }

        IScanner scanner = new WiaScanner(settings, log);
        int simIndex = Array.FindIndex(args, a => a.Equals("--simulate-scanner", StringComparison.OrdinalIgnoreCase));
        if (simIndex >= 0 && simIndex + 1 < args.Length)
        {
            scanner = new FolderScanner(args[simIndex + 1], log);
            log.Info("SIMULATION MODE: images from " + args[simIndex + 1]);
        }

        Application.ThreadException += (_, e) => log.Error("Unhandled UI error.", e.Exception);
        AppDomain.CurrentDomain.UnhandledException += (_, e) => log.Error("Unhandled error.", e.ExceptionObject as Exception);

        using var form = new MainForm(settings, scanner, log);
        using var activateEvent = new EventWaitHandle(false, EventResetMode.AutoReset, ActivateEventName);
        var waiter = new Thread(() =>
        {
            while (activateEvent.WaitOne())
            {
                if (form.IsDisposed) return;
                try { form.BeginInvoke(form.BringToFrontFromSecondInstance); }
                catch (InvalidOperationException) { return; }
            }
        })
        { IsBackground = true, Name = "Second-copy listener" };
        waiter.Start();

        Application.Run(form);
        log.Info("Scan Reader closed.");
        return 0;
    }
}
