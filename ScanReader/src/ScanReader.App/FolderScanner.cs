using ScanReader.Core;

namespace ScanReader;

/// <summary>
/// TEST MODE ONLY (ScanReader.exe --simulate-scanner "C:\folder").
/// Each F5 "scans" the next image file from the folder, in name order, so the
/// whole program can be tried on a computer with no scanner attached.
/// A file named like "05 fail-NotFound.txt" makes that press fail with the
/// given <see cref="ScanErrorKind"/>, to rehearse the spoken error messages.
/// </summary>
internal sealed class FolderScanner : IScanner
{
    private static readonly string[] Extensions = [".png", ".bmp", ".jpg", ".jpeg", ".tif", ".tiff", ".txt"];
    private readonly string[] files;
    private readonly ILog log;
    private int next;

    public FolderScanner(string folder, ILog log)
    {
        this.log = log;
        files = Directory.Exists(folder)
            ? Directory.GetFiles(folder)
                .Where(f => Extensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                .Order(StringComparer.OrdinalIgnoreCase)
                .ToArray()
            : [];
    }

    public Task<bool> IsScannerConnectedAsync() => Task.FromResult(files.Length > 0);

    public async Task<string> ScanPageAsync(string outputPngPath)
    {
        if (files.Length == 0) throw new ScanException(ScanErrorKind.NotFound, "Simulation folder has no images.");
        var file = files[next++ % files.Length];
        log.Info("Simulated scan of " + file);
        await Task.Delay(1500); // feel a little like a real scanner

        var name = Path.GetFileNameWithoutExtension(file);
        int marker = name.IndexOf("fail-", StringComparison.OrdinalIgnoreCase);
        if (marker >= 0)
        {
            var kindName = name[(marker + 5)..];
            var kind = Enum.TryParse<ScanErrorKind>(kindName, ignoreCase: true, out var k) ? k : ScanErrorKind.General;
            throw new ScanException(kind, "Simulated failure " + kind);
        }

        await Task.Run(() => ImageTools.ConvertToPng(file, outputPngPath));
        return outputPngPath;
    }
}
