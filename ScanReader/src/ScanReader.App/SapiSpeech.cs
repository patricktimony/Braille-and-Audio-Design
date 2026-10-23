using System.Globalization;
using System.Media;
using System.Speech.Synthesis;
using ScanReader.Core;

namespace ScanReader;

/// <summary>
/// Speech through SAPI 5, the speech system built into Windows, using the
/// System.Speech library from Microsoft. Windows 11 English includes the voices
/// "Microsoft David Desktop" and "Microsoft Zira Desktop". No voice is downloaded.
///
/// Pause is done by stopping and later restarting from the remembered word,
/// which is more reliable than SAPI's own pause/resume.
/// </summary>
internal sealed class SapiSpeech : ISpeech, IDisposable
{
    private readonly SpeechSynthesizer synth = new();
    private readonly Control ui;
    private readonly ILog log;
    private Prompt? readPrompt;
    private Action<int>? onPosition;
    private Action? onFinished;

    public SapiSpeech(Control ui, string voiceName, string preferredCulture, ILog log)
    {
        this.ui = ui;
        this.log = log;

        List<InstalledVoice> voices;
        try
        {
            synth.SetOutputToDefaultAudioDevice();
            voices = synth.GetInstalledVoices().Where(v => v.Enabled).ToList();
        }
        catch (Exception ex)
        {
            log.Error("Speech could not start.", ex);
            voices = [];
        }

        IsAvailable = voices.Count > 0;
        if (!IsAvailable) return;

        foreach (var v in voices) log.Info($"Voice available: {v.VoiceInfo.Name} ({v.VoiceInfo.Culture.Name})");

        var chosen =
            voices.FirstOrDefault(v => string.Equals(v.VoiceInfo.Name, voiceName, StringComparison.OrdinalIgnoreCase)) ??
            voices.FirstOrDefault(v => v.VoiceInfo.Culture.Name.Equals(preferredCulture, StringComparison.OrdinalIgnoreCase)) ??
            voices.FirstOrDefault(v => v.VoiceInfo.Culture.TwoLetterISOLanguageName ==
                                       SafeCulture(preferredCulture).TwoLetterISOLanguageName);
        if (chosen != null)
        {
            try { synth.SelectVoice(chosen.VoiceInfo.Name); }
            catch (Exception ex) { log.Error("Could not select voice " + chosen.VoiceInfo.Name, ex); }
        }
        log.Info("Using voice: " + synth.Voice.Name);
        synth.Volume = 100;

        synth.SpeakProgress += (_, e) => OnUi(() =>
        {
            if (readPrompt != null && ReferenceEquals(e.Prompt, readPrompt)) onPosition?.Invoke(e.CharacterPosition);
        });
        synth.SpeakCompleted += (_, e) => OnUi(() =>
        {
            if (readPrompt == null || !ReferenceEquals(e.Prompt, readPrompt)) return;
            var finished = onFinished;
            ClearRead();
            if (!e.Cancelled && e.Error == null) finished?.Invoke();
            else if (e.Error != null) log.Error("Speech error.", e.Error);
        });
    }

    public bool IsAvailable { get; }

    public string VoiceName => IsAvailable ? synth.Voice.Name : "(none)";

    public int Rate
    {
        get => synth.Rate;
        set => synth.Rate = Math.Clamp(value, -10, 10);
    }

    public void Say(string text)
    {
        if (!IsAvailable) { SystemSounds.Exclamation.Play(); return; }
        synth.SpeakAsync(text);
    }

    public void Read(string text, Action<int> onCharacterPosition, Action onFinished)
    {
        if (!IsAvailable) { SystemSounds.Exclamation.Play(); return; }
        onPosition = onCharacterPosition;
        this.onFinished = onFinished;
        readPrompt = synth.SpeakAsync(text);
    }

    public void Stop()
    {
        ClearRead();
        if (IsAvailable) synth.SpeakAsyncCancelAll();
    }

    /// <summary>Speaks and waits (used only when the window is closing).</summary>
    public void SayAndWait(string text)
    {
        if (!IsAvailable) return;
        try { Stop(); synth.Speak(text); } catch (Exception ex) { log.Error("Speech failed.", ex); }
    }

    public void Dispose() => synth.Dispose();

    private void ClearRead()
    {
        readPrompt = null;
        onPosition = null;
        onFinished = null;
    }

    private void OnUi(Action action)
    {
        if (ui.IsDisposed || !ui.IsHandleCreated) return;
        if (ui.InvokeRequired) ui.BeginInvoke(action);
        else action();
    }

    private static CultureInfo SafeCulture(string name)
    {
        try { return string.IsNullOrEmpty(name) ? CultureInfo.CurrentUICulture : CultureInfo.GetCultureInfo(name); }
        catch (CultureNotFoundException) { return CultureInfo.CurrentUICulture; }
    }
}
