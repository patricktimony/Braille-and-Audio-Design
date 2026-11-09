# First experiments: results

**Read this first.** Every physiological signal below is **synthetic**. All
movement and sound comes from simulations or from rendered or animated videos. No
real recording of a person with physiology was available while this was built.
These runs test whether the **software** finds relationships that exist, rejects
relationships that do not, and reports both honestly. They are **not evidence
about human behaviour**. Each folder holds the full accessible report: `report.html`,
`report.md`, `summary.txt`, and CSV files.

| Run | Data | Held-out test |
|---|---|---|
| `exp01_synthetic_planted` | 10 simulated performers × 3 simulated viewers × 120 s; 4 planted relationships (GT1, GT3, GT4, GT5) | 3 unseen videos, plus 1 unseen viewer |
| `exp02_synthetic_null_world` | Same size, with **every cross-modal link removed** | Same |
| `exp03_video_file_flow_synthetic_physio` | Rendered stick-figure `.mp4` with sound, plus synthetic physiology CSVs at 4, 25 and 30 Hz and per beat, with a 0.5 s EDA delay in the metadata. Optical-flow path. | Last 35 % of the single recording |
| `exp04_mediapipe_photo_motion` | A public-domain photo of a person, animated with rigid tilts; sound bursts follow each tilt by 0.3 s. MediaPipe pose and face path. No physiology. | Last 35 % of the single recording |

Settings were the defaults: 999 circular-shift surrogates; FDR 5 %; 99
validation surrogates; scales of 0, 1 and 4 s; 5 stability resamples; an
evolutionary budget of 300 evaluations × 3 seeds.

---

## 1. What the system discovered

### exp01: planted relationships

* There were **2589 candidates**. 534 were confirmed on training data. The
  redundancy merging rule (|r| ≥ 0.8) compressed the 43 family groups to **18
  level-1 patterns**. Level 2 added **11** more, built from pattern-derived signals.
* **28 of 29** patterns generalised to the held-out recordings. They beat
  time-shift and block-shuffle controls and survived BH correction across patterns.
  P012 did not generalise, and the report says so.
* **All four planted relationships were recovered and generalised:**

| Planted | Strongest pattern found | Held-out gain over the follower's own past |
|---|---|---|
| GT1: right-arm movement → sound about 0.2–0.8 s later | P002 `video.wrist_r.vy → audio.energy.d_rms`, lag 0.4 s, 5-number linear model | 41.9 % of variance |
| GT3: sound after *large* strokes → EDA about 2 s later (plus a 0.5 s device delay, which was corrected) | P006 `video.wrist_r.speed → physio.eda.phasic`, lag 3.7 s | 24.0 % |
| GT4: sound onsets → pupil dilation peaking at 0.9 s | P001 `audio.timing.silence → physio.pupil.diameter`, lag 0.8 s, 28-number sparse kernel | 32.0 % |
| GT5: movement pauses → heart-rate dip about 3 s later (weak by design) | P010 `video.body.energy → physio.hr.bpm`, lag 2.1 s | 10.8 % |

* **No false positives:** no generalising pattern linked signal families that the
  generator leaves independent. Those independent families are the head, the left
  arm (except through pauses) and respiration.
* **Lags are only approximately recovered.** The EDA lag reads 3.7 s because the
  pooled correlation peaks where the response is largest, not where it starts.
  Reported lags should be treated as "peak-response lags".
* **The shared latent component (CCA)** puts most weight on right-wrist height
  (+0.76) and sound loudness (+0.75), at 0.5 s. Its held-out canonical r is 0.67,
  against a null mean |r| of 0.02.

### exp02: null world (nothing planted)

**0 of 2589 candidates were confirmed by any strategy.** There were 0 patterns,
and the CCA held-out r was −0.04 (p = 0.31). The summary states the negative
result rather than reporting anything.

### exp03: video file with synthetic physiology

MediaPipe found no person in the stick figure, so the run fell back to optical
flow. **P001** `audio.spectral.centroid_log → physio.pupil.diameter` at 0.8 s
generalised, with a 15.5 % held-out gain. This matches planted GT4. The 0.5 s EDA
delay from the metadata was applied.

The two EDA patterns passed validation but **did not generalise** on the 42 s
held-out stretch, and are reported as such. Movement-to-sound patterns were not
confirmed by the adaptive strategy in this run. See section 4: the adaptive
strategy's recall was poor here.

### exp04: MediaPipe on an animated photo

Pose and face were detected in every processed frame. The wrists were outside the
frame and correctly left missing rather than invented. 7 of 13 patterns
generalised. The strongest was **P001** `video.head.speed → audio.timing.silence`
at **0.4 s**: the planted tilt-to-sound delay was 0.3 s, and the grid is 0.1 s. The
"mouth" and "elbow" patterns are geometric side effects of rotating a rigid
picture: a tilted face changes the projected mouth distances. This shows that
**the system finds structure without knowing what it means**, which is exactly why
a human has to interpret patterns before anything is concluded.

---

## 2. How reliable the discoveries are

* **False-alarm control works on these tests.** The null world gave 0
  confirmations. The planted world gave 0 false-positive generalising patterns.
  A unit test checks the shift null on autocorrelated noise: 60 trials, at most 8
  false hits allowed, 3 expected.
