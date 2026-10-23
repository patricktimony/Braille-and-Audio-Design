using System.Text.RegularExpressions;
using ScanReader.Core;
using ScanReader.Tests;
using static ScanReader.Tests.Assert;

// A deliberately tiny test runner: each test is a named async lambda.
var tests = new List<(string Name, Func<Task> Body)>();
void Test(string name, Func<Task> body) => tests.Add((name, body));
void TestSync(string name, Action body) => tests.Add((name, () => { body(); return Task.CompletedTask; }));

const string TwoLines = "The quick brown fox\njumps over the lazy dog.";

// ======================================================================= page model
TestSync("Page splits words and lines", () =>
{
    var p = new Page(1, "  Hello   world \r\n\r\nSecond line here\n");
    Equal(5, p.Words.Count);
    Equal(2, p.Lines.Count);
    Equal("Hello", p.WordText(0));
    Equal("world", p.WordText(1));
    Equal("Second line here", p.LineText(1));
    Equal(1, p.LineOfWord(2));
});

TestSync("Page with no text has no words", () =>
{
    False(new Page(1, "").HasWords);
    False(new Page(1, " \n \t \n").HasWords);
});

TestSync("Character position maps to word", () =>
{
    var p = new Page(1, TwoLines);
    Equal(0, p.WordIndexAtChar(0));
    Equal(0, p.WordIndexAtChar(2));
    Equal(1, p.WordIndexAtChar(4));
    Equal(4, p.WordIndexAtChar(p.Text.IndexOf("jumps")));
    Equal(8, p.WordIndexAtChar(9999));
});

TestSync("Next page number never reuses a number", () =>
{
    var d = new ReadingDocument("x", [new Page(1, "a"), new Page(3, "b")]);
    Equal(4, d.NextPageNumber);
    Equal(1, new ReadingDocument("y").NextPageNumber);
});

// ======================================================================= text quality
TestSync("Ordinary English is good quality", () =>
    Equal(TextQuality.Good, TextQualityScorer.Classify("Dear Mrs. Smith, your appointment is on Tuesday 14 March at 10:30.")));

TestSync("OCR noise is poor quality", () =>
    Equal(TextQuality.Poor, TextQualityScorer.Classify("~|| ;:. ^^ lI1 ,,, ][ %% tHiS xzq pqrst")));

TestSync("A short real page is not called poor", () =>
{
    Equal(TextQuality.Good, TextQualityScorer.Classify("Thank you"));
    False(TextQualityScorer.IsConfident("Thank you")); // but other orientations are still tried
    True(TextQualityScorer.IsConfident("Dear Mrs. Smith, your appointment is on Tuesday 14 March at 10:30."));
});

TestSync("Empty text has no quality", () => Equal(TextQuality.None, TextQualityScorer.Classify("   ")));

TestSync("Real text scores higher than noise", () =>
    True(TextQualityScorer.Score("This is a sentence with words") > TextQualityScorer.Score("~| ;: ^^ lI1 ,,, ][ xzq")));

// ======================================================================= blank page
TestSync("Uniform white image is blank", () =>
{
    var img = Filled(400, 500, 245);
    True(BlankPageDetector.LooksBlank(img, 400, 500));
});

TestSync("Dark edge strip alone still counts as blank", () =>
{
    var img = Filled(400, 500, 245);
    for (int y = 0; y < 500; y++) for (int x = 0; x < 8; x++) img[y * 400 + x] = 10;
    True(BlankPageDetector.LooksBlank(img, 400, 500));
});

TestSync("Image with lines of text is not blank", () =>
{
    var img = Filled(400, 500, 245);
    for (int line = 0; line < 20; line++)
        for (int y = 40 + line * 22; y < 48 + line * 22; y++)
            for (int x = 40; x < 360; x += 3) img[y * 400 + x] = 20;
    False(BlankPageDetector.LooksBlank(img, 400, 500));
});

