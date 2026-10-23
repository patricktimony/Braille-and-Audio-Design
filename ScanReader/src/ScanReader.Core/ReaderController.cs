namespace ScanReader.Core;

public enum ReaderCommand
{
    Scan,
    PlayPause,
    PreviousWord,
    NextWord,
    PreviousLine,
    NextLine,
    PreviousPage,
    NextPage,
    Stop,
    Help,
    NewDocument,
    Slower,
    Faster,
    UnknownKey,
}

/// <summary>
/// Everything the reader does in response to a key press. It knows nothing
/// about Windows: the scanner, OCR engine and voice are passed in, so every
/// behaviour (including all error messages) can be tested with stand-ins.
///
/// Must be used from a single thread (the UI thread). Speech callbacks are
/// expected on that same thread.
/// </summary>
public sealed class ReaderController
{
    private static readonly TimeSpan NewDocumentConfirmWindow = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan SaveThrottle = TimeSpan.FromSeconds(3);

    private readonly IScanner scanner;
    private readonly IPageRecognizer recognizer;
    private readonly ISpeech speech;
    private readonly DocumentStore documents;
    private readonly StateStore stateStore;
    private readonly ReaderSettings settings;
    private readonly ILog log;
    private readonly Func<DateTime> now;

    private ReadingDocument document;
    private int pageIndex;
    private int wordIndex;
    private bool reading;
    private int readToken;
    private bool starting = true;
    private DateTime newDocumentDeadline = DateTime.MinValue;
    private DateTime lastSaved = DateTime.MinValue;

    public ReaderController(IScanner scanner, IPageRecognizer recognizer, ISpeech speech,
        DocumentStore documents, StateStore stateStore, ReaderSettings settings, ILog log, Func<DateTime>? now = null)
    {
        this.scanner = scanner;
        this.recognizer = recognizer;
        this.speech = speech;
        this.documents = documents;
        this.stateStore = stateStore;
        this.settings = settings;
        this.log = log;
        this.now = now ?? (() => DateTime.Now);
        document = documents.CreateNew();
    }

    /// <summary>Raised whenever something visible changes (message, page, position).</summary>
    public event Action? Changed;

    public bool IsBusy { get; private set; }
    public bool IsReading => reading;
    public bool SpeechAvailable => speech.IsAvailable;
    public string? OcrProblem { get; private set; }
    public string LastMessage { get; private set; } = "";
    public int PageCount => document.Pages.Count;
    public int CurrentPageNumber => PageCount == 0 ? 0 : pageIndex + 1;
    public int CurrentWordIndex => wordIndex;
    public string DocumentFolder => document.Folder;
    public Page? CurrentPage => PageCount == 0 ? null : document.Pages[pageIndex];

    public string CurrentLineText =>
        CurrentPage is { HasWords: true } p ? p.LineText(p.LineOfWord(wordIndex)) : "";

    public string CurrentWordText =>
        CurrentPage is { HasWords: true } p ? p.WordText(wordIndex) : "";

    // ------------------------------------------------------------------ start / stop

    public async Task StartAsync()
    {
        var state = stateStore.Load();
        speech.Rate = Math.Clamp(state.SpeechRate ?? settings.SpeechRate, -10, 10);

        if (!string.IsNullOrEmpty(state.DocumentFolder))
        {
            try { document = documents.Load(state.DocumentFolder) ?? document; }
            catch (Exception ex) { log.Error("Could not load last document.", ex); }
        }
        if (PageCount > 0)
        {
            pageIndex = Math.Clamp(state.PageIndex, 0, PageCount - 1);
            wordIndex = Math.Clamp(state.WordIndex, 0, document.Pages[pageIndex].Words.Count - 1);
        }

        if (!speech.IsAvailable) log.Error("No speech voice is available.");

        try { OcrProblem = recognizer.CheckAvailability(); }
        catch (Exception ex) { OcrProblem = ex.Message; }
        if (OcrProblem != null) log.Error("OCR unavailable: " + OcrProblem);

        bool scannerFound;
        try { scannerFound = await scanner.IsScannerConnectedAsync(); }
        catch (Exception ex) { log.Error("Scanner check failed.", ex); scannerFound = false; }

        var parts = new List<string> { Messages.Ready };
        if (OcrProblem != null) parts.Add(Messages.OcrMissing);
        if (!scannerFound) parts.Add(Messages.ScannerNotFoundAtStart);
        parts.Add(PageCount > 0 ? Messages.ResumeSession(PageCount, CurrentPageNumber) : Messages.PlaceFirstPage);

        starting = false;
        Announce(string.Join(" ", parts));
    }

    /// <summary>Call when the window closes. Saves the reading position.</summary>
    public void Shutdown()
    {
        StopReading();
        speech.Stop();
        SaveState(force: true);
    }

    // ------------------------------------------------------------------ commands

