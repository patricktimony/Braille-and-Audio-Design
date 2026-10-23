namespace ScanReader.Core;

/// <summary>A word inside <see cref="Page.Text"/>.</summary>
public readonly record struct WordSpan(int Start, int Length, int Line);

/// <summary>A line of text: the words <see cref="FirstWord"/>..<see cref="LastWord"/>.</summary>
public readonly record struct LineSpan(int FirstWord, int LastWord, int Start, int Length);

/// <summary>
/// One scanned page of recognised text, split into lines and words so the
/// reader can move by word and by line. Lines that contain no words are
/// ignored for navigation.
/// </summary>
public sealed class Page
{
    public Page(int number, string text)
    {
        Number = number;
        Text = (text ?? "").Replace("\r\n", "\n").Replace('\r', '\n');

        var words = new List<WordSpan>();
        var lines = new List<LineSpan>();
        int lineStart = 0;
        while (lineStart <= Text.Length)
        {
            int lineEnd = Text.IndexOf('\n', lineStart);
            if (lineEnd < 0) lineEnd = Text.Length;

            int firstWord = words.Count;
            int i = lineStart;
            while (i < lineEnd)
            {
                while (i < lineEnd && char.IsWhiteSpace(Text[i])) i++;
                int start = i;
                while (i < lineEnd && !char.IsWhiteSpace(Text[i])) i++;
                if (i > start) words.Add(new WordSpan(start, i - start, lines.Count));
            }
            if (words.Count > firstWord)
            {
                int s = words[firstWord].Start;
                var last = words[^1];
                lines.Add(new LineSpan(firstWord, words.Count - 1, s, last.Start + last.Length - s));
            }
            lineStart = lineEnd + 1;
        }
        Words = words;
        Lines = lines;
    }

    /// <summary>File number of the page (Page 003.txt has number 3).</summary>
    public int Number { get; }

    public string Text { get; }
    public IReadOnlyList<WordSpan> Words { get; }
    public IReadOnlyList<LineSpan> Lines { get; }
    public bool HasWords => Words.Count > 0;

    public string WordText(int wordIndex)
    {
        var w = Words[wordIndex];
        return Text.Substring(w.Start, w.Length);
    }

    public string LineText(int lineIndex)
    {
        var l = Lines[lineIndex];
        return Text.Substring(l.Start, l.Length);
    }

    public int LineOfWord(int wordIndex) => Words[wordIndex].Line;

    /// <summary>The word that contains (or most recently started before) a character position.</summary>
    public int WordIndexAtChar(int charIndex)
    {
        int lo = 0, hi = Words.Count - 1, found = 0;
        while (lo <= hi)
        {
            int mid = (lo + hi) / 2;
            if (Words[mid].Start <= charIndex) { found = mid; lo = mid + 1; }
            else hi = mid - 1;
        }
        return found;
    }
}

/// <summary>The pages scanned into one document folder.</summary>
public sealed class ReadingDocument
{
    public ReadingDocument(string folder, IEnumerable<Page>? pages = null)
    {
        Folder = folder;
        Pages = new List<Page>(pages ?? []);
    }

    public string Folder { get; }
    public List<Page> Pages { get; }

    /// <summary>Number for the next page file; never reuses an existing number.</summary>
    public int NextPageNumber => Pages.Count == 0 ? 1 : Pages.Max(p => p.Number) + 1;
}
