# EMPC: Evolutionary Multimodal Pattern Compression

EMPC is an experimental research prototype. It looks for mathematical relationships
between **body movement in video**, **sound**, and **the physiology of people
watching**. It does not use emotion or other psychological labels. Its guiding
principle is to **discover structure before assigning meaning**.

Every relationship it reports has a neutral identifier (`P001`, `P002`, …), an
equation, a lag, a cost in numbers and operations, and a held-out test result.
It also gives the result of three null controls. When nothing survives, it says so.

> Associations found by EMPC are not causal claims and are not universal
> principles of human behaviour. Synthetic data is labelled as synthetic at every
> step and is never evidence about people.

The first experiment's results are in [`experiments/RESULTS.md`](experiments/RESULTS.md).

---

## Quick start (Windows 11, 16 GB RAM, no GPU)

```bat
cd empc
py -3.12 -m pip install -r requirements.txt
py -3.12 -m empc models                       :: one-time download of MediaPipe models (free; offline afterwards)
py -3.12 -m pytest                            :: about 1 minute
py -3.12 -m empc synthetic --quick --out results\quick
```

On macOS or Linux, use `python3` instead of `py -3.12`. Everything runs locally on
the CPU. There are no paid APIs and no cloud services.

### Your own video

```bat
py -3.12 -m empc video clip1.mp4 clip2.mp4 --out results\mine
py -3.12 -m empc video clip.mp4 --physio eda.csv hr.csv --physio-meta meta.json --out results\mine
```

* With **3 or more videos**, the last 30 % of videos are held out for testing.
  You can also hold out viewers.
* With **1 or 2 videos**, each recording is split in time: 65 % is used for
  training, and the rest is held out after a 5 s gap. The report then says plainly
  that generalisation to new people was not tested.

### A complete demonstration with files

```bat
py -3.12 -m empc demo-files demo
py -3.12 -m empc video demo\demo.mp4 --physio demo\eda_4hz.csv demo\pupil_30hz.csv demo\resp_25hz.csv demo\ibi_beats.csv --physio-meta demo\physio_meta.json --out results\demo
```

### Accessible interface

```bat
py -3.12 -m empc app
```

This opens a Streamlit page in your browser. The page works by keyboard only and
every control has a text label. Results are shown as text and plain tables: there
are no charts and nothing relies on colour. Every table can be downloaded as a CSV
file.

The **downloadable `report.html`** is the most screen-reader-friendly view. It uses
a skip link, a section navigation list, real headings, and tables with captions and
`scope` headers, and has been tested by reading it as JAWS/NVDA would. The
command-line interface prints the same plain-language summary.

---

## Outputs (one folder per run)

| File | Content |
|---|---|
| `summary.txt` | Plain-language findings, including negative results |
| `report.html`, `report.md` | Full accessible report |
| `patterns.csv` | One row per pattern: leader and follower signals, lag, scale, held-out gain, null-control p-values, mismatch control, stability, chosen model, parameters, FLOPs, equation, diagnostics |
| `model_ladder.csv` | Every model tried for every pattern, with cost and validation score |
| `search_comparison.csv` | Exhaustive, staged and adaptive search: operations, CPU time, recall |
| `search_arms.csv` | What the adaptive search learned to attend to: signal-family pairs and the posterior success rate of each |
| `evolution.csv` | Evolutionary, random and greedy search compared under equal budgets |
| `abstraction.csv` | Whether pattern-derived (level-2) signals beat raw signals on held-out data |
| `candidates.csv` | Every relationship examined and the stage it reached |
| `ground_truth.csv` | Synthetic runs only: recovery of each planted relationship |

---

## How it works

```
ingest ─► extract (video / audio / physio) ─► sync (common 10 Hz grid, delays removed)
      ─► discovery (candidates × scales × lags; shift-null; FDR; predictive validation)
      ─► compression (model ladder, MDL, 1-SE rule, redundancy merging)
      ─► evaluation (held-out test, shift / block / mismatch controls, stability, diagnostics)
      ─► level 2 (patterns become new signals; search again) ─► reporting
```

| Module | Role |
|---|---|
| `extract_video.py` | MediaPipe Pose, plus optional Face and Hand models. Gives positions, velocities, accelerations, depth estimates (`*_est`), stillness, periodicity, bimanual synchrony and face/hand geometry. Falls back to OpenCV optical flow when there are no models, MediaPipe cannot start, or no person is detected. |
| `extract_audio.py` | librosa: RMS envelope and its derivative, onsets, silence, spectral centroid, flux, flatness and ZCR, f0 in semitones (yin, or pyin), voicing, and rhythmic periodicity. No transcription. |
| `physio.py` | CSV loader for hr, ibi_ms (HR and RMSSD; RMSSD only where at least 8 beats fall in a 10 s window), eda (level and phasic), resp (rate), pupil, and gaze. Handles per-channel rates, delays and uncertainty. |
| `sync.py` | Resamples every stream to one grid. Faster streams are bin-averaged; slower streams are interpolated up to a maximum gap and left missing beyond it. Known delays are subtracted before resampling. |
| `discovery.py` | Candidate generation and the three search strategies (below). |
| `stats.py` | Circular cross-correlation, circular-shift surrogate nulls (max over the lag window), Gumbel-tail p-values and Benjamini–Hochberg FDR. |
| `compression.py` | The model ladder (M1 single lag; M2 Lasso kernel; M3 ridge kernel; M4 MLP; M5 boosted trees), two-part MDL, the 1-SE rule, and equations. |
| `evaluation.py` | Held-out test with shift, block-shuffle and modality-mismatch controls. Phase locking (PLV), the nonlinear part of mutual information, DTW alignment, and recurrence of joint motifs. |
| `latent.py` | Lagged CCA: a shared latent movement–sound component, tested on held-out recordings. |
| `evolve.py` | Genetic search for multi-term patterns, compared with random search and greedy search under the same budget. |
| `pipeline.py` | Orchestration: redundancy merging, level-2 pattern signals, stability resampling and the compression summary. |
| `report.py`, `cli.py`, `app.py` | Accessible text, HTML, CSV, command-line and Streamlit outputs. |
| `synthetic.py` | Labelled synthetic worlds with planted relationships, plus a null world. |