// ======================================================================= saving
Test("Pages are saved as text files and an all-pages file", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText("First page text");
    await r.ScanText("Second page text");
    var folder = r.Controller.DocumentFolder;
    Equal("First page text", File.ReadAllText(Path.Combine(folder, "Page 001.txt")).Trim('﻿'));
    Equal("Second page text", File.ReadAllText(Path.Combine(folder, "Page 002.txt")).Trim('﻿'));
    var all = File.ReadAllText(Path.Combine(folder, DocumentStore.AllPagesFileName));
    Contains("----- Page 1 -----", all);
    Contains("Second page text", all);
    True(File.Exists(Path.Combine(folder, "Page 002.png")));
});

TestSync("Document folder is only created when the first page is saved", () =>
{
    using var r = new Rig();
    False(Directory.Exists(r.Controller.DocumentFolder));
});

TestSync("Corrupt state file falls back to a fresh start", () =>
{
    using var r = new Rig();
    Directory.CreateDirectory(Path.GetDirectoryName(r.StatePath)!);
    File.WriteAllText(r.StatePath, "{ this is not json");
    var s = new StateStore(r.StatePath, r.Log).Load();
    Equal(null, s.DocumentFolder);
    True(r.Log.Lines.Any(l => l.StartsWith("ERROR")));
});

TestSync("Missing settings file is created with defaults; bad values are clamped", () =>
{
    using var r = new Rig();
    var path = Path.Combine(r.Root, "settings.json");
    var s = ReaderSettings.LoadOrCreate(path, r.Log);
    Equal(300, s.ScanDpi);
    True(File.Exists(path));
    File.WriteAllText(path, "{ \"ScanDpi\": 5000, // comment\n \"SpeechRate\": -99, }");
    s = ReaderSettings.LoadOrCreate(path, r.Log);
    Equal(600, s.ScanDpi);
    Equal(-10, s.SpeechRate);
});

// ======================================================================= start-up
Test("Fresh start says ready and how to scan", async () =>
{
    using var r = await new Rig().Started();
    Contains(Messages.Ready, r.Speech.LastSaid);
    Contains(Messages.PlaceFirstPage, r.Speech.LastSaid);
    Equal(-1, r.Speech.Rate);
});

Test("Scanner unplugged at start is announced", async () =>
{
    using var r = new Rig();
    r.Scanner.Connected = false;
    await r.Started();
    Contains(Messages.ScannerNotFoundAtStart, r.Speech.LastSaid);
});

Test("Missing OCR at start is announced and shown", async () =>
{
    using var r = new Rig();
    r.Recognizer.Problem = "no OCR language";
    await r.Started();
    Contains(Messages.OcrMissing, r.Speech.LastSaid);
    Equal("no OCR language", r.Controller.OcrProblem);
});

Test("Missing voices: reader still works and messages are still shown", async () =>
{
    using var r = new Rig();
    r.Speech.IsAvailable = false;
    await r.Started();
    False(r.Controller.SpeechAvailable);
    Contains(Messages.Ready, r.Controller.LastMessage);
    await r.ScanText(TwoLines);
    Equal(1, r.Controller.PageCount);
    True(r.Log.Lines.Any(l => l.Contains("No speech voice")));
});

Test("Keys pressed while starting are answered with please wait", async () =>
{
    using var r = new Rig();
    await r.Press(ReaderCommand.Scan);
    Equal(0, r.Scanner.Scans);
    Equal(Messages.PleaseWait, r.Speech.LastSaid);
});

// ======================================================================= scanning
Test("Scan announces Scanning, Recognizing text, Reading, then reads", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    var said = r.Speech.Said.ToList();
    Equal(Messages.Scanning, said[^3]);
    Equal(Messages.Recognizing, said[^2]);
    Equal(Messages.PageReading(1), said[^1]);
    Equal(TwoLines, r.Speech.CurrentReadText);
    True(r.Controller.IsReading);
    False(r.Controller.IsBusy);
});

Test("Scanner disconnected: spoken message, no page added", async () =>
{
    using var r = await new Rig().Started();
    r.Scanner.NextError = new ScanException(ScanErrorKind.NotFound, "gone");
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.ForScanError(ScanErrorKind.NotFound), r.Speech.LastSaid);
    Equal(0, r.Controller.PageCount);
    False(r.Controller.IsBusy);
});

Test("Scanner unplugged during scan: spoken message", async () =>
{
    using var r = await new Rig().Started();
    r.Scanner.NextError = new ScanException(ScanErrorKind.Disconnected, "lost");
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.ForScanError(ScanErrorKind.Disconnected), r.Speech.LastSaid);
});

