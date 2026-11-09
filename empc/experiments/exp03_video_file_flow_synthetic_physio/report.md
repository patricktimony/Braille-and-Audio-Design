# EMPC experiment report

## Plain-language summary

```
IMPORTANT: this run used SYNTHETIC data (synthetic physiology supplied with the video). It tests the software; it is not evidence about people.
The system examined 936 possible relationships between 12 movement, 12 sound and 7 physiological signals.
3 relationship groups passed the training-data tests (shuffled-time controls, false-discovery-rate correction and a validation stretch). 1 of them also predicted held-out data better than shuffled controls.
- Pattern 001: changes in physio.pupil.diameter tend to follow audio.spectral.centroid_log by about 0.8 s. On held-out recordings the leader signal explained an extra 15.5% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 0.002). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
Search cost: the adaptive search used 9% of the operations and 8% of the CPU time of uniform exhaustive search; it recovered 27% of the relationship families exhaustive search confirmed.
A simple staged filter (no learning) used 48% of exhaustive operations and 31% of its CPU time; it recovered 100% of the relationship families exhaustive search confirmed.
Compression: 2 of 31 raw signals take part in the generalising patterns. Their chosen models use 5 numbers in total, versus 33 for dense lag kernels and 2388 for boosted trees.
Evolutionary vs random vs greedy search (equal budgets, mean over targets and seeds): evolutionary: validation 0.661 bits/sample, held-out gain 0.076; greedy: validation 0.686 bits/sample, held-out gain 0.086; random: validation 0.455 bits/sample, held-out gain 0.124.
Correlation and prediction here do not establish causation, and patterns carry neutral identifiers only; interpretation is left to human researchers.
```

## Patterns (neutral identifiers)

| pattern | level | status | leader signal | follower signal | lag s | temporal scale s | test gain r2 | test p shift | test p block | test mismatch gain | stability | chosen model | parameters |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P001 | 1 | Generalizes to held-out data | audio.spectral.centroid_log | physio.pupil.diameter | 0.800 | 1.000 | 0.155 | 1.47e-07 | 0.002 | n/a | 1.000 | M1 single-lag linear | 5 |
| P002 | 1 | Did not generalize (validated on training data only) | audio.spectral.flatness | physio.eda.phasic | 2.600 | 0.000 | 0.026 | 0.110 | 0.039 | n/a | 1.000 | M1 single-lag linear | 5 |
| P003 | 1 | Did not generalize (validated on training data only) | video.flowgrid.g20 | physio.eda.level | 3.100 | 0.000 | 0.001 | 0.145 | 0.300 | n/a | 0.600 | M1 single-lag linear | 5 |

## Mathematical representations

| pattern | equation | best model | variants | merged groups | note |
|---|---|---|---|---|---|
| P001 | y(t) = 0.76*y(t-1.0s) + -0.24*y(t-2.0s) + 0.21*y(t-3.0s) - 0.473*x(t-0.8s);  x = z[audio.spectral.centroid_log, smoothed 1 s], y = z[physio.pupil.diameter] | M3 | 20 | audio.spectral -> physio.pupil; audio.energy -> physio.pupil; audio.timing -> physio.pupil; audio.pitch -> physio.pupil |  |
| P002 | y(t) = 0.83*y(t-1.0s) + -0.40*y(t-2.0s) + -0.03*y(t-3.0s) - 0.249*x(t-2.6s);  x = z[audio.spectral.flatness], y = z[physio.eda.phasic] | M2 | 3 | audio.spectral -> physio.eda |  |
| P003 | y(t) = 1.27*y(t-1.0s) + -0.43*y(t-2.0s) + 0.05*y(t-3.0s) + 0.104*x(t-3.1s);  x = z[video.flowgrid.g20], y = z[physio.eda.level] | M3 | 2 | video.flowgrid -> physio.eda |  |

## Model ladder (minimum-intelligence selection)

