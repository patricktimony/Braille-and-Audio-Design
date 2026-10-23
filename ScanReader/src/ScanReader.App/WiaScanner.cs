using System.Runtime.InteropServices;
using ScanReader.Core;

namespace ScanReader;

/// <summary>
/// Scans through Windows Image Acquisition (WIA 2.0), the scanner system built
/// into Windows. The "WIA Automation" COM library (wiaaut.dll) ships with
/// Windows, so nothing is installed.
///
/// Unlike WIA.CommonDialog.ShowAcquireImage (which was used in the first test),
/// this talks to the device directly and calls Item.Transfer, so no dialog
/// appears. WIA requires a single-threaded apartment, so each scan runs on its
/// own STA thread; that also lets us give up on a hung driver after a timeout.
/// </summary>
internal sealed class WiaScanner(ReaderSettings settings, ILog log) : IScanner
{
    private const string FormatBmp = "{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}";
    private const int ScannerDeviceType = 1;

    // WIA property IDs (wiadef.h)
    private const int CurrentIntent = 6146;       // WIA_IPS_CUR_INTENT
    private const int HorizontalResolution = 6147; // WIA_IPS_XRES
    private const int VerticalResolution = 6148;   // WIA_IPS_YRES
    private const int HorizontalStart = 6149;      // WIA_IPS_XPOS
    private const int VerticalStart = 6150;        // WIA_IPS_YPOS
    private const int HorizontalExtent = 6151;     // WIA_IPS_XEXTENT
    private const int VerticalExtent = 6152;       // WIA_IPS_YEXTENT
    private const int IntentColor = 1, IntentGrayscale = 2;

    public Task<bool> IsScannerConnectedAsync() =>
        RunOnStaThread<bool>(() =>
        {
            dynamic manager = CreateDeviceManager();
            try { return (object?)FindScanner(manager, out string _) != null; }
            finally { Release(manager); }
        }, TimeSpan.FromSeconds(15));

    public Task<string> ScanPageAsync(string outputPngPath) =>
        RunOnStaThread(() => Scan(outputPngPath), TimeSpan.FromSeconds(settings.ScanTimeoutSeconds));

    private string Scan(string outputPngPath)
    {
        dynamic manager = CreateDeviceManager();
        dynamic? device = null, item = null, image = null;
        string transferPath = outputPngPath + ".transfer";
        try
        {
            dynamic info = FindScanner(manager, out string name)
                ?? throw new ScanException(ScanErrorKind.NotFound, "No WIA scanner device is listed.");
            log.Info("Scanning with " + name);
            device = info.Connect();
            dynamic items = device.Items;
            if ((int)items.Count < 1) throw new ScanException(ScanErrorKind.General, "Scanner has no items.");
            item = items[1];

            // The intent must be set first: some drivers reset other properties when it changes.
            SetProperty(item, CurrentIntent, settings.ScanInColor ? IntentColor : IntentGrayscale);
            SetProperty(item, HorizontalResolution, settings.ScanDpi);
            SetProperty(item, VerticalResolution, settings.ScanDpi);
            SetProperty(item, HorizontalStart, 0);
            SetProperty(item, VerticalStart, 0);
            // Extents are in pixels at the current resolution; use the whole glass.
            SetPropertyToMaximum(item, HorizontalExtent);
            SetPropertyToMaximum(item, VerticalExtent);

            image = item.Transfer(FormatBmp);
            string extension = (string)image.FileExtension;
            transferPath = outputPngPath + ".transfer." + (string.IsNullOrEmpty(extension) ? "bmp" : extension);
            if (File.Exists(transferPath)) File.Delete(transferPath);
            image.SaveFile(transferPath);
            log.Info($"Scanned {(int)image.Width} x {(int)image.Height} pixels.");
        }
        catch (COMException ex)
        {
            throw new ScanException(Classify(ex.HResult), $"WIA error 0x{ex.HResult:X8}", ex);
        }
        finally
        {
            Release(image);
            Release(item);
            Release(device);
            Release(manager);
        }

        try
        {
            ImageTools.ConvertToPng(transferPath, outputPngPath);
        }
        finally
        {
            try { File.Delete(transferPath); } catch (IOException) { }
        }
        return outputPngPath;
    }