### The discovery loop (the minimum-intelligence principle)

1. **Explore.** A candidate is a (source, target, temporal scale, lag window).
   Movement and sound pairs are searched over ±2 s, in both directions. Pairs from
   movement or sound to physiology are searched over lags of 0 to 8 s, because
   physiology usually follows.
2. **Evaluate reliability.** The statistic is the pooled lagged correlation. The
   null comes from **circular time shifts** of the source, which keep each signal's
   own autocorrelation, so slow signals do not look significant. The null takes the
   maximum over the lag window, so searching over lags is paid for. Benjamini–Hochberg
   FDR is then applied over **all** candidates, including those that were never
   tested.
3. **Predictive validation.** The source at the found lag must improve prediction
   of the target on a later stretch of data, **beyond the target's own recent
   history** (0.5 s ahead for sound and movement, 1 s for physiology). This is
   checked against shifted-source nulls.
4. **Allocate computation.** The *adaptive* strategy treats (source family, target
   family) pairs as bandit arms. It screens candidates on 40 % of the data with 49
   surrogates and learns a preference over temporal scales. It retires barren arms
   early and spends the full 999-surrogate test and the predictive test only on
   promoted candidates.
5. **Compress.**
   * Near-duplicate findings are merged: leaders and followers correlated with
     |r| ≥ 0.8.
   * Each pattern gets the **cheapest** model that is within one standard error of
     the best on validation.
   * Bits saved under MDL measure how much the pattern compresses the follower
     signal.
6. **Reuse.** Movement–sound patterns become new signals. `drive` is the leader's
   predicted contribution. `coact` is the 2 s co-activation of leader and follower.
   Their coefficients are fitted on training data only.
7. **Search again** with these signals against physiology (level 2). The
   head-to-head comparison against the best raw signal is reported, whether or not
   abstraction helped.
8. **Measure.**
   * Strategies are compared on operations and CPU time, and on recall of what
     exhaustive search finds.
   * Evolutionary search is compared against random and greedy search under equal
     budgets.
   * Stability is measured over 5 resamples of the training recordings.

Final verdicts use only held-out recordings. A pattern "generalizes" when it meets
all of these conditions:

* its held-out gain is positive;
* it beats both the time-shift and block-shuffle controls;
* it survives BH correction across all reported patterns.

The modality-mismatch control pairs a source from one recording with a target from
another. If the pattern still predicts under that pairing, it is flagged.

---

## Physiology CSV format

```
time_s,eda            # any subset of: hr, ibi_ms, eda, resp, pupil, gaze_x, gaze_y
0.00,2.013
0.25,2.016
```

* `time_s` is measured in seconds from the start of the video. Channels can be in
  separate files with different sampling rates. An empty cell means no sample.
* `ibi_ms` has one row per detected heartbeat. It enables HRV.
* A column named `synthetic` set to 1 marks the file as synthetic. The report then
  says so.
* An optional metadata JSON can give per-channel recording delays and uncertainty:
  `{"eda": {"delay_s": 0.5, "uncertainty": 0.01}}`.

---

## Assumptions

* Video and physiology share a clock that starts at video time 0. Known device
  delays are supplied in the metadata.
* All analysis uses a common 10 Hz grid, so structure faster than about 0.2 s is
  averaged out.
* Per-recording robust standardisation (median and SD) is used to compare different
  bodies, cameras and sensors. This removes absolute levels; only changes are
  compared.
* Body normalisation centres coordinates on the shoulders and scales them by the
  median shoulder width. Velocities are expressed per second, so frame rate cancels
  out.
* One person is analysed per video: the first pose MediaPipe returns.
* For movement–sound relationships, each video counts once, however many viewers
  watched it.

## Limitations

* Monocular depth (`*_est`) is a model estimate, not a measurement. MediaPipe can
  confuse left and right hands in mirrored video.
* Stage A screening and stage B testing in the adaptive strategy share training
  data, which slightly biases its p-values. Validation also overlaps the data used to
  choose lags. **Only the held-out test is unbiased**, which is why verdicts come
  from it.
* The p-values in the tails are extrapolations from Gumbel or Gaussian fits, and are
  approximate. The report says when a result beat every surrogate.
* Many features are near-duplicates of each other, for example loudness, silence and
  voicing. Merging reduces this redundancy, but leader and follower can be
  interchangeable within a merged pattern.
* Linear-Gaussian MDL is an approximation. The neural and tree models are counted by
  parameter number, which is not a full description length.
* The synthetic worlds were designed by the author of this code. Recovering their
  planted relationships tests the software, not the world.
* No real recordings of people with physiology were available while this was built.
  The real-video path has been run only on rendered and photo-animated videos (see
  `experiments/RESULTS.md`).
* PyTorch is not used: the small sklearn MLP in the ladder never had to beat linear
  models by more than one standard error to justify more capacity. Neural
  architecture search is not implemented.
