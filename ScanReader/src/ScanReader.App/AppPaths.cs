using ScanReader.Core;

namespace ScanReader;

/// <summary>All the places the program reads or writes. Nothing outside these folders is touched.</summary>
internal static class AppPaths
{
    /// <summary>%LOCALAPPDATA%\ScanReader - settings.json, state.json, log.txt</summary>
    public static string DataFolder { get; } =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ScanReader");

    public static string SettingsFile => Path.Combine(DataFolder, "settings.json");
    public static string StateFile => Path.Combine(DataFolder, "state.json");
    public static string LogFile => Path.Combine(DataFolder, "log.txt");

    /// <summary>Documents\Scanned Pages, unless settings.json says otherwise.</summary>
    public static string DocumentsRoot(ReaderSettings settings) =>
        string.IsNullOrWhiteSpace(settings.DocumentsFolder)
            ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Scanned Pages")
            : Environment.ExpandEnvironmentVariables(settings.DocumentsFolder);
}