Test("Scanner not responding: timeout message", async () =>
{
    using var r = await new Rig().Started();
    r.Scanner.NextError = new ScanException(ScanErrorKind.Timeout, "slow");
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.ForScanError(ScanErrorKind.Timeout), r.Speech.LastSaid);
});

Test("Unexpected scanner exception: general spoken message, reader keeps working", async () =>
{
    using var r = await new Rig().Started();
    r.Scanner.NextError = new InvalidOperationException("driver exploded");
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.ForScanError(ScanErrorKind.General), r.Speech.LastSaid);
    await r.ScanText(TwoLines);
    Equal(1, r.Controller.PageCount);
});

Test("Every scan error kind has its own spoken message", () =>
{
    var texts = Enum.GetValues<ScanErrorKind>().Select(Messages.ForScanError).ToList();
    Equal(texts.Count, texts.Distinct().Count());
    return Task.CompletedTask;
});

Test("Blank page: blank message, no page added, image removed", async () =>
{
    using var r = await new Rig().Started();
    r.Recognizer.Results.Enqueue(new RecognitionResult("", true, TextQuality.None, 0));
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.BlankPage, r.Speech.LastSaid);
    Equal(0, r.Controller.PageCount);
    False(File.Exists(Path.Combine(r.Controller.DocumentFolder, "Page 001.png")));
});

Test("No text on a non-blank page (picture, face up): no-text message", async () =>
{
    using var r = await new Rig().Started();
    r.Recognizer.Results.Enqueue(new RecognitionResult("  ", false, TextQuality.None, 0));
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.NoTextFound, r.Speech.LastSaid);
});

Test("Unreadable text: warning, then whatever was found is read", async () =>
{
    using var r = await new Rig().Started();
    r.Recognizer.Results.Enqueue(new RecognitionResult("~|| xq; Tlie", false, TextQuality.Poor, 0));
    await r.Press(ReaderCommand.Scan);
    Contains(Messages.PoorQuality, r.Speech.LastSaid);
    Contains(Messages.PageReading(1), r.Speech.LastSaid);
    Equal("~|| xq; Tlie", r.Speech.CurrentReadText);
});

Test("OCR missing when scanning: OCR message", async () =>
{
    using var r = await new Rig().Started();
    r.Recognizer.Problem = "removed";
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.OcrMissing, r.Speech.LastSaid);
    Equal(0, r.Controller.PageCount);
});

Test("OCR crash: spoken message", async () =>
{
    using var r = await new Rig().Started();
    r.Recognizer.NextError = new OutOfMemoryException();
    await r.Press(ReaderCommand.Scan);
    Equal(Messages.OcrFailed, r.Speech.LastSaid);
});

Test("Cannot save: page is still read, with a warning", async () =>
{
    using var r = await new Rig().Started();
    r.Recognizer.Enqueue(TwoLines);
    await r.Press(ReaderCommand.Scan);
    // Make the next save fail: put a directory where the text file must go.
    Directory.CreateDirectory(Path.Combine(r.Controller.DocumentFolder, "Page 002.txt"));
    await r.ScanText("second page");
    Contains(Messages.SaveFailed, r.Speech.LastSaid);
    Equal("second page", r.Speech.CurrentReadText);
});

Test("Keys pressed during a scan: please wait; Escape silences", async () =>
{
    using var r = await new Rig().Started();
    r.Scanner.Gate = new TaskCompletionSource<bool>();
    r.Recognizer.Enqueue(TwoLines);
    var scan = r.Press(ReaderCommand.Scan);
    True(r.Controller.IsBusy);
    await r.Press(ReaderCommand.Scan);
    Equal(1, r.Scanner.Scans);
    Equal(Messages.PleaseWait, r.Speech.LastSaid);
    await r.Press(ReaderCommand.Stop);
    Equal("stop", r.Speech.Log[^1]);
    r.Scanner.Gate.SetResult(true);
    await scan;
    Equal(1, r.Controller.PageCount);
});

