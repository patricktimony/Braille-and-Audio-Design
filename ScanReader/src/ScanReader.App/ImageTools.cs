using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

namespace ScanReader;

/// <summary>Image helpers built on System.Drawing (GDI+, part of Windows).</summary>
internal static class ImageTools
{
    /// <summary>Loads an image fully into memory so the file is not kept locked.</summary>
    public static Bitmap Load(string path)
    {
        using var stream = new MemoryStream(File.ReadAllBytes(path));
        using var image = Image.FromStream(stream);
        return new Bitmap(image); // 32 bpp ARGB copy
    }

    /// <summary>Converts any image format GDI+ understands (BMP, TIFF, JPEG, PNG) to PNG.</summary>
    public static void ConvertToPng(string sourcePath, string pngPath)
    {
        using var stream = new MemoryStream(File.ReadAllBytes(sourcePath));
        using var image = Image.FromStream(stream);
        var tmp = pngPath + ".tmp";
        image.Save(tmp, ImageFormat.Png);
        File.Move(tmp, pngPath, overwrite: true);
    }

    /// <summary>Returns a resized copy if either side is larger than <paramref name="maxDimension"/>; otherwise null.</summary>
    public static Bitmap? ShrinkToFit(Bitmap source, int maxDimension)
    {
        int longest = Math.Max(source.Width, source.Height);
        if (longest <= maxDimension) return null;
        double scale = (double)maxDimension / longest;
        return Resize(source, Math.Max(1, (int)(source.Width * scale)), Math.Max(1, (int)(source.Height * scale)), PixelFormat.Format32bppArgb);
    }

    /// <summary>Grayscale bytes of a reduced copy, for the blank-page check.</summary>
    public static (byte[] Pixels, int Width, int Height) Luminance(Bitmap source, int maxWidth = 1000)
    {
        double scale = Math.Min(1.0, (double)maxWidth / source.Width);
        int w = Math.Max(1, (int)(source.Width * scale)), h = Math.Max(1, (int)(source.Height * scale));
        using var small = Resize(source, w, h, PixelFormat.Format24bppRgb);
        var data = small.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
        try
        {
            var row = new byte[data.Stride];
            var lum = new byte[w * h];
            for (int y = 0; y < h; y++)
            {
                Marshal.Copy(data.Scan0 + y * data.Stride, row, 0, data.Stride);
                for (int x = 0; x < w; x++)
                {
                    int b = row[x * 3], g = row[x * 3 + 1], r = row[x * 3 + 2];
                    lum[y * w + x] = (byte)((r * 299 + g * 587 + b * 114) / 1000);
                }
            }
            return (lum, w, h);
        }
        finally
        {
            small.UnlockBits(data);
        }
    }

    /// <summary>Raw pixels in B,G,R,A order with no row padding (what Windows OCR's Bgra8 format expects).</summary>
    public static byte[] ToBgra32(Bitmap source)
    {
        int w = source.Width, h = source.Height;
        var data = source.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            var pixels = new byte[w * h * 4];
            for (int y = 0; y < h; y++)
                Marshal.Copy(data.Scan0 + y * data.Stride, pixels, y * w * 4, w * 4);
            return pixels;
        }
        finally
        {
            source.UnlockBits(data);
        }
    }

    private static Bitmap Resize(Bitmap source, int w, int h, PixelFormat format)
    {
        var result = new Bitmap(w, h, format);
        using var g = Graphics.FromImage(result);
        g.InterpolationMode = InterpolationMode.HighQualityBilinear;
        g.Clear(Color.White);
        g.DrawImage(source, new Rectangle(0, 0, w, h));
        return result;
    }
}
