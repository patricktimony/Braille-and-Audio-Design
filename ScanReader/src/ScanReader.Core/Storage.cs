using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ScanReader.Core;

internal static class AtomicFile
{
    /// <summary>Write to a temporary file, then rename it over the target, so a power cut never leaves half a file.</summary>
    public static void WriteAllText(string path, string text)
    {
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, text, new UTF8Encoding(encoderShouldEmitUTF8Identifier: true));
        File.Move(tmp, path, overwrite: true);
    }
}

/// <summary>
/// Saves each document in its own dated folder:
///   Documents\Scanned Pages\2026-10-23 14-05-09\Page 001.txt, Page 001.png, All pages.txt
/// The folder is only created when the first page is saved.
/// </summary>
public sealed partial class DocumentStore(string rootFolder, Func<DateTime> now)
{
    public const string AllPagesFileName = "All pages.txt";

    public string RootFolder { get; } = rootFolder;

    public ReadingDocument CreateNew()
    {
        var name = now().ToString("yyyy-MM-dd HH-mm-ss", CultureInfo.InvariantCulture);
        var folder = Path.Combine(RootFolder, name);
        for (int i = 2; Directory.Exists(folder); i++) folder = Path.Combine(RootFolder, $"{name} ({i})");
        return new ReadingDocument(folder);
    }

    /// <summary>Loads the pages saved in a folder, or null if it is missing or holds no readable page.</summary>
    public ReadingDocument? Load(string folder)
    {
        if (!Directory.Exists(folder)) return null;
        var pages = new List<Page>();
        foreach (var file in Directory.EnumerateFiles(folder, "Page *.txt"))
        {
            var m = PageFileName().Match(Path.GetFileName(file));
            if (!m.Success) continue;
            var page = new Page(int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture), File.ReadAllText(file));
            if (page.HasWords) pages.Add(page);
        }
        if (pages.Count == 0) return null;
        pages.Sort((a, b) => a.Number.CompareTo(b.Number));
        return new ReadingDocument(folder, pages);
    }

    public string PrepareImagePath(ReadingDocument doc, int pageNumber)
    {
        Directory.CreateDirectory(doc.Folder);
        return Path.Combine(doc.Folder, PageFile(pageNumber, ".png"));
    }

    public void SavePage(ReadingDocument doc, Page page)
    {
        Directory.CreateDirectory(doc.Folder);
        AtomicFile.WriteAllText(Path.Combine(doc.Folder, PageFile(page.Number, ".txt")), ToWindowsLines(page.Text));

        var all = new StringBuilder();
        for (int i = 0; i < doc.Pages.Count; i++)
        {
            if (i > 0) all.Append("\r\n\r\n");
            all.Append("----- Page ").Append(i + 1).Append(" -----\r\n");
            all.Append(ToWindowsLines(doc.Pages[i].Text));
        }
        AtomicFile.WriteAllText(Path.Combine(doc.Folder, AllPagesFileName), all.ToString());
    }

    public static string PageFile(int number, string extension) =>
        "Page " + number.ToString("000", CultureInfo.InvariantCulture) + extension;

    private static string ToWindowsLines(string text) => text.Replace("\n", "\r\n");

    [GeneratedRegex(@"^Page (\d{1,6})\.txt$")]
    private static partial Regex PageFileName();
}

/// <summary>Where the reader was, so it can continue after the program or computer restarts.</summary>
public sealed class ReaderState
{
    public string? DocumentFolder { get; set; }
    public int PageIndex { get; set; }
    public int WordIndex { get; set; }
    public int? SpeechRate { get; set; }
}

public sealed class StateStore(string path, ILog log)
{
    public ReaderState Load()
    {
        try
        {
            if (File.Exists(path))
                return JsonSerializer.Deserialize<ReaderState>(File.ReadAllText(path)) ?? new ReaderState();
        }
        catch (Exception ex)
        {
            log.Error("Reading state file failed; starting fresh.", ex);
        }
        return new ReaderState();
    }