| pattern | model | description | parameters | flops per prediction | fit cpu s | validation gain r2 | validation bits per sample | chosen |
|---|---|---|---|---|---|---|---|---|
| P001 | M1 | single-lag linear | 5 | 10 | 1.19e-04 | 0.437 | 0.849 | yes |
| P001 | M2 | sparse lagged kernel | 29 | 58 | 0.034 | 0.589 | 1.627 | no |
| P001 | M3 | dense lagged kernel | 33 | 66 | 0.004 | 0.589 | 1.566 | no |
| P001 | M4 | small neural network | 321 | 642 | 0.150 | 0.482 | -4.103 | no |
| P001 | M5 | gradient-boosted trees | 2388 | 400 | 0.044 | 0.432 | -37.993 | no |
| P002 | M1 | single-lag linear | 5 | 10 | 8.41e-05 | 0.103 | 0.101 | yes |
| P002 | M2 | sparse lagged kernel | 25 | 50 | 0.011 | 0.179 | -0.122 | no |
| P002 | M3 | dense lagged kernel | 45 | 90 | 0.003 | 0.178 | -0.448 | no |
| P002 | M4 | small neural network | 417 | 834 | 0.111 | -0.002 | -6.693 | no |
| P002 | M5 | gradient-boosted trees | 2164 | 400 | 0.047 | -0.073 | -35.066 | no |
| P003 | M1 | single-lag linear | 5 | 10 | 8.42e-05 | 0.031 | 0.057 | yes |
| P003 | M2 | sparse lagged kernel | 15 | 30 | 0.011 | 0.075 | 0.014 | no |
| P003 | M3 | dense lagged kernel | 45 | 90 | 0.003 | 0.080 | -0.455 | no |
| P003 | M4 | small neural network | 417 | 834 | 0.210 | -0.196 | -7.025 | no |
| P003 | M5 | gradient-boosted trees | 2340 | 400 | 0.048 | -0.128 | -38.021 | no |

## Other cross-modal measures at the discovered lag

| pattern | plv | plv null | mi nonlinear excess nats | dtw ratio | motif ratio |
|---|---|---|---|---|---|
| P001 | 0.797 | 0.164 | 0.218 | 1.419 | 0.605 |
| P002 | 0.336 | 0.146 | 0.013 | 1.092 | 0.936 |
| P003 | 0.306 | 0.133 | 0.061 | 1.015 | 0.985 |

## Search strategy comparison

| strategy | candidates | screened on subsample | full null tests | predictive checks | confirmed families | ops | cpu s | ops vs exhaustive | recall of exhaustive families |
|---|---|---|---|---|---|---|---|---|---|
| exhaustive | 936 | 0 | 936 | 936 | 22 | 2.13e+08 | 5.283 | 1.000 | 1.000 |
| staged | 936 | 0 | 936 | 227 | 22 | 1.03e+08 | 1.653 | 0.482 | 1.000 |
| adaptive | 936 | 384 | 114 | 41 | 6 | 1.98e+07 | 0.447 | 0.093 | 0.273 |

## What the adaptive search learned to attend to

