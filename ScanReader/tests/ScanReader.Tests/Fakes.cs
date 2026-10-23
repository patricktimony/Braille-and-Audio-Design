using ScanReader.Core;

namespace ScanReader.Tests;

/// <summary>Records everything "spoken" and lets a test play the role of the voice.</summary>
internal sealed class FakeSpeech : ISpeech
{
    public readonly List<string> Log = [];
    private Action<int>? position;
    private Action? finished;

    public bool IsAvailable { get; set; } = true;
    public int Rate { get; set; }
    public string? CurrentReadText { get; private set; }

    public IEnumerable<string> Said => Log.Where(l => l.StartsWith("say: ")).Select(l => l[5..]);
    public IEnumerable<string> Reads => Log.Where(l => l.StartsWith("read: ")).Select(l => l[6..]);
    public string LastSaid => Said.LastOrDefault() ?? "";

    public void Say(string text) => Log.Add("say: " + text);

    public void Read(string text, Action<int> onCharacterPosition, Action onFinished)
    {
        Log.Add("read: " + text);
        CurrentReadText = text;
        position = onCharacterPosition;
        finished = onFinished;
    }

    public void Stop()
    {
        Log.Add("stop");
        CurrentReadText = null;
        position = null;
        finished = null;
    }

    /// <summary>Pretend the voice has reached the given character of the current passage.</summary>
    public void ReachCharacter(int offset) => position?.Invoke(offset);

    /// <summary>Pretend the voice reached the given word (0-based, whitespace separated) of the passage.</summary>
    public void ReachWord(int n)
    {
        var text = CurrentReadText ?? throw new InvalidOperationException("Nothing is being read.");
        int idx = 0, seen = -1;
        for (int i = 0; i < text.Length; i++)
        {
            bool start = !char.IsWhiteSpace(text[i]) && (i == 0 || char.IsWhiteSpace(text[i - 1]));
            if (start && ++seen == n) { idx = i; break; }
        }
        ReachCharacter(idx);
    }

    public void FinishReading()
    {
        var f = finished;
        CurrentReadText = null;
        position = null;
        finished = null;
        f?.Invoke();
    }
}

internal sealed class FakeScanner : IScanner
{
    public bool Connected = true;
    public Exception? NextError;
    public TaskCompletionSource<bool>? Gate;
    public int Scans;

    public Task<bool> IsScannerConnectedAsync() => Task.FromResult(Connected);

    public async Task<string> ScanPageAsync(string outputPngPath)
    {
        Scans++;
        if (Gate != null) await Gate.Task;
        if (NextError is { } e) { NextError = null; throw e; }
        File.WriteAllText(outputPngPath, "fake image");
        return outputPngPath;
    }
}

internal sealed class FakeRecognizer : IPageRecognizer
{
    public string? Problem;
    public readonly Queue<RecognitionResult> Results = new();
    public Exception? NextError;

    public string? CheckAvailability() => Problem;

    public Task<RecognitionResult> RecognizeAsync(string imagePath)
    {
        if (Problem != null) throw new OcrUnavailableException(Problem);
        if (NextError is { } e) { NextError = null; throw e; }
        return Task.FromResult(Results.Count > 0 ? Results.Dequeue() : Text("default page text"));
    }

    public static RecognitionResult Text(string text) =>
        new(text, false, TextQualityScorer.Classify(text), 0);

    public void Enqueue(string text) => Results.Enqueue(Text(text));
}

internal sealed class MemoryLog : ILog
{
    public readonly List<string> Lines = [];
    public void Info(string message) => Lines.Add("INFO " + message);
    public void Error(string message, Exception? ex = null) => Lines.Add("ERROR " + message + (ex == null ? "" : " " + ex.Message));
}

/// <summary>A complete reader wired to fakes and a temporary folder.</summary>
internal sealed class Rig : IDisposable
{
    public readonly string Root = Path.Combine(Path.GetTempPath(), "scanreader-test-" + Guid.NewGuid().ToString("N"));
    public readonly FakeSpeech Speech = new();
    public readonly FakeScanner Scanner = new();
    public readonly FakeRecognizer Recognizer = new();
    public readonly MemoryLog Log = new();
    public readonly ReaderSettings Settings = new() { StillWorkingSeconds = 300 };
    public DateTime Now = new(2026, 10, 23, 9, 0, 0);
    public ReaderController Controller;

    public Rig() => Controller = NewController();

    public string DocsRoot => Path.Combine(Root, "docs");
    public string StatePath => Path.Combine(Root, "data", "state.json");

    /// <summary>A fresh controller on the same folders: what happens when the program is restarted.</summary>
    public ReaderController NewController() =>
        Controller = new ReaderController(Scanner, Recognizer, Speech,
            new DocumentStore(DocsRoot, () => Now), new StateStore(StatePath, Log), Settings, Log, () => Now);

    public async Task<Rig> Started()
    {
        await Controller.StartAsync();
        return this;
    }

    public Task Press(ReaderCommand c) => Controller.HandleAsync(c);

    public async Task ScanText(string text)
    {
        Recognizer.Enqueue(text);
        await Press(ReaderCommand.Scan);
    }

    public void Dispose()
    {
        try { Directory.Delete(Root, recursive: true); } catch (IOException) { }
    }
}
