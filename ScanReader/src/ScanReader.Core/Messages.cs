namespace ScanReader.Core;

/// <summary>
/// Every sentence the program speaks, in one place, so the wording can be
/// reviewed (or translated) without touching any logic. Keep sentences short
/// and concrete: say what happened and what to do next.
/// </summary>
public static class Messages
{
    public const string Ready = "Scanner reader is ready.";
    public const string PlaceFirstPage = "Put a page face down on the scanner glass, close the lid, and press F5.";
    public static string ResumeSession(int pageCount, int currentPage) =>
        $"You have {Pages(pageCount)} from last time. You are on page {currentPage}. " +
        "Press Space to continue reading, or press F5 to scan another page.";

    public const string Scanning = "Scanning.";
    public const string Recognizing = "Recognizing text.";
    public static string PageReading(int pageNumber) => $"Page {pageNumber}. Reading.";
    public const string StillWorking = "Still working. Please wait.";
    public const string PleaseWait = "Please wait. I am still working on the page.";

    public const string Paused = "Paused.";
    public const string NothingToRead = "There is nothing to read yet. " + PlaceFirstPage;
    public static string PageHeading(int pageNumber) => $"Page {pageNumber}.";
    public static string PageOf(int pageNumber, int pageCount) => $"Page {pageNumber} of {pageCount}.";
    public static string EndOfLastPage(int pageNumber) =>
        $"End of page {pageNumber}. That was the last page. Press F5 to scan another page, or Space to hear this page again.";

    public const string StartOfPage = "Beginning of the page.";
    public const string EndOfPage = "End of the page.";
    public const string TopOfPage = "Top of the page.";
    public const string BottomOfPage = "Bottom of the page.";
    public const string FirstPageAlready = "This is the first page.";
    public const string LastPageAlready = "This is the last page. Press F5 to scan another page.";

    public const string Slower = "Slower.";
    public const string Faster = "Faster.";
    public const string Slowest = "This is the slowest speed.";
    public const string Fastest = "This is the fastest speed.";

    public const string ConfirmNewDocument =
        "To start a new document, press Control N again. Your pages so far are saved.";
    public const string NewDocumentStarted = "New document started. " + PlaceFirstPage;

    public const string UnknownKey = "That key does nothing. Press F1 for help.";

    public static string Help(int pageCount, int currentPage) =>
        (pageCount == 0 ? "No pages scanned yet. " : $"You are on page {currentPage} of {pageCount}. ") +
        "Here are the keys. F5 scans a page. Space starts or pauses reading. " +
        "Left and Right arrows move one word. Up and Down arrows move one line. " +
        "Page Up and Page Down go to the previous or next page. Escape stops speaking. " +
        "Minus and Plus make the voice slower or faster. Control N starts a new document. " +
        "F1 repeats this help.";

    // ----- problems with the page ------------------------------------------------
    public const string BlankPage =
        "The page looks blank. Please put the page face down on the glass, with the printed side touching the glass, and press F5 again.";
    public const string NoTextFound =
        "I could not find any text on this page. The page may be face up, or it may be a picture or handwriting. Please check the page and press F5 again.";
    public const string PoorQuality =
        "I could only read part of this page, so some words may be wrong. The page may be crooked, faint, or handwritten.";

    // ----- problems with the computer ----------------------------------------------
    public const string OcrMissing =
        "Text recognition is not installed on this computer. Please ask your helper to add the optical character recognition feature for your language in Windows Settings.";
    public const string OcrFailed =
        "Something went wrong while recognizing the text. Please press F5 to try again.";
    public const string ScannerNotFoundAtStart =
        "I cannot find the scanner at the moment. Please check that the scanner cable is plugged into the computer.";
    public const string SaveFailed =
        "I could not save this page, but I will read it to you. Please tell your helper.";
    public const string CannotPrepareFolder =
        "I cannot save scanned pages, so I did not scan. Please ask your helper to check the Documents folder.";
    public const string UnexpectedError =
        "Something unexpected went wrong. Please try again. If it keeps happening, ask your helper.";
    public const string AlreadyRunning = "The scanner reader is already open.";
    public const string Goodbye = "Scanner reader is closing. Goodbye.";

    public static string ForScanError(ScanErrorKind kind) => kind switch
    {
        ScanErrorKind.NotFound =>
            "I cannot find the scanner. Please check that the scanner cable is plugged into the computer, then press F5 to try again.",
        ScanErrorKind.Busy =>
            "The scanner is busy. Please wait a moment, then press F5 to try again.",
        ScanErrorKind.Disconnected =>
            "I lost contact with the scanner. Please check that the cable is plugged in, then press F5 to try again.",
        ScanErrorKind.WarmingUp =>
            "The scanner is warming up. Please wait a few seconds, then press F5 again.",
        ScanErrorKind.CoverOpen =>
            "The scanner lid seems to be open. Please close it and press F5 again.",
        ScanErrorKind.Timeout =>
            "The scanner is not responding. Please unplug the scanner cable, plug it back in, wait ten seconds, and press F5 again.",
        ScanErrorKind.WiaUnavailable =>
            "The Windows scanning service is not working. Please ask your helper for assistance.",
        _ =>
            "Something went wrong while scanning. Please press F5 to try again. If this keeps happening, ask your helper.",
    };

    private static string Pages(int n) => n == 1 ? "1 page" : $"{n} pages";
}