    public async Task HandleAsync(ReaderCommand command)
    {
        if (command != ReaderCommand.NewDocument) newDocumentDeadline = DateTime.MinValue;

        if (starting || IsBusy)
        {
            if (command == ReaderCommand.Stop) speech.Stop();
            else Announce(Messages.PleaseWait);
            return;
        }

        switch (command)
        {
            case ReaderCommand.Scan: await ScanAsync(); break;
            case ReaderCommand.PlayPause: if (reading) Pause(); else StartReading(); break;
            case ReaderCommand.PreviousWord: MoveWord(-1); break;
            case ReaderCommand.NextWord: MoveWord(+1); break;
            case ReaderCommand.PreviousLine: MoveLine(-1); break;
            case ReaderCommand.NextLine: MoveLine(+1); break;
            case ReaderCommand.PreviousPage: MovePage(-1); break;
            case ReaderCommand.NextPage: MovePage(+1); break;
            case ReaderCommand.Stop: StopReading(); speech.Stop(); SaveState(force: true); RaiseChanged(); break;
            case ReaderCommand.Help: StopReading(); Announce(Messages.Help(PageCount, CurrentPageNumber)); break;
            case ReaderCommand.NewDocument: NewDocument(); break;
            case ReaderCommand.Slower: ChangeRate(-1); break;
            case ReaderCommand.Faster: ChangeRate(+1); break;
            case ReaderCommand.UnknownKey: if (!reading) Announce(Messages.UnknownKey); break;
        }
    }

    /// <summary>The window came back to the front (F5 pressed in another window, or a second copy was started).</summary>
    public void AnnounceBroughtToFront()
    {
        if (IsBusy || starting) return;
        StopReading();
        Announce(Messages.AlreadyRunning + " " + Messages.Ready +
                 (PageCount > 0 ? " " + Messages.PageOf(CurrentPageNumber, PageCount) : " " + Messages.PlaceFirstPage));
    }

    // ------------------------------------------------------------------ scanning

    private async Task ScanAsync()
    {
        StopReading();
        IsBusy = true;
        Announce(Messages.Scanning);
        using var reminder = new CancellationTokenSource();
        _ = RemindWhileBusyAsync(reminder.Token);
        try
        {
            int number = document.NextPageNumber;
            string imagePath;
            try { imagePath = documents.PrepareImagePath(document, number); }
            catch (Exception ex)
            {
                log.Error("Cannot create document folder " + document.Folder, ex);
                Announce(Messages.CannotPrepareFolder);
                return;
            }

            string scanned;
            try
            {
                scanned = await scanner.ScanPageAsync(imagePath);
            }
            catch (ScanException ex)
            {
                log.Error($"Scan failed ({ex.Kind}).", ex.InnerException ?? ex);
                Announce(Messages.ForScanError(ex.Kind));
                return;
            }
            catch (Exception ex)
            {
                log.Error("Scan failed (unexpected).", ex);
                Announce(Messages.ForScanError(ScanErrorKind.General));
                return;
            }

            Announce(Messages.Recognizing, interrupt: false);
            RecognitionResult result;
            try
            {
                result = await recognizer.RecognizeAsync(scanned);
            }
            catch (OcrUnavailableException ex)
            {
                log.Error("OCR unavailable.", ex);
                Announce(Messages.OcrMissing);
                return;
            }
            catch (Exception ex)
            {
                log.Error("OCR failed.", ex);
                Announce(Messages.OcrFailed);
                return;
            }
            log.Info($"Recognised page {number}: {result.Text.Length} characters, quality {result.Quality}, " +
                     $"rotation {result.RotationDegrees}, looks blank {result.ImageLooksBlank}.");

            var page = new Page(number, result.Text);
            if (!page.HasWords)
            {
                TryDelete(scanned);
                Announce(result.ImageLooksBlank ? Messages.BlankPage : Messages.NoTextFound);
                return;
            }

            document.Pages.Add(page);
            if (!settings.KeepImages) TryDelete(scanned);
            bool saved = true;
            try { documents.SavePage(document, page); }
            catch (Exception ex) { log.Error("Saving page failed.", ex); saved = false; }

            pageIndex = PageCount - 1;
            wordIndex = 0;
            SaveState(force: true);

            var intro = new List<string>();
            if (!saved) intro.Add(Messages.SaveFailed);
            if (result.Quality == TextQuality.Poor) intro.Add(Messages.PoorQuality);
            intro.Add(Messages.PageReading(CurrentPageNumber));

            IsBusy = false;
            reminder.Cancel();
            Announce(string.Join(" ", intro));
            reading = true;
            ReadCurrent();
        }
        finally
        {
            IsBusy = false;
            reminder.Cancel();
            RaiseChanged();
        }
    }

    private async Task RemindWhileBusyAsync(CancellationToken ct)
    {
        try
        {
            while (true)
            {
                await Task.Delay(TimeSpan.FromSeconds(settings.StillWorkingSeconds), ct);
                if (ct.IsCancellationRequested || !IsBusy) return;
                speech.Say(Messages.StillWorking);
            }
        }
        catch (OperationCanceledException)
        {
        }
    }

    // ------------------------------------------------------------------ reading

    private void StartReading()
    {
        if (!EnsurePages()) return;
        speech.Stop();
        reading = true;
        ReadCurrent();
        RaiseChanged();
    }