| arm | pulls | successes | posterior mean | retired | untested |
|---|---|---|---|---|---|
| audio.timing -> physio.pupil | 9 | 9 | 0.909 | no | 0 |
| audio.energy -> physio.pupil | 6 | 6 | 0.875 | no | 0 |
| audio.spectral -> physio.pupil | 12 | 11 | 0.857 | no | 0 |
| audio.pitch -> physio.pupil | 9 | 6 | 0.636 | no | 0 |
| audio.timing -> physio.resp | 18 | 11 | 0.600 | no | 0 |
| video.flow -> physio.hrv | 15 | 7 | 0.471 | no | 0 |
| audio.spectral -> physio.eda | 24 | 11 | 0.462 | no | 0 |
| video.flowgrid -> physio.hrv | 21 | 7 | 0.348 | no | 0 |
| video.flow -> physio.eda | 30 | 10 | 0.344 | no | 0 |
| video.flowgrid -> physio.hr | 21 | 6 | 0.304 | no | 0 |
| video.flowgrid -> physio.eda | 42 | 12 | 0.295 | no | 0 |
| audio.energy -> physio.resp | 12 | 3 | 0.286 | no | 0 |
| audio.timing -> physio.hr | 9 | 2 | 0.273 | no | 0 |
| audio.pitch -> physio.hr | 9 | 2 | 0.273 | no | 0 |
| video.flow -> physio.pupil | 15 | 3 | 0.235 | no | 0 |
| video.flow -> audio.spectral | 24 | 4 | 0.192 | yes | 36 |
| audio.pitch -> physio.resp | 14 | 2 | 0.188 | yes | 4 |
| video.flow -> physio.hr | 9 | 1 | 0.182 | yes | 6 |
| audio.spectral -> physio.resp | 9 | 1 | 0.182 | yes | 15 |
| video.flow -> audio.energy | 4 | 0 | 0.167 | yes | 26 |
| video.flow -> audio.timing | 4 | 0 | 0.167 | yes | 41 |
| video.flow -> audio.pitch | 4 | 0 | 0.167 | yes | 41 |
| video.flowgrid -> audio.energy | 4 | 0 | 0.167 | yes | 38 |
| video.flowgrid -> audio.timing | 4 | 0 | 0.167 | yes | 59 |
| video.flowgrid -> audio.spectral | 4 | 0 | 0.167 | yes | 80 |
| video.flowgrid -> audio.pitch | 4 | 0 | 0.167 | yes | 59 |
| video.flow -> physio.resp | 4 | 0 | 0.167 | yes | 26 |
| video.flowgrid -> physio.pupil | 4 | 0 | 0.167 | yes | 17 |
| video.flowgrid -> physio.resp | 4 | 0 | 0.167 | yes | 38 |
| audio.energy -> physio.eda | 4 | 0 | 0.167 | yes | 8 |
| audio.energy -> physio.hr | 4 | 0 | 0.167 | yes | 2 |
| audio.energy -> physio.hrv | 4 | 0 | 0.167 | yes | 2 |
| audio.timing -> physio.eda | 4 | 0 | 0.167 | yes | 14 |
| audio.timing -> physio.hrv | 4 | 0 | 0.167 | yes | 5 |
| audio.spectral -> physio.hr | 4 | 0 | 0.167 | yes | 8 |
| audio.spectral -> physio.hrv | 4 | 0 | 0.167 | yes | 8 |
| audio.pitch -> physio.eda | 4 | 0 | 0.167 | yes | 14 |
| audio.pitch -> physio.hrv | 4 | 0 | 0.167 | yes | 5 |

## Shared latent movement-sound component (CCA)

| lag s | validation r | test r | p shift | null mean abs r | top movement weights | top sound weights |
|---|---|---|---|---|---|---|
| 0.500 | 0.253 | 0.353 | 0.010 | 0.053 | video.flow.energy +0.77; video.flowgrid.g11 -0.41; video.flowgrid.g21 -0.34; video.flowgrid.g01 -0.27; video.flowgrid.g20 -0.14 | audio.energy.rms_db -0.76; audio.spectral.flatness -0.53; audio.pitch.voiced +0.27; audio.spectral.centroid_log +0.24; audio.timing.silence -0.10 |

## Did pattern-derived (level-2) signals help?

_none_

## Evolutionary versus random versus greedy search

