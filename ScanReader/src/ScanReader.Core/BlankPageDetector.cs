namespace ScanReader.Core;

/// <summary>
/// Decides whether a scanned image is (almost) uniform, i.e. a blank page or an
/// empty glass. Only used to choose the right spoken message when OCR finds no
/// text; it never stops a page from being recognised.
/// </summary>
public static class BlankPageDetector
{
    /// <param name="luminance">One byte per pixel, row by row, 0 = black, 255 = white.</param>
    public static bool LooksBlank(ReadOnlySpan<byte> luminance, int width, int height)
    {
        if (width <= 0 || height <= 0 || luminance.Length < width * height) return true;

        // Ignore a 3% margin: scanner glass edges often show a dark strip.
        int mx = width * 3 / 100, my = height * 3 / 100;
        var histogram = new int[256];
        int count = 0;
        for (int y = my; y < height - my; y++)
        {
            int row = y * width;
            for (int x = mx; x < width - mx; x++) { histogram[luminance[row + x]]++; count++; }
        }
        if (count == 0) return true;

        int median = 0;
        for (int acc = 0; median < 256; median++)
        {
            acc += histogram[median];
            if (acc * 2 >= count) break;
        }

        int different = 0;
        for (int v = 0; v < 256; v++)
            if (Math.Abs(v - median) > 64) different += histogram[v];

        // Printed text covers several percent of a page; 0.2% is dust and noise.
        return different < count * 0.002;
    }
}