// ======================================================================= reading
Test("Pause remembers the word; Space resumes from it", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    r.Speech.ReachWord(5); // "over"
    Equal(5, r.Controller.CurrentWordIndex);
    await r.Press(ReaderCommand.PlayPause);
    Equal(Messages.Paused, r.Speech.LastSaid);
    False(r.Controller.IsReading);
    await r.Press(ReaderCommand.PlayPause);
    True(r.Controller.IsReading);
    Equal("over the lazy dog.", r.Speech.CurrentReadText);
});

Test("Escape stops reading and keeps the position", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    r.Speech.ReachWord(2);
    await r.Press(ReaderCommand.Stop);
    False(r.Controller.IsReading);
    Equal(2, r.Controller.CurrentWordIndex);
});

Test("Speech events from an old passage are ignored", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    var oldProgress = CaptureProgress(r);
    await r.Press(ReaderCommand.PlayPause);   // pause
    oldProgress(TwoLines.IndexOf("dog"));      // late event from the cancelled passage
    Equal(0, r.Controller.CurrentWordIndex);
});

Test("Reading continues onto the next page, then says end of last page", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText("Page one words");
    await r.ScanText("Page two words");
    await r.Press(ReaderCommand.PreviousPage);
    Equal("Page one words", r.Speech.CurrentReadText);
    r.Speech.FinishReading();
    Equal(Messages.PageHeading(2), r.Speech.LastSaid);
    Equal("Page two words", r.Speech.CurrentReadText);
    r.Speech.FinishReading();
    Equal(Messages.EndOfLastPage(2), r.Speech.LastSaid);
    False(r.Controller.IsReading);
});

Test("Space with nothing scanned explains what to do", async () =>
{
    using var r = await new Rig().Started();
    await r.Press(ReaderCommand.PlayPause);
    Equal(Messages.NothingToRead, r.Speech.LastSaid);
    await r.Press(ReaderCommand.NextWord);
    Equal(Messages.NothingToRead, r.Speech.LastSaid);
});

// ======================================================================= navigation
Test("Left and Right move by word and stop reading", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    await r.Press(ReaderCommand.NextWord);
    False(r.Controller.IsReading);
    Equal("quick", r.Speech.LastSaid);
    await r.Press(ReaderCommand.NextWord);
    Equal("brown", r.Speech.LastSaid);
    await r.Press(ReaderCommand.PreviousWord);
    Equal("quick", r.Speech.LastSaid);
    await r.Press(ReaderCommand.PreviousWord);
    await r.Press(ReaderCommand.PreviousWord);
    Equal(Messages.StartOfPage, r.Speech.LastSaid);
});

Test("Right at the last word says end of page", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText("one two");
    await r.Press(ReaderCommand.NextWord);
    await r.Press(ReaderCommand.NextWord);
    Equal(Messages.EndOfPage, r.Speech.LastSaid);
});

Test("Up and Down move by line", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText("Line one\nLine two\nLine three");
    await r.Press(ReaderCommand.NextLine);
    Equal("Line two", r.Speech.LastSaid);
    await r.Press(ReaderCommand.NextLine);
    Equal("Line three", r.Speech.LastSaid);
    await r.Press(ReaderCommand.NextLine);
    Equal(Messages.BottomOfPage, r.Speech.LastSaid);
    await r.Press(ReaderCommand.PreviousLine);
    Equal("Line two", r.Speech.LastSaid);
    await r.Press(ReaderCommand.PreviousLine);
    await r.Press(ReaderCommand.PreviousLine);
    Equal(Messages.TopOfPage, r.Speech.LastSaid);
    await r.Press(ReaderCommand.PlayPause);
    Equal("Line one\nLine two\nLine three", r.Speech.CurrentReadText);
});

Test("Space after moving reads from the new position", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    await r.Press(ReaderCommand.NextLine);
    await r.Press(ReaderCommand.PlayPause);
    Equal("jumps over the lazy dog.", r.Speech.CurrentReadText);
});

Test("Page Up / Page Down announce the page and read it; limits are announced", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText("alpha page");
    await r.ScanText("beta page");
    await r.Press(ReaderCommand.NextPage);
    Equal(Messages.LastPageAlready, r.Speech.LastSaid);
    await r.Press(ReaderCommand.PreviousPage);
    Equal(Messages.PageOf(1, 2), r.Speech.LastSaid);
    Equal("alpha page", r.Speech.CurrentReadText);
    await r.Press(ReaderCommand.PreviousPage);
    Equal(Messages.FirstPageAlready, r.Speech.LastSaid);
    await r.Press(ReaderCommand.NextPage);
    Equal("beta page", r.Speech.CurrentReadText);
});