    private static dynamic CreateDeviceManager()
    {
        var type = Type.GetTypeFromProgID("WIA.DeviceManager", throwOnError: false)
            ?? throw new ScanException(ScanErrorKind.WiaUnavailable, "WIA.DeviceManager is not registered.");
        try
        {
            return Activator.CreateInstance(type)
                ?? throw new ScanException(ScanErrorKind.WiaUnavailable, "WIA.DeviceManager could not be created.");
        }
        catch (COMException ex)
        {
            throw new ScanException(ScanErrorKind.WiaUnavailable, $"WIA.DeviceManager failed 0x{ex.HResult:X8}", ex);
        }
    }

    private static dynamic? FindScanner(dynamic manager, out string name)
    {
        name = "";
        dynamic infos = manager.DeviceInfos;
        int count = infos.Count;
        for (int i = 1; i <= count; i++)
        {
            dynamic info = infos[i];
            if ((int)info.Type != ScannerDeviceType) continue;
            try { name = (string)info.Properties["Name"].Value; } catch (Exception) { name = "scanner"; }
            return info;
        }
        return null;
    }

    private static dynamic? FindProperty(dynamic item, int id)
    {
        dynamic props = item.Properties;
        int count = props.Count;
        for (int i = 1; i <= count; i++)
        {
            dynamic p = props[i];
            if ((int)p.PropertyID == id) return p;
        }
        return null;
    }

    private void SetProperty(dynamic item, int id, int value)
    {
        try
        {
            dynamic? p = FindProperty(item, id);
            if (p == null) { log.Info($"WIA property {id} not offered by this scanner."); return; }
            p.Value = value;
        }
        catch (Exception ex)
        {
            log.Error($"Could not set WIA property {id} to {value}.", ex);
        }
    }

    private void SetPropertyToMaximum(dynamic item, int id)
    {
        try
        {
            dynamic? p = FindProperty(item, id);
            if (p == null) return;
            p.Value = (int)p.SubTypeMax;
        }
        catch (Exception ex)
        {
            log.Error($"Could not set WIA property {id} to its maximum.", ex);
        }
    }

    /// <summary>WIA error codes from wiadef.h.</summary>
    internal static ScanErrorKind Classify(int hresult) => unchecked((uint)hresult) switch
    {
        0x80210015 => ScanErrorKind.NotFound,      // WIA_S_NO_DEVICE_AVAILABLE
        0x80210006 => ScanErrorKind.Busy,          // WIA_ERROR_BUSY
        0x8021000D => ScanErrorKind.Busy,          // WIA_ERROR_DEVICE_LOCKED
        0x80210005 => ScanErrorKind.Disconnected,  // WIA_ERROR_OFFLINE
        0x8021000A => ScanErrorKind.Disconnected,  // WIA_ERROR_DEVICE_COMMUNICATION
        0x80210009 => ScanErrorKind.Disconnected,  // WIA_ERROR_ITEM_DELETED
        0x80210007 => ScanErrorKind.WarmingUp,     // WIA_ERROR_WARMING_UP
        0x80210016 => ScanErrorKind.CoverOpen,     // WIA_ERROR_COVER_OPEN
        0x80040154 => ScanErrorKind.WiaUnavailable,// REGDB_E_CLASSNOTREG
        0x80070422 => ScanErrorKind.WiaUnavailable,// service disabled
        _ => ScanErrorKind.General,
    };

    private static void Release(object? comObject)
    {
        if (comObject != null && Marshal.IsComObject(comObject))
        {
            try { Marshal.FinalReleaseComObject(comObject); } catch (Exception) { }
        }
    }

    private Task<T> RunOnStaThread<T>(Func<T> work, TimeSpan timeout)
    {
        var tcs = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            try { tcs.TrySetResult(work()); }
            catch (Exception ex) { tcs.TrySetException(ex); }
        })
        {
            IsBackground = true,
            Name = "WIA",
        };
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        return WithTimeout(tcs.Task, timeout);
    }

    private async Task<T> WithTimeout<T>(Task<T> task, TimeSpan timeout)
    {
        if (await Task.WhenAny(task, Task.Delay(timeout)) == task) return await task;
        log.Error($"Scanner did not respond within {timeout.TotalSeconds} seconds.");
        // The stuck thread is a background thread; it ends when the program closes.
        _ = task.ContinueWith(t => _ = t.Exception, TaskScheduler.Default);
        throw new ScanException(ScanErrorKind.Timeout, "Scanner timed out.");
    }
}
