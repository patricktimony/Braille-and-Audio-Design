namespace ScanReader.Core;

/// <summary>Acquires one page image from the flatbed scanner, with no dialog.</summary>
public interface IScanner
{
    /// <summary>Quick check that a scanner is visible to Windows. Does not move the scanner.</summary>
    Task<bool> IsScannerConnectedAsync();

    /// <summary>Scans the whole glass and saves it as a PNG at <paramref name="outputPngPath"/>.</summary>
    /// <returns>The path of the saved image.</returns>
    /// <exception cref="ScanException">The scan failed for a known reason.</exception>
    Task<string> ScanPageAsync(string outputPngPath);
}

/// <summary>Turns a page image into text, offline.</summary>
public interface IPageRecognizer
{
    /// <summary>Null when OCR is usable; otherwise a technical reason for the log file.</summary>
    string? CheckAvailability();

    /// <exception cref="OcrUnavailableException">No offline OCR language is installed.</exception>
    Task<RecognitionResult> RecognizeAsync(string imagePath);
}

/// <summary>Speech output. All callbacks arrive on the caller's (UI) thread.</summary>
public interface ISpeech
{
    /// <summary>False when Windows has no usable voice.</summary>
    bool IsAvailable { get; }

    /// <summary>-10 (slowest) to 10 (fastest).</summary>
    int Rate { get; set; }

    /// <summary>Queue a short message after anything already being spoken.</summary>
    void Say(string text);

    /// <summary>
    /// Queue a passage of text. <paramref name="onCharacterPosition"/> reports the
    /// character offset (within <paramref name="text"/>) of each word as it is spoken.
    /// <paramref name="onFinished"/> is called only if the passage was spoken to the end,
    /// never after <see cref="Stop"/>.
    /// </summary>
    void Read(string text, Action<int> onCharacterPosition, Action onFinished);

    /// <summary>Silence everything immediately and forget queued speech.</summary>
    void Stop();
}

public interface ILog
{
    void Info(string message);
    void Error(string message, Exception? ex = null);
}

public sealed record RecognitionResult(string Text, bool ImageLooksBlank, TextQuality Quality, int RotationDegrees);

public enum ScanErrorKind
{
    /// <summary>No scanner is visible: unplugged, switched off, or driver missing.</summary>
    NotFound,
    /// <summary>The scanner is in use by another program.</summary>
    Busy,
    /// <summary>Contact was lost during the scan (cable pulled, USB power problem).</summary>
    Disconnected,
    WarmingUp,
    CoverOpen,
    /// <summary>The scanner driver did not answer in time.</summary>
    Timeout,
    /// <summary>The Windows Image Acquisition component or service is unavailable.</summary>
    WiaUnavailable,
    General,
}

public sealed class ScanException : Exception
{
    public ScanException(ScanErrorKind kind, string message, Exception? inner = null) : base(message, inner) => Kind = kind;
    public ScanErrorKind Kind { get; }
}

public sealed class OcrUnavailableException(string message) : Exception(message);

public sealed class NullLog : ILog
{
    public void Info(string message) { }
    public void Error(string message, Exception? ex = null) { }
}