    private void Pause()
    {
        StopReading();
        SaveState(force: true);
        Announce(Messages.Paused);
    }

    private void StopReading()
    {
        reading = false;
        readToken++;
    }

    private void ReadCurrent()
    {
        var page = document.Pages[pageIndex];
        int token = ++readToken;
        int startChar = page.Words[wordIndex].Start;
        speech.Read(page.Text[startChar..],
            offset =>
            {
                if (token != readToken) return;
                int w = page.WordIndexAtChar(startChar + Math.Max(0, offset));
                if (w == wordIndex) return;
                wordIndex = w;
                SaveState(force: false);
                RaiseChanged();
            },
            () =>
            {
                if (token != readToken) return;
                OnPageFinished();
            });
    }

    private void OnPageFinished()
    {
        if (pageIndex < PageCount - 1)
        {
            pageIndex++;
            wordIndex = 0;
            SaveState(force: true);
            Announce(Messages.PageHeading(CurrentPageNumber), interrupt: false);
            ReadCurrent();
        }
        else
        {
            reading = false;
            wordIndex = 0;
            SaveState(force: true);
            Announce(Messages.EndOfLastPage(CurrentPageNumber), interrupt: false);
        }
    }

    // ------------------------------------------------------------------ navigation

    private void MoveWord(int delta)
    {
        if (!EnsurePages()) return;
        StopReading();
        var page = document.Pages[pageIndex];
        int target = wordIndex + delta;
        if (target < 0) { Announce(Messages.StartOfPage); return; }
        if (target >= page.Words.Count) { Announce(Messages.EndOfPage); return; }
        wordIndex = target;
        SaveState(force: true);
        SpeakContent(page.WordText(wordIndex));
    }

    private void MoveLine(int delta)
    {
        if (!EnsurePages()) return;
        StopReading();
        var page = document.Pages[pageIndex];
        int target = page.LineOfWord(wordIndex) + delta;
        if (target < 0) { wordIndex = 0; SaveState(force: true); Announce(Messages.TopOfPage); return; }
        if (target >= page.Lines.Count) { Announce(Messages.BottomOfPage); return; }
        wordIndex = page.Lines[target].FirstWord;
        SaveState(force: true);
        SpeakContent(page.LineText(target));
    }

    private void MovePage(int delta)
    {
        if (!EnsurePages()) return;
        StopReading();
        int target = pageIndex + delta;
        if (target < 0) { Announce(Messages.FirstPageAlready); return; }
        if (target >= PageCount) { Announce(Messages.LastPageAlready); return; }
        pageIndex = target;
        wordIndex = 0;
        SaveState(force: true);
        Announce(Messages.PageOf(CurrentPageNumber, PageCount));
        reading = true;
        ReadCurrent();
    }

    // ------------------------------------------------------------------ other commands

    private void NewDocument()
    {
        StopReading();
        if (now() <= newDocumentDeadline)
        {
            newDocumentDeadline = DateTime.MinValue;
            document = documents.CreateNew();
            pageIndex = 0;
            wordIndex = 0;
            SaveState(force: true);
            Announce(Messages.NewDocumentStarted);
        }
        else
        {
            newDocumentDeadline = now() + NewDocumentConfirmWindow;
            Announce(Messages.ConfirmNewDocument);
        }
    }

    private void ChangeRate(int delta)
    {
        int rate = Math.Clamp(speech.Rate + delta, -10, 10);
        bool wasReading = reading;
        StopReading();
        if (rate == speech.Rate)
        {
            Announce(delta < 0 ? Messages.Slowest : Messages.Fastest);
        }
        else
        {
            speech.Rate = rate;
            SaveState(force: true);
            Announce(delta < 0 ? Messages.Slower : Messages.Faster);
        }
        if (wasReading && PageCount > 0)
        {
            reading = true;
            ReadCurrent();
        }
    }

    // ------------------------------------------------------------------ helpers

    private bool EnsurePages()
    {
        if (PageCount > 0) return true;
        StopReading();
        Announce(Messages.NothingToRead);
        return false;
    }

    /// <summary>Speak a message and show it on screen.</summary>
    private void Announce(string message, bool interrupt = true)
    {
        if (interrupt) speech.Stop();
        LastMessage = message;
        log.Info("Said: " + message);
        speech.Say(message);
        RaiseChanged();
    }

    /// <summary>Speak a word or line of the document (not shown as a message).</summary>
    private void SpeakContent(string text)
    {
        speech.Stop();
        speech.Say(text);
        RaiseChanged();
    }

    private void SaveState(bool force)
    {
        var t = now();
        if (!force && t - lastSaved < SaveThrottle) return;
        lastSaved = t;
        try
        {
            stateStore.Save(new ReaderState
            {
                DocumentFolder = document.Folder,
                PageIndex = pageIndex,
                WordIndex = wordIndex,
                SpeechRate = speech.Rate,
            });
        }
        catch (Exception ex)
        {
            log.Error("Saving reading position failed.", ex);
        }
    }

    private void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (Exception ex) { log.Error("Could not delete " + path, ex); }
    }

    private void RaiseChanged() => Changed?.Invoke();
}