* **Stability.** Most level-1 patterns reappeared in 80–100 % of five resamples of
  the training recordings. **P013** `audio.pitch.f0_st → video.wrist_r.vy`
  generalised but appeared in only **20 %** of resamples, so it should be treated as
  fragile.
* **Modality-mismatch control.** Pairing one recording's leader with another
  recording's follower always gave *negative* gains. So the generalising
  relationships are specific to aligned recordings and are not generic signal
  properties.
* **Caveats.**
  * The extremely small p-values in the summaries (some below 1e-10) are tail
    extrapolations from distributions where all 199 surrogates were beaten. Read
    them as "very small", not as exact values.
  * Validation overlapped with lag selection; only the held-out test is unbiased.
  * Single-recording runs (exp03, exp04) only show generalisation *forward in
    time within the same recording*, not to new people.

---

## 3. What information was compressed

* **Redundancy.** In exp01, 534 confirmed candidate relationships collapsed into
  18 level-1 patterns. Loudness, silence, voicing and flatness all track the same
  bursts, as do wrist and elbow position.
* **Signals.** 18 of the 61 raw signals take part in the generalising patterns.
  The other 43 were never needed.
* **Model size (minimum-intelligence ladder).**
  * For the movement-to-sound core, a **5-number single-lag linear model** (M1)
    stayed within one standard error of the best model, which was boosted trees with
    about 2,400 numbers. That is a compression of roughly 500×.
  * For several physiological targets, however, the **small MLP (M4, about 400
    numbers) beat the linear models by more than one standard error** and was
    chosen. Examples are EDA, which responds only after *large* strokes (a
    threshold nonlinearity), and heart rate.
  * As a result, the chosen models total 15,433 numbers, more than the 988 of
    dense linear kernels. That is the honest price of the nonlinear structure the
    generator planted. Every model's accuracy and cost is in `model_ladder.csv`.
* **Abstraction (level 2).**
  * The pattern-derived **co-activation** signal `pattern.P003.coact` (moments
    where right-arm movement *and* sound occur together) predicted held-out EDA
    better than the best raw signal: a gain of 0.264 against 0.232. It did so
    with **32 numbers instead of 417**. This matches the planted conjunction
    mechanism.
  * For the other three physiological targets (EDA level, heart rate and pupil),
    raw signals did better, so abstraction **did not help** there.

---

## 4. Did compression reduce computational cost?

**Search strategies (operations and CPU time relative to uniform exhaustive search):**

| Run | Staged filter (no learning) | Adaptive (bandit + subsample screening) |
|---|---|---|
| exp01 planted | 47 % ops, 37 % CPU, **100 %** family recall | **29 % ops, 26 % CPU**, 88 % family recall |
| exp02 null | 26 % ops, 8 % CPU (nothing to find) | **3 % ops, 1 % CPU** (nothing to find) |
| exp03 file | 48 % ops, 31 % CPU, 100 % recall | 9 % ops, 8 % CPU, **27 % recall** |
| exp04 MediaPipe | 63 % ops, 50 % CPU, 100 % recall | 34 % ops, 33 % CPU, 62 % recall |

What this shows:

* **Yes, adaptive allocation cuts compute** by 3–30× relative to exhaustive
  search. It is most effective when little exists to be found (the null world),
  because barren signal-family pairs are retired after three screens.
* **It is not free.** With a large dataset (exp01) it lost 12 % of relationship
  families. With a single short recording (exp03) it lost most of them: screening
  on 40 % of 78 s of training data is underpowered.
* The **non-learning staged filter** never lost a family and still saved 37–92 %
  of CPU. **On this evidence the simple staged filter is the safer default.** The
  bandit's extra savings are only worth it when the data are plentiful.
* **Evolutionary search versus simpler search (equal budgets).**
  * In exp01, evolution beat random and greedy search on all three physiological
    targets, for both validation bits and held-out gain. For pupil, held-out gain
    was 0.36, against 0.29 for greedy and 0.28 for random.
  * In exp03 and exp04 (single short recordings), **random search had the best
    held-out gain**: evolution overfitted the validation stretch.
  * So evolutionary search is **not** uniformly better, and that has been measured
    rather than assumed.

---

## 5. What the next experiment should investigate

1. **Real recordings with real physiology.** Several people watching several
   videos, with E4- or Shimmer-class EDA and PPG plus eye tracking. Hold out whole
   viewers *and* whole videos. This is the only way to test the research question.
2. **Onset lags rather than peak lags.** Add event-locked response estimation
   (deconvolution) to report when responses begin.
3. **Make adaptive search safe.** Screen on a *disjoint* data split. Scale the
   screen fraction and the retire threshold with data length, and fall back to the
   staged filter on short recordings.
4. **Charge description length during selection.** Include MDL bits for nonlinear
   models in the 1-SE decision, so a 400-number network has to pay for itself.
5. **More level-2 abstractions.** Event and motif signals, and conjunctions of
   patterns. Test whether each abstraction cuts the search space for new
   physiological targets while keeping held-out accuracy.
6. **Real human video** (with consent) for the MediaPipe path. The synthetic
   video experiments cannot reveal pose-estimation failure modes such as occlusion,
   mirroring, or multiple people.
7. **A screen-reader usability session** with a JAWS user on `report.html` and the
   Streamlit app.