Test("New scan is added after the last page, even when reading an earlier one", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText("p1 text");
    await r.ScanText("p2 text");
    await r.Press(ReaderCommand.PreviousPage);
    await r.ScanText("p3 text");
    Equal(3, r.Controller.PageCount);
    Equal(3, r.Controller.CurrentPageNumber);
    Equal(Messages.PageReading(3), r.Speech.LastSaid);
});

// ======================================================================= other keys
Test("Minus and Plus change speed, with limits, and keep reading", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    r.Speech.ReachWord(3);
    await r.Press(ReaderCommand.Slower);
    Equal(-2, r.Speech.Rate);
    Equal(Messages.Slower, r.Speech.LastSaid);
    True(r.Controller.IsReading);
    Equal("fox\njumps over the lazy dog.", r.Speech.CurrentReadText);
    for (int i = 0; i < 30; i++) await r.Press(ReaderCommand.Faster);
    Equal(10, r.Speech.Rate);
    Equal(Messages.Fastest, r.Speech.LastSaid);
});

Test("Control N needs pressing twice to start a new document", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    var first = r.Controller.DocumentFolder;
    await r.Press(ReaderCommand.NewDocument);
    Equal(Messages.ConfirmNewDocument, r.Speech.LastSaid);
    Equal(1, r.Controller.PageCount);
    r.Now = r.Now.AddSeconds(3);
    await r.Press(ReaderCommand.NewDocument);
    Equal(Messages.NewDocumentStarted, r.Speech.LastSaid);
    Equal(0, r.Controller.PageCount);
    True(r.Controller.DocumentFolder != first);
    True(File.Exists(Path.Combine(first, "Page 001.txt")));
});

Test("Control N confirmation expires, and other keys cancel it", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    await r.Press(ReaderCommand.NewDocument);
    r.Now = r.Now.AddSeconds(30);
    await r.Press(ReaderCommand.NewDocument);
    Equal(Messages.ConfirmNewDocument, r.Speech.LastSaid);
    await r.Press(ReaderCommand.NextWord);
    await r.Press(ReaderCommand.NewDocument);
    Equal(Messages.ConfirmNewDocument, r.Speech.LastSaid);
    Equal(1, r.Controller.PageCount);
});

Test("F1 help includes position and all keys", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    await r.Press(ReaderCommand.Help);
    foreach (var word in new[] { "page 1 of 1", "F5", "Space", "Left and Right", "Up and Down", "Page Up", "Escape", "Minus" })
        Contains(word, r.Speech.LastSaid);
});

Test("Unknown keys give a hint, but not while reading", async () =>
{
    using var r = await new Rig().Started();
    await r.Press(ReaderCommand.UnknownKey);
    Equal(Messages.UnknownKey, r.Speech.LastSaid);
    await r.ScanText(TwoLines);
    await r.Press(ReaderCommand.UnknownKey);
    True(r.Controller.IsReading);
});

// ======================================================================= restart
Test("Restart: pages, page, word and speed are remembered", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText("first page words");
    await r.ScanText(TwoLines);
    await r.Press(ReaderCommand.Faster);
    r.Speech.ReachWord(4);
    await r.Press(ReaderCommand.PlayPause);
    r.Controller.Shutdown();

    r.Speech.Rate = 0;
    r.NewController();
    await r.Started();
    Equal(2, r.Controller.PageCount);
    Equal(2, r.Controller.CurrentPageNumber);
    Equal(0, r.Speech.Rate);
    Contains(Messages.ResumeSession(2, 2), r.Speech.LastSaid);
    await r.Press(ReaderCommand.PlayPause);
    Equal("jumps over the lazy dog.", r.Speech.CurrentReadText);
});

Test("Restart without a clean shutdown (power cut) still resumes", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    await r.Press(ReaderCommand.NextLine);  // position saved on navigation
    r.NewController();
    await r.Started();
    await r.Press(ReaderCommand.PlayPause);
    Equal("jumps over the lazy dog.", r.Speech.CurrentReadText);
});

