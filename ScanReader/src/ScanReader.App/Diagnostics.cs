using System.Runtime.InteropServices;
using System.Speech.Synthesis;
using System.Text;
using ScanReader.Core;
using Windows.Media.Ocr;

namespace ScanReader;

/// <summary>
/// "ScanReader.exe --check": a read-only report for the helper. It lists the
/// scanners Windows can see, the installed OCR languages and the speech voices.
/// It does not scan, install, or change anything. The report is shown on screen,
/// spoken in short, and saved to Documents\Scan Reader check.txt.
/// </summary>
internal static class Diagnostics
{
    public static int Run(ReaderSettings settings, ILog log)
    {
        var report = new StringBuilder();
        var spoken = new List<string>();
        void Line(string s) => report.AppendLine(s);

        Line($"Scan Reader check - {DateTime.Now:yyyy-MM-dd HH:mm}");
        Line($"Windows: {Environment.OSVersion.VersionString} ({RuntimeInformation.OSArchitecture}); program: {RuntimeInformation.ProcessArchitecture}");
        Line($".NET: {RuntimeInformation.FrameworkDescription}");
        Line($"Settings: {AppPaths.SettingsFile}");
        Line($"Documents saved to: {AppPaths.DocumentsRoot(settings)}");
        Line("");

        // ---- scanner (WIA) ----
        Line("SCANNER (Windows Image Acquisition)");
        var scanners = RunSta(ListScanners) ?? new ScannerList([], "The scanner check did not finish within 30 seconds.");
        if (scanners.Error != null) { Line("  PROBLEM: " + scanners.Error); spoken.Add("Scanner check failed."); }
        else if (scanners.Names.Count == 0) { Line("  PROBLEM: no scanner found. Is it plugged in?"); spoken.Add("No scanner found."); }
        else { foreach (var n in scanners.Names) Line("  found: " + n); spoken.Add("Scanner found."); }
        Line("");

        // ---- OCR ----
        Line("TEXT RECOGNITION (Windows.Media.Ocr)");
        try
        {
            var langs = OcrEngine.AvailableRecognizerLanguages;
            if (langs.Count == 0) { Line("  PROBLEM: no OCR language installed."); spoken.Add("Text recognition is not installed."); }
            foreach (var l in langs) Line($"  installed: {l.LanguageTag} ({l.DisplayName})");
            var engine = OcrEngine.TryCreateFromUserProfileLanguages();
            Line(engine == null
                ? "  NOTE: none of the user's Windows languages has OCR; the first installed one will be used."
                : $"  will use: {engine.RecognizerLanguage.LanguageTag}");
            Line($"  largest image side: {OcrEngine.MaxImageDimension} pixels");
            if (langs.Count > 0) spoken.Add("Text recognition is installed.");
        }
        catch (Exception ex)
        {
            Line("  PROBLEM: OCR component could not be used: " + ex.Message);
            spoken.Add("Text recognition is not working.");
        }
        Line("");

        // ---- voices ----
        Line("VOICES (SAPI 5 / System.Speech)");
        using var synth = new SpeechSynthesizer();
        try
        {
            var voices = synth.GetInstalledVoices();
            if (!voices.Any(v => v.Enabled)) { Line("  PROBLEM: no enabled voice."); }
            foreach (var v in voices)
                Line($"  {(v.Enabled ? "enabled " : "disabled")}: {v.VoiceInfo.Name} ({v.VoiceInfo.Culture.Name}, {v.VoiceInfo.Gender})");
        }
        catch (Exception ex)
        {
            Line("  PROBLEM: speech could not start: " + ex.Message);
        }

        var text = report.ToString();
        string savedTo = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Scan Reader check.txt");
        try { File.WriteAllText(savedTo, text, Encoding.UTF8); }
        catch (Exception ex) { savedTo = "(could not save: " + ex.Message + ")"; }
        log.Info("Check report:\r\n" + text);

        try
        {
            synth.SetOutputToDefaultAudioDevice();
            synth.SpeakAsync("Check finished. " + string.Join(" ", spoken));
        }
        catch (Exception)
        {
            // No voice: the report on screen says so.
        }

        MessageBox.Show(text + "\nSaved to: " + savedTo, "Scan Reader check", MessageBoxButtons.OK, MessageBoxIcon.Information);
        return 0;
    }

    private sealed record ScannerList(List<string> Names, string? Error);

    private static ScannerList ListScanners()
    {
        var names = new List<string>();
        try
        {
            var type = Type.GetTypeFromProgID("WIA.DeviceManager", throwOnError: false);
            if (type == null) return new ScannerList(names, "WIA.DeviceManager is not registered on this computer.");
            dynamic manager = Activator.CreateInstance(type)!;
            dynamic infos = manager.DeviceInfos;
            int count = infos.Count;
            for (int i = 1; i <= count; i++)
            {
                dynamic info = infos[i];
                string name;
                try { name = (string)info.Properties["Name"].Value; } catch (Exception) { name = "(unnamed)"; }
                names.Add($"{name} (WIA device type {(int)info.Type}{((int)info.Type == 1 ? " = scanner" : "")})");
            }
            Marshal.FinalReleaseComObject(manager);
            return new ScannerList(names, null);
        }
        catch (Exception ex)
        {
            return new ScannerList(names, $"{ex.GetType().Name}: {ex.Message} (0x{ex.HResult:X8})");
        }
    }

    private static T? RunSta<T>(Func<T> work) where T : class
    {
        T? result = null;
        var t = new Thread(() => result = work()) { IsBackground = true };
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join(TimeSpan.FromSeconds(30));
        return result;
    }
}
