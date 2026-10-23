namespace ScanReader.Core;

public enum TextQuality { None, Poor, Fair, Good }

/// <summary>
/// Rough judgement of whether OCR output is real text or noise. Windows OCR
/// gives no confidence score, so this looks at how many tokens resemble words.
/// It is used to (a) try other page orientations when the page was put on the
/// glass upside down or sideways and (b) warn the listener when the result is poor.
/// </summary>
public static class TextQualityScorer
{
    /// <summary>Higher is better: the number of letters/digits that sit in plausible words.</summary>
    public static int Score(string text)
    {
        int score = 0;
        foreach (var token in Tokens(text))
        {
            var core = Trim(token);
            if (IsPlausibleWord(core) || IsNumber(core)) score += core.Length;
        }
        return score;
    }

    public static TextQuality Classify(string text)
    {
        int total = 0, plausible = 0;
        foreach (var token in Tokens(text))
        {
            total++;
            var core = Trim(token);
            if (IsPlausibleWord(core) || IsNumber(core)) plausible++;
        }
        if (total == 0) return TextQuality.None;
        double ratio = (double)plausible / total;
        // Judged by proportion only, so a short page ("Thank you") is not called poor.
        if (ratio < 0.5) return TextQuality.Poor;
        if (ratio < 0.75) return TextQuality.Fair;
        return TextQuality.Good;
    }

    /// <summary>
    /// True when the text is clearly real text. Short results are never "confident",
    /// because an upside-down page can produce a few word-like fragments by chance.
    /// </summary>
    public static bool IsConfident(string text) => Classify(text) == TextQuality.Good && Score(text) >= 40;

    private static IEnumerable<string> Tokens(string text) =>
        (text ?? "").Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);

    private static string Trim(string token) =>
        token.Trim('.', ',', ';', ':', '!', '?', '"', '\'', '(', ')', '[', ']', '“', '”', '‘', '’', '«', '»', '-', '–', '—');

    private static bool IsNumber(string s)
    {
        if (s.Length == 0) return false;
        int digits = 0;
        foreach (var c in s)
        {
            if (char.IsDigit(c)) digits++;
            else if (c is not ('.' or ',' or '/' or ':' or '%' or '$' or '£' or '€')) return false;
        }
        return digits > 0;
    }

    private static bool IsPlausibleWord(string s)
    {
        if (s.Length == 0) return false;
        if (s.Length == 1) return s is "a" or "A" or "I" || (char.IsLetter(s[0]) && s[0] > 127);
        bool vowel = false;
        int upperAfterLower = 0;
        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (char.IsLetter(c))
            {
                if ("aeiouyAEIOUY".Contains(c) || c > 127) vowel = true;
                if (i > 0 && char.IsUpper(c) && char.IsLower(s[i - 1])) upperAfterLower++;
            }
            else if (!((c == '\'' || c == '’' || c == '-') && i > 0 && i < s.Length - 1))
            {
                return false;
            }
        }
        // "McDonald" is fine; "tHiS" style noise is not.
        return vowel && upperAfterLower <= 1;
    }
}