    public void Save(ReaderState state)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        AtomicFile.WriteAllText(path, JsonSerializer.Serialize(state, new JsonSerializerOptions { WriteIndented = true }));
    }
}

/// <summary>
/// Options a helper may change by editing settings.json with Notepad.
/// Missing or invalid values fall back to safe defaults.
/// </summary>
public sealed class ReaderSettings
{
    /// <summary>Scan resolution. 300 is right for normal print; 400 helps very small print.</summary>
    public int ScanDpi { get; set; } = 300;
    /// <summary>Colour scans are slower and rarely improve OCR. False = grayscale.</summary>
    public bool ScanInColor { get; set; }
    /// <summary>Exact voice name, e.g. "Microsoft Zira Desktop". Empty = automatic.</summary>
    public string VoiceName { get; set; } = "";
    /// <summary>OCR language tag, e.g. "en-US". Empty = Windows display language.</summary>
    public string OcrLanguage { get; set; } = "";
    /// <summary>Starting speech rate (-10..10) until the listener changes it with Minus/Plus.</summary>
    public int SpeechRate { get; set; } = -1;
    /// <summary>Give up waiting for the scanner after this many seconds.</summary>
    public int ScanTimeoutSeconds { get; set; } = 120;
    /// <summary>Say "Still working" this often while scanning.</summary>
    public int StillWorkingSeconds { get; set; } = 20;
    /// <summary>Where documents are saved. Empty = Documents\Scanned Pages.</summary>
    public string DocumentsFolder { get; set; } = "";
    /// <summary>Keep the page images next to the text files.</summary>
    public bool KeepImages { get; set; } = true;
    /// <summary>F5 brings the reader back to the front even when another window has the keyboard.</summary>
    public bool F5WorksFromAnyWindow { get; set; } = true;
    /// <summary>Keep the reader window above all other windows.</summary>
    public bool AlwaysOnTop { get; set; }

    public ReaderSettings Normalized()
    {
        ScanDpi = Math.Clamp(ScanDpi, 75, 600);
        SpeechRate = Math.Clamp(SpeechRate, -10, 10);
        ScanTimeoutSeconds = Math.Clamp(ScanTimeoutSeconds, 20, 600);
        StillWorkingSeconds = Math.Clamp(StillWorkingSeconds, 5, 300);
        VoiceName ??= "";
        OcrLanguage ??= "";
        DocumentsFolder ??= "";
        return this;
    }

    public static ReaderSettings LoadOrCreate(string path, ILog log)
    {
        ReaderSettings? settings = null;
        try
        {
            if (File.Exists(path))
                settings = JsonSerializer.Deserialize<ReaderSettings>(File.ReadAllText(path),
                    new JsonSerializerOptions { ReadCommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true });
        }
        catch (Exception ex)
        {
            log.Error("settings.json could not be read; using defaults.", ex);
            return new ReaderSettings().Normalized();
        }

        if (settings == null)
        {
            settings = new ReaderSettings();
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                AtomicFile.WriteAllText(path, JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true }));
            }
            catch (Exception ex)
            {
                log.Error("Could not write default settings.json.", ex);
            }
        }
        return settings.Normalized();
    }
}

/// <summary>Plain-text log for the helper. Never leaves the computer. Kept under about 1 MB.</summary>
public sealed class FileLog(string path) : ILog
{
    private readonly object gate = new();

    public void Info(string message) => Write("INFO ", message);

    public void Error(string message, Exception? ex = null) =>
        Write("ERROR", ex == null ? message : $"{message} | {ex.GetType().Name}: {ex.Message} (0x{ex.HResult:X8})");

    private void Write(string level, string message)
    {
        try
        {
            lock (gate)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                var info = new FileInfo(path);
                if (info.Exists && info.Length > 1_000_000) File.Move(path, path + ".old", overwrite: true);
                File.AppendAllText(path, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {level} {message}\r\n");
            }
        }
        catch
        {
            // Logging must never break the reader.
        }
    }
}