| target | method | seed | evals | best val bits | evals to 90pct | terms | genome | test gain |
|---|---|---|---|---|---|---|---|---|
| physio.pupil.diameter | evolutionary | 0 | 309 | 1.353 | 158 | 2 | audio.timing.silence@1s lag 2.1s; audio.spectral.flatness@1s lag 0.6s | 0.387 |
| physio.pupil.diameter | random | 0 | 300 | 0.903 | 38 | 1 | audio.spectral.zcr@1s lag 0.4s | 0.202 |
| physio.pupil.diameter | greedy | 0 | 300 | 1.489 | 188 | 4 | audio.spectral.zcr@0s lag 0.7s; audio.spectral.zcr@1s lag 0.5s; audio.spectral.flatness@1s lag 2.0s; audio.timing.silence@0s lag 2.8s | 0.427 |
| physio.pupil.diameter | evolutionary | 1 | 306 | 1.057 | 271 | 4 | audio.pitch.voiced@1s lag 0.1s; video.flow.d_energy@1s lag 4.6s; audio.energy.rms_db@1s lag 0.9s; audio.spectral.zcr@4s lag 2.1s | 0.317 |
| physio.pupil.diameter | random | 1 | 300 | 1.030 | 193 | 2 | video.flowgrid.g01@0s lag 4.5s; audio.timing.silence@1s lag 0.7s | 0.223 |
| physio.pupil.diameter | greedy | 1 | 300 | 1.447 | 156 | 4 | audio.spectral.centroid_log@4s lag 0.7s; audio.energy.rms_db@1s lag 0.6s; audio.timing.silence@4s lag 3.0s; video.flowgrid.g11@4s lag 1.3s | 0.431 |
| physio.pupil.diameter | evolutionary | 2 | 311 | 1.393 | 126 | 4 | video.flow.energy@4s lag 3.2s; video.flowgrid.g11@4s lag 7.6s; audio.spectral.zcr@4s lag 3.0s; audio.pitch.voiced@1s lag 0.7s | 0.374 |
| physio.pupil.diameter | random | 2 | 300 | 1.033 | 95 | 4 | audio.timing.silence@1s lag 7.1s; audio.energy.rms_db@1s lag 0.5s; audio.timing.onset@1s lag 2.0s; audio.energy.rms_db@0s lag 2.3s | 0.253 |
| physio.pupil.diameter | greedy | 2 | 299 | 1.176 | 243 | 4 | audio.spectral.zcr@0s lag 0.7s; audio.timing.silence@1s lag 0.9s; audio.spectral.centroid_log@1s lag 0.8s; audio.spectral.centroid_log@1s lag 0.3s | 0.232 |
| physio.eda.phasic | evolutionary | 0 | 309 | 0.331 | 194 | 4 | audio.timing.silence@0s lag 1.4s; audio.energy.rms_db@1s lag 2.4s; audio.timing.silence@0s lag 0.8s; video.flowgrid.g12@4s lag 7.1s | 0.064 |
| physio.eda.phasic | random | 0 | 300 | 0.194 | 152 | 3 | audio.pitch.voiced@1s lag 2.3s; video.flowgrid.g01@1s lag 6.1s; audio.spectral.centroid_log@0s lag 4.7s | 0.125 |
| physio.eda.phasic | greedy | 0 | 300 | 0.364 | 169 | 4 | audio.energy.rms_db@1s lag 2.5s; video.flowgrid.g22@1s lag 6.0s; video.flowgrid.g20@1s lag 2.6s; audio.timing.periodicity@4s lag 3.6s | -0.042 |
| physio.eda.phasic | evolutionary | 1 | 316 | 0.267 | 265 | 3 | video.flowgrid.g12@4s lag 7.0s; audio.energy.rms_db@0s lag 3.4s; audio.timing.silence@1s lag 2.5s | 0.011 |
| physio.eda.phasic | random | 1 | 300 | 0.202 | 116 | 1 | audio.spectral.centroid_log@1s lag 2.5s | 0.038 |
| physio.eda.phasic | greedy | 1 | 300 | 0.321 | 156 | 4 | video.flowgrid.g22@1s lag 6.1s; video.flowgrid.g10@0s lag 2.7s; audio.timing.silence@1s lag 2.6s; video.flowgrid.g11@1s lag 7.4s | -0.153 |
| physio.eda.phasic | evolutionary | 2 | 300 | 0.345 | 177 | 3 | audio.spectral.centroid_log@1s lag 2.4s; video.flowgrid.g10@1s lag 2.6s; audio.timing.onset@4s lag 1.0s | -0.337 |
| physio.eda.phasic | random | 2 | 300 | 0.212 | 103 | 3 | video.flowgrid.g10@1s lag 2.8s; video.flowgrid.g01@0s lag 7.2s; video.flow.cx@4s lag 1.9s | -0.063 |
| physio.eda.phasic | greedy | 2 | 299 | 0.217 | 232 | 4 | audio.timing.periodicity@4s lag 3.4s; video.flowgrid.g22@1s lag 2.8s; audio.energy.rms_db@1s lag 2.2s; video.flowgrid.g20@4s lag 4.0s | -0.099 |
| physio.eda.level | evolutionary | 0 | 311 | 0.460 | 264 | 4 | audio.spectral.flatness@4s lag 2.2s; video.flowgrid.g22@1s lag 6.1s; audio.energy.rms_db@1s lag 2.3s; audio.pitch.d_f0@1s lag 0.4s | 0.009 |
| physio.eda.level | random | 0 | 300 | 0.183 | 48 | 3 | audio.pitch.voiced@1s lag 2.3s; video.flowgrid.g01@1s lag 6.1s; audio.spectral.centroid_log@0s lag 4.7s | 0.167 |
| physio.eda.level | greedy | 0 | 300 | 0.396 | 206 | 4 | audio.energy.rms_db@1s lag 2.5s; video.flowgrid.g22@1s lag 6.0s; video.flow.cy@1s lag 7.1s; video.flowgrid.g20@4s lag 2.2s | 0.051 |
| physio.eda.level | evolutionary | 1 | 309 | 0.416 | 173 | 4 | audio.pitch.d_f0@1s lag 0.3s; audio.spectral.centroid_log@4s lag 1.7s; video.flowgrid.g12@1s lag 5.9s; audio.timing.silence@4s lag 1.5s | -0.056 |
| physio.eda.level | random | 1 | 300 | 0.181 | 13 | 3 | video.flowgrid.g10@4s lag 0.0s; audio.spectral.zcr@1s lag 2.0s; audio.spectral.centroid_log@1s lag 6.7s | 0.113 |
| physio.eda.level | greedy | 1 | 300 | 0.406 | 193 | 4 | video.flowgrid.g22@1s lag 6.1s; audio.energy.rms_db@4s lag 1.1s; audio.spectral.flux@1s lag 7.4s; video.flowgrid.g11@1s lag 7.4s | -0.143 |
| physio.eda.level | evolutionary | 2 | 309 | 0.331 | 264 | 2 | video.flowgrid.g20@1s lag 2.9s; video.flowgrid.g22@1s lag 5.7s | -0.084 |
| physio.eda.level | random | 2 | 300 | 0.153 | 103 | 1 | audio.pitch.voiced@1s lag 2.5s | 0.055 |
| physio.eda.level | greedy | 2 | 299 | 0.356 | 234 | 4 | video.flowgrid.g21@4s lag 2.4s; video.flow.d_energy@4s lag 5.6s; audio.energy.rms_db@1s lag 2.2s; video.flowgrid.g12@4s lag 5.0s | 0.074 |

## Notes, assumptions and limitations

- SYNTHETIC physiology was supplied (file marked synthetic): physiological results are NOT evidence.
- Video feature method: optical_flow (no person detected by MediaPipe) for demo
- Fewer than 3 videos: each recording is split in time; the first 65% trains, the rest (after a 5 s gap) is held out for testing. Held-out data then comes from the same person and session, so generalisation to new people or recordings is NOT tested.
- Associations and predictive relationships are not causal claims and do not reveal universal principles of human behaviour.
- Monocular pose depth (features ending in _est) is a model estimate, not a physical measurement.
- Patterns are named with neutral identifiers only; no psychological or intentional meaning is assigned.
- Significance relies on circular-shift and block-shuffle surrogates; p-values smaller than the surrogate count allows are tail extrapolations (Gumbel or Gaussian fits) and are approximate.
- Validation data overlaps the data used to choose lags; only the held-out test recordings give an unbiased estimate.
- With few recordings, held-out testing cannot show that a pattern generalises to new people.
