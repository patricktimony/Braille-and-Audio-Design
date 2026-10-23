using System.Drawing;
using System.Runtime.InteropServices.WindowsRuntime;
using ScanReader.Core;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using WinLanguage = Windows.Globalization.Language;

namespace ScanReader;

/// <summary>
/// Offline text recognition with Windows.Media.Ocr, the OCR engine that is part
/// of Windows 10 and 11. It works without internet, but only for languages
/// whose "Optical character recognition" feature is installed in Windows
/// (normally installed together with the Windows display language).
///
/// If the page was put on the glass upside down or sideways the result is
/// mostly noise, so in that case the other three orientations are tried and
/// the best one is kept.
/// </summary>
internal sealed class WindowsOcrRecognizer(ReaderSettings settings, ILog log) : IPageRecognizer
{
    public string? CheckAvailability()
    {
        try
        {
            var engine = CreateEngine(out string? problem);
            if (engine == null) return problem;
            log.Info($"OCR language: {engine.RecognizerLanguage.LanguageTag}; max image size {OcrEngine.MaxImageDimension} px.");
            return null;
        }
        catch (Exception ex)
        {
            // e.g. the Windows Runtime OCR component itself is missing.
            return $"{ex.GetType().Name}: {ex.Message}";
        }
    }

    public Task<RecognitionResult> RecognizeAsync(string imagePath) =>
        // Off the UI thread, so the keyboard keeps working while pages are processed.
        Task.Run(() => RecognizeCoreAsync(imagePath));

    private async Task<RecognitionResult> RecognizeCoreAsync(string imagePath)
    {
        var engine = CreateEngine(out string? problem) ?? throw new OcrUnavailableException(problem ?? "No OCR engine.");

        using var original = ImageTools.Load(imagePath);
        var (lum, lw, lh) = ImageTools.Luminance(original);
        bool looksBlank = BlankPageDetector.LooksBlank(lum, lw, lh);

        using var shrunk = ImageTools.ShrinkToFit(original, (int)OcrEngine.MaxImageDimension);
        var source = shrunk ?? original;

        string bestText = await RecognizeAsync(engine, source, RotateFlipType.RotateNoneFlipNone);
        int bestRotation = 0;

        if (!TextQualityScorer.IsConfident(bestText))
        {
            foreach (var (flip, degrees) in new[]
                     {
                         (RotateFlipType.Rotate180FlipNone, 180),
                         (RotateFlipType.Rotate90FlipNone, 90),
                         (RotateFlipType.Rotate270FlipNone, 270),
                     })
            {
                string text = await RecognizeAsync(engine, source, flip);
                // Switch only on a clear improvement, so noise does not win by chance.
                if (TextQualityScorer.Score(text) > TextQualityScorer.Score(bestText) * 3 / 2 + 10)
                {
                    bestText = text;
                    bestRotation = degrees;
                }
                if (TextQualityScorer.IsConfident(bestText)) break;
            }
        }

        return new RecognitionResult(bestText, looksBlank, TextQualityScorer.Classify(bestText), bestRotation);
    }

    private static async Task<string> RecognizeAsync(OcrEngine engine, Bitmap source, RotateFlipType flip)
    {
        using var rotated = (Bitmap)source.Clone();
        if (flip != RotateFlipType.RotateNoneFlipNone) rotated.RotateFlip(flip);

        byte[] pixels = ImageTools.ToBgra32(rotated);
        using var bitmap = SoftwareBitmap.CreateCopyFromBuffer(
            pixels.AsBuffer(), BitmapPixelFormat.Bgra8, rotated.Width, rotated.Height, BitmapAlphaMode.Premultiplied);

        OcrResult result = await engine.RecognizeAsync(bitmap);
        return string.Join("\n", result.Lines.Select(l => l.Text));
    }

    private OcrEngine? CreateEngine(out string? problem)
    {
        problem = null;
        OcrEngine? engine = null;
        if (!string.IsNullOrWhiteSpace(settings.OcrLanguage))
        {
            var language = new WinLanguage(settings.OcrLanguage);
            if (OcrEngine.IsLanguageSupported(language)) engine = OcrEngine.TryCreateFromLanguage(language);
            else log.Error($"OCR language '{settings.OcrLanguage}' from settings.json is not installed.");
        }

        engine ??= OcrEngine.TryCreateFromUserProfileLanguages();

        if (engine == null)
        {
            // The display language has no OCR pack, but another installed language might.
            var available = OcrEngine.AvailableRecognizerLanguages;
            if (available.Count > 0) engine = OcrEngine.TryCreateFromLanguage(available[0]);
        }

        if (engine == null) problem = "No OCR language is installed (OcrEngine.AvailableRecognizerLanguages is empty).";
        return engine;
    }
}