Test("Restart after the document folder was deleted starts fresh", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    r.Controller.Shutdown();
    Directory.Delete(r.Controller.DocumentFolder, recursive: true);
    r.NewController();
    await r.Started();
    Equal(0, r.Controller.PageCount);
    Contains(Messages.PlaceFirstPage, r.Speech.LastSaid);
});

Test("Restart with a saved position beyond the page is clamped", async () =>
{
    using var r = await new Rig().Started();
    await r.ScanText(TwoLines);
    r.Controller.Shutdown();
    var store = new StateStore(r.StatePath, r.Log);
    var s = store.Load();
    s.PageIndex = 7; s.WordIndex = 999;
    store.Save(s);
    r.NewController();
    await r.Started();
    Equal(1, r.Controller.CurrentPageNumber);
    Equal(8, r.Controller.CurrentWordIndex);
});

// ======================================================================= source audit
TestSync("Source audit: no network, process launching, registry or telemetry code", () =>
{
    var src = FindSourceFolder();
    var forbidden = new[]
    {
        @"System\.Net", @"HttpClient", @"WebClient", @"WebRequest", @"Socket", @"Process\.Start",
        @"Microsoft\.Win32\.Registry", @"Registry\.", @"Telemetry", @"Assembly\.Load", @"DllImport\(""(?!user32\.dll)",
    };
    var hits = new List<string>();
    foreach (var file in Directory.EnumerateFiles(src, "*.cs", SearchOption.AllDirectories))
    {
        if (file.Contains(Path.DirectorySeparatorChar + "obj" + Path.DirectorySeparatorChar)) continue;
        var text = File.ReadAllText(file);
        foreach (var f in forbidden)
            if (Regex.IsMatch(text, f)) hits.Add($"{Path.GetFileName(file)}: {f}");
    }
    if (hits.Count > 0) throw new Exception("Forbidden API use: " + string.Join("; ", hits));
});

TestSync("Source audit: no NuGet packages except System.Speech", () =>
{
    var src = FindSourceFolder();
    var refs = Directory.EnumerateFiles(src, "*.csproj", SearchOption.AllDirectories)
        .SelectMany(f => Regex.Matches(File.ReadAllText(f), "PackageReference Include=\"([^\"]+)\"").Select(m => m.Groups[1].Value))
        .ToList();
    Equal("System.Speech", string.Join(",", refs));
});

// ======================================================================= run
int failed = 0;
foreach (var (name, body) in tests)
{
    try
    {
        await body();
        Console.WriteLine("PASS  " + name);
    }
    catch (Exception ex)
    {
        failed++;
        Console.WriteLine("FAIL  " + name + "\n      " + ex.Message);
    }
}
Console.WriteLine($"\n{tests.Count - failed} passed, {failed} failed, {tests.Count} total.");
return failed == 0 ? 0 : 1;

// ======================================================================= helpers
static byte[] Filled(int w, int h, byte value)
{
    var a = new byte[w * h];
    Array.Fill(a, value);
    return a;
}

static Action<int> CaptureProgress(Rig r)
{
    // Grab the controller's progress callback for the passage now being read.
    var text = r.Speech.CurrentReadText!;
    var field = typeof(FakeSpeech).GetField("position", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
    return (Action<int>)field.GetValue(r.Speech)!;
}

static string FindSourceFolder()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "src", "ScanReader.App"))) dir = dir.Parent;
    return dir == null ? throw new Exception("Cannot find src folder") : Path.Combine(dir.FullName, "src");
}

namespace ScanReader.Tests
{
    internal static class Assert
    {
        public static void Equal<T>(T expected, T actual)
        {
            if (!EqualityComparer<T>.Default.Equals(expected, actual))
                throw new Exception($"Expected <{expected}> but got <{actual}>");
        }

        public static void True(bool condition)
        {
            if (!condition) throw new Exception("Expected true");
        }

        public static void False(bool condition)
        {
            if (condition) throw new Exception("Expected false");
        }

        public static void Contains(string expected, string actual)
        {
            if (!actual.Contains(expected, StringComparison.OrdinalIgnoreCase))
                throw new Exception($"Expected <{actual}> to contain <{expected}>");
        }
    }
}
