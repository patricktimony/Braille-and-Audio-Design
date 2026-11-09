# EMPC experiment report

## Plain-language summary

```
IMPORTANT: this run used SYNTHETIC data with planted relationships. It tests the software; it is not evidence about people.
The system examined 2589 possible relationships between 42 movement, 12 sound and 7 physiological signals.
29 relationship groups passed the training-data tests (shuffled-time controls, false-discovery-rate correction and a validation stretch). 28 of them also predicted held-out data better than shuffled controls.
- Pattern 001: changes in physio.pupil.diameter tend to follow audio.timing.silence by about 0.8 s. On held-out recordings the leader signal explained an extra 32.0% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 2.09e-292). Compact form: sparse lagged kernel with 28 numbers. Found in 100% of resampled training sets.
- Pattern 002: changes in audio.energy.d_rms tend to follow video.wrist_r.vy by about 0.4 s. On held-out recordings the leader signal explained an extra 41.9% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 2.41e-54). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
- Pattern 003: changes in audio.spectral.flatness tend to follow video.wrist_r.y by about 0.4 s. On held-out recordings the leader signal explained an extra 41.1% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 1.77e-136). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
- Pattern 004: changes in physio.pupil.diameter tend to follow video.wrist_r.y by about 1.3 s. On held-out recordings the leader signal explained an extra 12.5% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 2.31e-156). Compact form: sparse lagged kernel with 25 numbers. Found in 100% of resampled training sets.
- Pattern 005: changes in audio.energy.rms_db tend to follow video.body.energy by about 0.5 s. On held-out recordings the leader signal explained an extra 22.0% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 6.61e-26). Compact form: small neural network with 209 numbers. Found in 80% of resampled training sets.
- Pattern 006: changes in physio.eda.phasic tend to follow video.wrist_r.speed by about 3.7 s. On held-out recordings the leader signal explained an extra 24.0% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 7.22e-102). Compact form: small neural network with 417 numbers. Found in 100% of resampled training sets.
- Pattern 007: changes in physio.pupil.diameter tend to follow video.body.energy by about 1.3 s. On held-out recordings the leader signal explained an extra 5.4% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 1.22e-54). Compact form: sparse lagged kernel with 24 numbers. Found in 100% of resampled training sets.
- Pattern 008: changes in physio.eda.phasic tend to follow audio.energy.rms_db by about 3.2 s. On held-out recordings the leader signal explained an extra 20.9% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 7.14e-58). Compact form: small neural network with 417 numbers. Found in 100% of resampled training sets.
- Pattern 009: changes in physio.eda.phasic tend to follow video.body.energy by about 3.7 s. On held-out recordings the leader signal explained an extra 17.3% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 8.11e-47). Compact form: small neural network with 417 numbers. Found in 80% of resampled training sets.
- Pattern 010: changes in physio.hr.bpm tend to follow video.body.energy by about 2.1 s. On held-out recordings the leader signal explained an extra 10.8% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 2.50e-67). Compact form: small neural network with 417 numbers. Found in 100% of resampled training sets.
- Pattern 011: changes in physio.hr.bpm tend to follow video.elbow_r.speed by about 2.0 s. On held-out recordings the leader signal explained an extra 1.0% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 1.80e-10). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
- Pattern 013: changes in video.wrist_r.vy tend to follow audio.pitch.f0_st by about 0.1 s. On held-out recordings the leader signal explained an extra 11.9% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 2.79e-23). Compact form: small neural network with 177 numbers. Found in 20% of resampled training sets.
  ... and 16 more in the tables.
Search cost: the adaptive search used 29% of the operations and 26% of the CPU time of uniform exhaustive search; it recovered 88% of the relationship families exhaustive search confirmed.
A simple staged filter (no learning) used 47% of exhaustive operations and 37% of its CPU time; it recovered 100% of the relationship families exhaustive search confirmed.
Compression: 18 of 61 raw signals take part in the generalising patterns. Their chosen models use 15433 numbers in total, versus 988 for dense lag kernels and 78796 for boosted trees.
Level-2 check for physio.eda.level: held-out gain 0.043 from pattern-derived signal pattern.P018.coact versus 0.100 from the best raw signal video.wrist_r.y (scale 0 s, lag 3.5 s) (abstraction did not help).
Level-2 check for physio.eda.phasic: held-out gain 0.264 from pattern-derived signal pattern.P003.coact versus 0.232 from the best raw signal video.wrist_r.speed (scale 1 s, lag 3.7 s) (abstraction helped).
Level-2 check for physio.hr.bpm: held-out gain 0.045 from pattern-derived signal pattern.P003.drive versus 0.103 from the best raw signal video.body.energy (scale 1 s, lag 2.1 s) (abstraction did not help).
Level-2 check for physio.pupil.diameter: held-out gain 0.178 from pattern-derived signal pattern.P003.drive versus 0.320 from the best raw signal audio.timing.silence (scale 1 s, lag 0.8 s) (abstraction did not help).
Evolutionary vs random vs greedy search (equal budgets, mean over targets and seeds): evolutionary: validation 0.568 bits/sample, held-out gain 0.211; greedy: validation 0.422 bits/sample, held-out gain 0.165; random: validation 0.413 bits/sample, held-out gain 0.168.
Planted GT1 (right-arm movement -> sound loudness/onset (sound follows by ~0.2-0.8 s)): recovered and generalised.
Planted GT3 (sound bursts after large strokes -> EDA response (~2 s later)): recovered and generalised.
Planted GT4 (sound-burst onsets -> pupil dilation (~0.9 s later)): recovered and generalised.
Planted GT5 (movement pauses -> heart-rate deceleration (~3 s later; weak by design)): recovered and generalised.
Patterns generalising without any planted dependency (false positives): 0.
Correlation and prediction here do not establish causation, and patterns carry neutral identifiers only; interpretation is left to human researchers.
```

## Patterns (neutral identifiers)

| pattern | level | status | leader signal | follower signal | lag s | temporal scale s | test gain r2 | test p shift | test p block | test mismatch gain | stability | chosen model | parameters |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P001 | 1 | Generalizes to held-out data | audio.timing.silence | physio.pupil.diameter | 0.800 | 1.000 | 0.320 | 1.00e-300 | 2.09e-292 | -0.438 | 1.000 | M2 sparse lagged kernel | 28 |
| P002 | 1 | Generalizes to held-out data | video.wrist_r.vy | audio.energy.d_rms | 0.400 | 1.000 | 0.419 | 1.31e-79 | 2.41e-54 | -0.349 | 1.000 | M1 single-lag linear | 5 |
| P003 | 1 | Generalizes to held-out data | video.wrist_r.y | audio.spectral.flatness | 0.400 | 0.000 | 0.411 | 1.77e-136 | 7.43e-159 | -0.330 | 1.000 | M1 single-lag linear | 5 |
| P004 | 1 | Generalizes to held-out data | video.wrist_r.y | physio.pupil.diameter | 1.300 | 1.000 | 0.125 | 2.31e-156 | 1.31e-158 | -0.103 | 1.000 | M2 sparse lagged kernel | 25 |
| P005 | 1 | Generalizes to held-out data | video.body.energy | audio.energy.rms_db | 0.500 | 1.000 | 0.220 | 4.76e-27 | 6.61e-26 | -0.111 | 0.800 | M4 small neural network | 209 |
| P006 | 1 | Generalizes to held-out data | video.wrist_r.speed | physio.eda.phasic | 3.700 | 1.000 | 0.240 | 4.60e-128 | 7.22e-102 | -0.114 | 1.000 | M4 small neural network | 417 |
| P007 | 1 | Generalizes to held-out data | video.body.energy | physio.pupil.diameter | 1.300 | 1.000 | 0.054 | 1.22e-54 | 7.74e-58 | -0.048 | 1.000 | M2 sparse lagged kernel | 24 |
| P008 | 1 | Generalizes to held-out data | audio.energy.rms_db | physio.eda.phasic | 3.200 | 1.000 | 0.209 | 7.14e-58 | 5.70e-63 | -0.037 | 1.000 | M4 small neural network | 417 |
| P009 | 1 | Generalizes to held-out data | video.body.energy | physio.eda.phasic | 3.700 | 1.000 | 0.173 | 4.61e-61 | 8.11e-47 | -0.042 | 0.800 | M4 small neural network | 417 |
| P010 | 1 | Generalizes to held-out data | video.body.energy | physio.hr.bpm | 2.100 | 1.000 | 0.108 | 2.50e-67 | 3.35e-129 | -0.148 | 1.000 | M4 small neural network | 417 |
| P011 | 1 | Generalizes to held-out data | video.elbow_r.speed | physio.hr.bpm | 2.000 | 1.000 | 0.010 | 3.85e-12 | 1.80e-10 | -0.006 | 1.000 | M1 single-lag linear | 5 |
| P012 | 1 | Did not generalize (validated on training data only) | video.hands.speed_sync | audio.timing.onset | 0.000 | 4.000 | -0.004 | 0.755 | 0.820 | -0.002 | 1.000 | M1 single-lag linear | 5 |
| P013 | 1 | Generalizes to held-out data | audio.pitch.f0_st | video.wrist_r.vy | 0.100 | 1.000 | 0.119 | 9.86e-31 | 2.79e-23 | -0.075 | 0.200 | M4 small neural network | 177 |
| P014 | 1 | Generalizes to held-out data | video.wrist_l.y | physio.hr.bpm | 1.900 | 1.000 | 0.019 | 2.95e-15 | 1.30e-20 | -0.038 | 1.000 | M4 small neural network | 401 |
| P015 | 1 | Generalizes to held-out data | audio.timing.silence | physio.hr.bpm | 1.600 | 1.000 | 0.045 | 4.62e-24 | 2.37e-25 | 0.009 | 1.000 | M5 gradient-boosted trees | 2904 |
| P016 | 1 | Generalizes to held-out data | video.hands.distance | audio.spectral.flatness | 0.500 | 0.000 | 0.135 | 9.34e-38 | 2.17e-40 | -0.157 | 0.800 | M5 gradient-boosted trees | 2428 |
| P017 | 1 | Generalizes to held-out data | audio.energy.d_rms | video.body.periodicity | 1.400 | 0.000 | 0.017 | 7.02e-12 | 1.83e-10 | -0.011 | 0.800 | M3 dense lagged kernel | 25 |
| P018 | 1 | Generalizes to held-out data | audio.spectral.flux | video.body.periodicity | 1.500 | 0.000 | 0.013 | 7.78e-11 | 2.42e-08 | -0.005 | 0.800 | M2 sparse lagged kernel | 17 |
| P019 | 2 | Generalizes to held-out data | pattern.P003.drive | physio.pupil.diameter | 0.900 | 1.000 | 0.178 | 1.12e-209 | 6.15e-180 | -0.120 | n/a | M4 small neural network | 321 |
| P020 | 2 | Generalizes to held-out data | pattern.P003.coact | physio.eda.phasic | 3.400 | 0.000 | 0.264 | 1.31e-182 | 2.33e-147 | -0.346 | n/a | M2 sparse lagged kernel | 32 |
| P021 | 2 | Generalizes to held-out data | pattern.P002.coact | physio.pupil.diameter | 0.800 | 0.000 | 0.236 | 5.11e-182 | 4.31e-193 | -0.224 | n/a | M5 gradient-boosted trees | 2920 |
| P022 | 2 | Generalizes to held-out data | pattern.P002.drive | physio.eda.phasic | 2.300 | 1.000 | 0.250 | 9.90e-115 | 5.80e-109 | -0.068 | n/a | M4 small neural network | 417 |
| P023 | 2 | Generalizes to held-out data | pattern.P017.coact | physio.eda.phasic | 1.900 | 0.000 | 0.216 | 5.21e-54 | 7.34e-65 | -0.066 | n/a | M4 small neural network | 401 |
| P024 | 2 | Generalizes to held-out data | pattern.P018.coact | physio.eda.level | 1.900 | 0.000 | 0.043 | 4.74e-63 | 7.67e-62 | -0.034 | n/a | M2 sparse lagged kernel | 33 |
| P025 | 2 | Generalizes to held-out data | pattern.P017.drive | physio.pupil.diameter | 0.000 | 4.000 | 0.016 | 9.26e-159 | 5.00e-179 | -0.047 | n/a | M5 gradient-boosted trees | 2952 |
| P026 | 2 | Generalizes to held-out data | pattern.P018.coact | physio.pupil.diameter | 0.000 | 4.000 | 0.019 | 8.48e-139 | 3.26e-220 | -0.023 | n/a | M3 dense lagged kernel | 25 |
| P027 | 2 | Generalizes to held-out data | pattern.P003.drive | physio.hr.bpm | 1.800 | 1.000 | 0.045 | 2.73e-30 | 7.88e-40 | -0.058 | n/a | M4 small neural network | 401 |
| P028 | 2 | Generalizes to held-out data | pattern.P017.coact | physio.hr.bpm | 2.700 | 0.000 | 0.012 | 2.38e-10 | 2.00e-13 | -0.006 | n/a | M1 single-lag linear | 5 |
| P029 | 2 | Generalizes to held-out data | pattern.P002.coact | physio.hr.bpm | 1.700 | 1.000 | 0.011 | 2.16e-08 | 5.47e-15 | -0.008 | n/a | M1 single-lag linear | 5 |

## Mathematical representations

| pattern | equation | best model | variants | merged groups | note |
|---|---|---|---|---|---|
| P001 | y(t) = 1.19*y(t-1.0s) + -0.20*y(t-2.0s) + -0.03*y(t-3.0s) - 0.062*x(t-0.4s) - 0.060*x(t-0.6s) - 0.064*x(t-0.8s) - 0.072*x(t-0.9s) (+20 smaller terms);  x = z[audio.timing.silence, smoothed 1 s], y = z[physio.pupil.diameter] | M4 | 28 | audio.timing -> physio.pupil; audio.spectral -> physio.pupil; audio.pitch -> physio.pupil; audio.energy -> physio.pupil |  |
| P002 | y(t) = 0.02*y(t-0.5s) + 0.01*y(t-1.5s) + 0.01*y(t-2.5s) + 0.565*x(t-0.4s);  x = z[video.wrist_r.vy, smoothed 1 s], y = z[audio.energy.d_rms] | M5 | 53 | video.wrist_r -> audio.energy; video.elbow_r -> audio.energy |  |
| P003 | y(t) = -0.02*y(t-0.5s) + -0.02*y(t-1.5s) + -0.01*y(t-2.5s) - 0.568*x(t-0.4s);  x = z[video.wrist_r.y], y = z[audio.spectral.flatness] | M5 | 193 | video.wrist_r -> audio.spectral; video.elbow_r -> audio.spectral; video.wrist_r -> audio.pitch; video.wrist_r -> audio.timing; video.elbow_r -> audio.pitch; video.elbow_r -> audio.timing |  |
| P004 | y(t) = 0.95*y(t-1.0s) + -0.32*y(t-2.0s) + 0.23*y(t-3.0s) + 0.036*x(t-0.8s) + 0.039*x(t-1.2s) + 0.039*x(t-1.3s) + 0.037*x(t-1.4s) (+17 smaller terms);  x = z[video.wrist_r.y, smoothed 1 s], y = z[physio.pupil.diameter] | M4 | 20 | video.wrist_r -> physio.pupil; video.elbow_r -> physio.pupil |  |
| P005 | z[audio.energy.rms_db](t) = f(own history at t-0.5s.., z[video.body.energy, smoothed 1 s] at lags 0..1.4 s); f = M4 (209 parameters) | M5 | 29 | video.body -> audio.energy; video.body -> audio.spectral; video.body -> audio.timing; video.body -> audio.pitch |  |
| P006 | z[physio.eda.phasic](t) = f(own history at t-1s.., z[video.wrist_r.speed, smoothed 1 s] at lags 1.7..5.7 s); f = M4 (417 parameters) | M5 | 46 | video.wrist_r -> physio.eda; video.elbow_r -> physio.eda |  |
| P007 | y(t) = 0.89*y(t-1.0s) + -0.29*y(t-2.0s) + 0.24*y(t-3.0s) + 0.032*x(t-1.0s) + 0.027*x(t-1.3s) + 0.026*x(t-1.4s) - 0.027*x(t-2.3s) (+16 smaller terms);  x = z[video.body.energy, smoothed 1 s], y = z[physio.pupil.diameter] | M2 | 2 | video.body -> physio.pupil |  |
| P008 | z[physio.eda.phasic](t) = f(own history at t-1s.., z[audio.energy.rms_db, smoothed 1 s] at lags 1.2..5.2 s); f = M4 (417 parameters) | M5 | 35 | audio.energy -> physio.eda; audio.spectral -> physio.eda; audio.timing -> physio.eda; audio.pitch -> physio.eda |  |
| P009 | z[physio.eda.phasic](t) = f(own history at t-1s.., z[video.body.energy, smoothed 1 s] at lags 1.7..5.7 s); f = M4 (417 parameters) | M5 | 7 | video.body -> physio.eda |  |
| P010 | z[physio.hr.bpm](t) = f(own history at t-1s.., z[video.body.energy, smoothed 1 s] at lags 0.1..4.1 s); f = M4 (417 parameters) | M5 | 9 | video.body -> physio.hr |  |
| P011 | y(t) = 0.94*y(t-1.0s) + -0.86*y(t-2.0s) + 0.53*y(t-3.0s) + 0.090*x(t-2.0s);  x = z[video.elbow_r.speed, smoothed 1 s], y = z[physio.hr.bpm] | M5 | 13 | video.elbow_r -> physio.hr; video.wrist_r -> physio.hr |  |
| P012 | y(t) = 0.73*y(t-0.5s) + 0.02*y(t-1.5s) + -0.04*y(t-2.5s) - 0.021*x(t-0.0s);  x = z[video.hands.speed_sync, smoothed 4 s], y = z[audio.timing.onset] | M1 | 4 | video.hands -> audio.timing |  |
| P013 | z[video.wrist_r.vy](t) = f(own history at t-0.5s.., z[audio.pitch.f0_st, smoothed 1 s] at lags 0..1 s); f = M4 (177 parameters) | M5 | 2 | audio.pitch -> video.wrist_r; audio.pitch -> video.elbow_r |  |
| P014 | z[physio.hr.bpm](t) = f(own history at t-1s.., z[video.wrist_l.y, smoothed 1 s] at lags 0..3.8 s); f = M4 (401 parameters) | M4 | 16 | video.wrist_l -> physio.hr; video.elbow_l -> physio.hr |  |
| P015 | z[physio.hr.bpm](t) = f(own history at t-1s.., z[audio.timing.silence, smoothed 1 s] at lags 0..3.6 s); f = M5 (2904 parameters) | M5 | 12 | audio.timing -> physio.hr; audio.energy -> physio.hr; audio.pitch -> physio.hr; audio.spectral -> physio.hr |  |
| P016 | z[audio.spectral.flatness](t) = f(own history at t-0.5s.., z[video.hands.distance] at lags 0..1.4 s); f = M5 (2428 parameters) | M5 | 7 | video.hands -> audio.spectral; video.hands -> audio.energy; video.hands -> audio.pitch |  |
| P017 | y(t) = 0.63*y(t-0.5s) + -0.01*y(t-1.5s) + -0.01*y(t-2.5s) + 0.029*x(t-1.4s) - 0.034*x(t-1.8s) - 0.036*x(t-1.9s) - 0.025*x(t-2.0s) (+17 smaller terms);  x = z[audio.energy.d_rms], y = z[video.body.periodicity] | M4 | 1 | audio.energy -> video.body |  |
| P018 | y(t) = 0.62*y(t-0.5s) + -0.00*y(t-1.5s) + -0.01*y(t-2.5s) + 0.027*x(t-1.5s) - 0.037*x(t-1.8s) - 0.049*x(t-1.9s) - 0.042*x(t-2.0s) (+9 smaller terms);  x = z[audio.spectral.flux], y = z[video.body.periodicity] | M4 | 1 | audio.spectral -> video.body |  |
| P019 | z[physio.pupil.diameter](t) = f(own history at t-1s.., z[pattern.P003.drive, smoothed 1 s] at lags 0..2.8 s); f = M4 (321 parameters) | M4 | 6 | pattern.P003 -> physio.pupil |  |
| P020 | y(t) = 0.52*y(t-1.0s) + -0.18*y(t-2.0s) + -0.18*y(t-3.0s) - 0.485*x(t-1.4s) + 0.179*x(t-1.5s) + 0.148*x(t-3.1s) + 0.113*x(t-5.1s) (+24 smaller terms);  x = z[pattern.P003.coact], y = z[physio.eda.phasic] | M4 | 11 | pattern.P003 -> physio.eda |  |
| P021 | z[physio.pupil.diameter](t) = f(own history at t-1s.., z[pattern.P002.coact] at lags 0..2.8 s); f = M5 (2920 parameters) | M5 | 5 | pattern.P002 -> physio.pupil |  |
| P022 | z[physio.eda.phasic](t) = f(own history at t-1s.., z[pattern.P002.drive, smoothed 1 s] at lags 0.3..4.3 s); f = M4 (417 parameters) | M5 | 11 | pattern.P002 -> physio.eda |  |
| P023 | z[physio.eda.phasic](t) = f(own history at t-1s.., z[pattern.P017.coact] at lags 0..3.8 s); f = M4 (401 parameters) | M4 | 9 | pattern.P017 -> physio.eda |  |
| P024 | y(t) = 1.11*y(t-1.0s) + -0.29*y(t-2.0s) + 0.02*y(t-3.0s) - 0.061*x(t-0.0s) + 0.032*x(t-1.5s) + 0.035*x(t-1.6s) - 0.042*x(t-3.9s) (+25 smaller terms);  x = z[pattern.P018.coact], y = z[physio.eda.level] | M3 | 7 | pattern.P018 -> physio.eda |  |
| P025 | z[physio.pupil.diameter](t) = f(own history at t-1s.., z[pattern.P017.drive, smoothed 4 s] at lags 0..2 s); f = M5 (2952 parameters) | M5 | 6 | pattern.P017 -> physio.pupil |  |
| P026 | y(t) = 1.52*y(t-1.0s) + -0.50*y(t-2.0s) + -0.07*y(t-3.0s) + 6.346*x(t-0.0s) - 10.542*x(t-0.1s) + 5.116*x(t-0.2s) - 1.737*x(t-0.4s) (+17 smaller terms);  x = z[pattern.P018.coact, smoothed 4 s], y = z[physio.pupil.diameter] | M3 | 4 | pattern.P018 -> physio.pupil |  |
| P027 | z[physio.hr.bpm](t) = f(own history at t-1s.., z[pattern.P003.drive, smoothed 1 s] at lags 0..3.8 s); f = M4 (401 parameters) | M4 | 4 | pattern.P003 -> physio.hr |  |
| P028 | y(t) = 0.82*y(t-1.0s) + -0.77*y(t-2.0s) + 0.48*y(t-3.0s) - 0.079*x(t-2.7s);  x = z[pattern.P017.coact], y = z[physio.hr.bpm] | M2 | 1 | pattern.P017 -> physio.hr |  |
| P029 | y(t) = 0.93*y(t-1.0s) + -0.85*y(t-2.0s) + 0.53*y(t-3.0s) + 0.115*x(t-1.7s);  x = z[pattern.P002.coact, smoothed 1 s], y = z[physio.hr.bpm] | M2 | 3 | pattern.P002 -> physio.hr |  |

## Model ladder (minimum-intelligence selection)

| pattern | model | description | parameters | flops per prediction | fit cpu s | validation gain r2 | validation bits per sample | chosen |
|---|---|---|---|---|---|---|---|---|
| P001 | M1 | single-lag linear | 5 | 10 | 9.42e-04 | 0.185 | 0.649 | no |
| P001 | M2 | sparse lagged kernel | 28 | 56 | 0.098 | 0.286 | 1.805 | yes |
| P001 | M3 | dense lagged kernel | 33 | 66 | 0.032 | 0.286 | 1.804 | no |
| P001 | M4 | small neural network | 321 | 642 | 1.073 | 0.292 | 1.670 | no |
| P001 | M5 | gradient-boosted trees | 2952 | 400 | 0.117 | 0.284 | -1.568 | no |
| P002 | M1 | single-lag linear | 5 | 10 | 3.54e-04 | 0.454 | 0.436 | yes |
| P002 | M2 | sparse lagged kernel | 7 | 14 | 0.018 | 0.467 | 0.448 | no |
| P002 | M3 | dense lagged kernel | 19 | 38 | 0.008 | 0.467 | 0.423 | no |
| P002 | M4 | small neural network | 209 | 418 | 0.452 | 0.469 | 0.027 | no |
| P002 | M5 | gradient-boosted trees | 2696 | 400 | 0.052 | 0.470 | -5.203 | no |
| P003 | M1 | single-lag linear | 5 | 10 | 3.99e-04 | 0.447 | 0.414 | yes |
| P003 | M2 | sparse lagged kernel | 16 | 32 | 0.021 | 0.466 | 0.416 | no |
| P003 | M3 | dense lagged kernel | 19 | 38 | 0.007 | 0.463 | 0.406 | no |
| P003 | M4 | small neural network | 209 | 418 | 0.382 | 0.493 | 0.047 | no |
| P003 | M5 | gradient-boosted trees | 2588 | 400 | 0.050 | 0.502 | -4.946 | no |
| P004 | M1 | single-lag linear | 5 | 10 | 6.66e-04 | 0.088 | 0.239 | no |
| P004 | M2 | sparse lagged kernel | 25 | 50 | 0.054 | 0.128 | 0.361 | yes |
| P004 | M3 | dense lagged kernel | 38 | 76 | 0.038 | 0.128 | 0.345 | no |
| P004 | M4 | small neural network | 353 | 706 | 1.040 | 0.139 | 0.031 | no |
| P004 | M5 | gradient-boosted trees | 2936 | 400 | 0.127 | 0.130 | -2.937 | no |
| P005 | M1 | single-lag linear | 5 | 10 | 3.95e-04 | 0.143 | 0.151 | no |
| P005 | M2 | sparse lagged kernel | 15 | 30 | 0.026 | 0.219 | 0.229 | no |
| P005 | M3 | dense lagged kernel | 20 | 40 | 0.009 | 0.218 | 0.216 | no |
| P005 | M4 | small neural network | 209 | 418 | 1.157 | 0.309 | -0.044 | yes |
| P005 | M5 | gradient-boosted trees | 2820 | 400 | 0.065 | 0.319 | -5.519 | no |
| P006 | M1 | single-lag linear | 5 | 10 | 9.28e-04 | 0.090 | 0.143 | no |
| P006 | M2 | sparse lagged kernel | 28 | 56 | 0.117 | 0.214 | 0.378 | no |
| P006 | M3 | dense lagged kernel | 45 | 90 | 0.036 | 0.214 | 0.359 | no |
| P006 | M4 | small neural network | 417 | 834 | 1.201 | 0.256 | 0.048 | yes |
| P006 | M5 | gradient-boosted trees | 2860 | 400 | 0.147 | 0.269 | -2.715 | no |
| P007 | M1 | single-lag linear | 5 | 10 | 9.17e-04 | 0.048 | 0.121 | no |
| P007 | M2 | sparse lagged kernel | 24 | 48 | 0.056 | 0.071 | 0.163 | yes |
| P007 | M3 | dense lagged kernel | 38 | 76 | 0.029 | 0.070 | 0.145 | no |
| P007 | M4 | small neural network | 353 | 706 | 0.699 | 0.060 | -0.242 | no |
| P007 | M5 | gradient-boosted trees | 2908 | 400 | 0.119 | 0.070 | -3.115 | no |
| P008 | M1 | single-lag linear | 5 | 10 | 6.91e-04 | 0.042 | 0.063 | no |
| P008 | M2 | sparse lagged kernel | 14 | 28 | 0.044 | 0.104 | 0.158 | no |
| P008 | M3 | dense lagged kernel | 45 | 90 | 0.036 | 0.107 | 0.127 | no |
| P008 | M4 | small neural network | 417 | 834 | 1.153 | 0.196 | -0.114 | yes |
| P008 | M5 | gradient-boosted trees | 2804 | 400 | 0.166 | 0.224 | -2.785 | no |
| P009 | M1 | single-lag linear | 5 | 10 | 8.67e-04 | 0.040 | 0.059 | no |
| P009 | M2 | sparse lagged kernel | 14 | 28 | 0.061 | 0.109 | 0.167 | no |
| P009 | M3 | dense lagged kernel | 45 | 90 | 0.048 | 0.110 | 0.134 | no |
| P009 | M4 | small neural network | 417 | 834 | 2.580 | 0.197 | -0.110 | yes |
| P009 | M5 | gradient-boosted trees | 2684 | 400 | 0.193 | 0.208 | -2.686 | no |
| P010 | M1 | single-lag linear | 5 | 10 | 6.30e-04 | 0.018 | 0.033 | no |
| P010 | M2 | sparse lagged kernel | 27 | 54 | 0.075 | 0.041 | 0.054 | no |
| P010 | M3 | dense lagged kernel | 45 | 90 | 0.036 | 0.042 | 0.036 | no |
| P010 | M4 | small neural network | 417 | 834 | 1.679 | 0.099 | -0.258 | yes |
| P010 | M5 | gradient-boosted trees | 2912 | 400 | 0.150 | 0.100 | -3.094 | no |
| P011 | M1 | single-lag linear | 5 | 10 | 0.001 | 0.015 | 0.027 | yes |
| P011 | M2 | sparse lagged kernel | 36 | 72 | 0.123 | 0.026 | 0.013 | no |
| P011 | M3 | dense lagged kernel | 45 | 90 | 0.037 | 0.025 | 0.001 | no |
| P011 | M4 | small neural network | 417 | 834 | 1.578 | 0.015 | -0.442 | no |
| P011 | M5 | gradient-boosted trees | 2848 | 400 | 0.136 | 0.028 | -3.182 | no |
| P012 | M1 | single-lag linear | 5 | 10 | 3.57e-04 | 0.009 | 0.019 | yes |
| P012 | M2 | sparse lagged kernel | 7 | 14 | 0.024 | 0.008 | 0.012 | no |
| P012 | M3 | dense lagged kernel | 15 | 30 | 0.008 | 0.006 | -0.010 | no |
| P012 | M4 | small neural network | 177 | 354 | 0.602 | 0.001 | -0.361 | no |
| P012 | M5 | gradient-boosted trees | 2800 | 400 | 0.078 | -0.003 | -5.889 | no |
| P013 | M1 | single-lag linear | 5 | 10 | 3.72e-04 | 0.027 | 0.018 | no |
| P013 | M2 | sparse lagged kernel | 16 | 32 | 0.015 | 0.032 | -0.002 | no |
| P013 | M3 | dense lagged kernel | 16 | 32 | 0.008 | 0.032 | -0.002 | no |
| P013 | M4 | small neural network | 177 | 354 | 0.509 | 0.139 | -0.256 | yes |
| P013 | M5 | gradient-boosted trees | 2648 | 400 | 0.068 | 0.155 | -5.440 | no |
| P014 | M1 | single-lag linear | 5 | 10 | 6.55e-04 | 0.007 | 0.013 | no |
| P014 | M2 | sparse lagged kernel | 32 | 64 | 0.064 | 0.017 | 2.41e-04 | no |
| P014 | M3 | dense lagged kernel | 44 | 88 | 0.047 | 0.018 | -0.012 | no |
| P014 | M4 | small neural network | 401 | 802 | 1.589 | 0.031 | -0.392 | yes |
| P014 | M5 | gradient-boosted trees | 2900 | 400 | 0.197 | 0.029 | -3.240 | no |
| P015 | M1 | single-lag linear | 5 | 10 | 9.56e-04 | 0.005 | 0.008 | no |
| P015 | M2 | sparse lagged kernel | 24 | 48 | 0.052 | 0.013 | 0.002 | no |
| P015 | M3 | dense lagged kernel | 41 | 82 | 0.029 | 0.014 | -0.016 | no |
| P015 | M4 | small neural network | 385 | 770 | 1.401 | 0.016 | -0.403 | no |
| P015 | M5 | gradient-boosted trees | 2904 | 400 | 0.155 | 0.031 | -3.242 | yes |
| P016 | M1 | single-lag linear | 5 | 10 | 5.14e-04 | 0.014 | 0.008 | no |
| P016 | M2 | sparse lagged kernel | 15 | 30 | 0.016 | 0.014 | -0.013 | no |
| P016 | M3 | dense lagged kernel | 20 | 40 | 0.009 | 0.015 | -0.023 | no |
| P016 | M4 | small neural network | 209 | 418 | 0.441 | 0.124 | -0.338 | no |
| P016 | M5 | gradient-boosted trees | 2428 | 400 | 0.055 | 0.182 | -4.957 | yes |
| P017 | M1 | single-lag linear | 5 | 10 | 5.39e-04 | 0.007 | 0.005 | no |
| P017 | M2 | sparse lagged kernel | 14 | 28 | 0.015 | 0.020 | 6.55e-04 | no |
| P017 | M3 | dense lagged kernel | 25 | 50 | 0.009 | 0.022 | -0.021 | yes |
| P017 | M4 | small neural network | 257 | 514 | 0.316 | 0.034 | -0.517 | no |
| P017 | M5 | gradient-boosted trees | 2628 | 400 | 0.080 | 0.029 | -5.747 | no |
| P018 | M1 | single-lag linear | 5 | 10 | 4.04e-04 | 0.003 | 0.001 | no |
| P018 | M2 | sparse lagged kernel | 17 | 34 | 0.014 | 0.020 | -0.006 | yes |
| P018 | M3 | dense lagged kernel | 25 | 50 | 0.009 | 0.023 | -0.020 | no |
| P018 | M4 | small neural network | 257 | 514 | 0.573 | 0.032 | -0.520 | no |
| P018 | M5 | gradient-boosted trees | 2720 | 400 | 0.062 | 0.019 | -5.961 | no |
| P019 | M1 | single-lag linear | 5 | 10 | 8.81e-04 | 0.089 | 0.241 | no |
| P019 | M2 | sparse lagged kernel | 23 | 46 | 0.055 | 0.129 | 0.365 | no |
| P019 | M3 | dense lagged kernel | 34 | 68 | 0.028 | 0.129 | 0.351 | no |
| P019 | M4 | small neural network | 321 | 642 | 1.178 | 0.151 | 0.121 | yes |
| P019 | M5 | gradient-boosted trees | 2940 | 400 | 0.118 | 0.133 | -2.932 | no |
| P020 | M1 | single-lag linear | 5 | 10 | 6.60e-04 | 0.173 | 0.238 | no |
| P020 | M2 | sparse lagged kernel | 32 | 64 | 0.242 | 0.299 | 0.450 | yes |
| P020 | M3 | dense lagged kernel | 45 | 90 | 0.042 | 0.299 | 0.436 | no |
| P020 | M4 | small neural network | 417 | 834 | 1.492 | 0.335 | 0.095 | no |
| P020 | M5 | gradient-boosted trees | 2884 | 400 | 0.141 | 0.290 | -2.852 | no |
| P021 | M1 | single-lag linear | 5 | 10 | 6.17e-04 | 0.093 | 0.172 | no |
| P021 | M2 | sparse lagged kernel | 21 | 42 | 0.279 | 0.157 | 0.303 | no |
| P021 | M3 | dense lagged kernel | 33 | 66 | 0.028 | 0.157 | 0.289 | no |
| P021 | M4 | small neural network | 321 | 642 | 1.189 | 0.220 | 0.142 | no |
| P021 | M5 | gradient-boosted trees | 2920 | 400 | 0.115 | 0.239 | -2.786 | yes |
| P022 | M1 | single-lag linear | 5 | 10 | 6.49e-04 | 0.104 | 0.168 | no |
| P022 | M2 | sparse lagged kernel | 32 | 64 | 0.180 | 0.194 | 0.324 | no |
| P022 | M3 | dense lagged kernel | 45 | 90 | 0.042 | 0.194 | 0.309 | no |
| P022 | M4 | small neural network | 417 | 834 | 1.417 | 0.226 | -0.039 | yes |
| P022 | M5 | gradient-boosted trees | 2876 | 400 | 0.122 | 0.245 | -2.815 | no |
| P023 | M1 | single-lag linear | 5 | 10 | 9.11e-04 | 0.062 | 0.075 | no |
| P023 | M2 | sparse lagged kernel | 31 | 62 | 0.724 | 0.148 | 0.168 | no |
| P023 | M3 | dense lagged kernel | 44 | 88 | 0.049 | 0.147 | 0.152 | no |
| P023 | M4 | small neural network | 401 | 802 | 2.680 | 0.252 | -0.075 | yes |
| P023 | M5 | gradient-boosted trees | 2704 | 400 | 0.164 | 0.202 | -2.826 | no |
| P024 | M1 | single-lag linear | 5 | 10 | 6.27e-04 | 0.019 | 0.056 | no |
| P024 | M2 | sparse lagged kernel | 33 | 66 | 0.096 | 0.052 | 0.134 | yes |
| P024 | M3 | dense lagged kernel | 44 | 88 | 0.040 | 0.053 | 0.122 | no |
| P024 | M4 | small neural network | 401 | 802 | 1.602 | 0.030 | -0.366 | no |
| P024 | M5 | gradient-boosted trees | 2740 | 400 | 0.207 | 0.013 | -3.118 | no |
| P025 | M1 | single-lag linear | 5 | 10 | 6.25e-04 | 0.003 | 0.047 | no |
| P025 | M2 | sparse lagged kernel | 22 | 44 | 0.093 | 0.002 | 0.025 | no |
| P025 | M3 | dense lagged kernel | 25 | 50 | 0.018 | 0.002 | 0.017 | no |
| P025 | M4 | small neural network | 257 | 514 | 1.346 | 0.004 | -0.220 | no |
| P025 | M5 | gradient-boosted trees | 2952 | 400 | 0.110 | 0.014 | -3.031 | yes |
| P026 | M1 | single-lag linear | 5 | 10 | 7.22e-04 | 0.002 | 0.030 | no |
| P026 | M2 | sparse lagged kernel | 9 | 18 | 0.324 | 0.013 | 0.284 | no |
| P026 | M3 | dense lagged kernel | 25 | 50 | 0.018 | 0.015 | 0.317 | yes |
| P026 | M4 | small neural network | 257 | 514 | 0.878 | 0.011 | -0.046 | no |
| P026 | M5 | gradient-boosted trees | 2844 | 400 | 0.110 | -0.006 | -3.328 | no |
| P027 | M1 | single-lag linear | 5 | 10 | 6.55e-04 | 0.012 | 0.021 | no |
| P027 | M2 | sparse lagged kernel | 32 | 64 | 0.141 | 0.021 | 0.007 | no |
| P027 | M3 | dense lagged kernel | 43 | 86 | 0.035 | 0.019 | -0.008 | no |
| P027 | M4 | small neural network | 401 | 802 | 1.723 | 0.044 | -0.366 | yes |
| P027 | M5 | gradient-boosted trees | 2896 | 400 | 0.136 | 0.033 | -3.229 | no |
| P028 | M1 | single-lag linear | 5 | 10 | 6.56e-04 | 0.013 | 0.019 | yes |
| P028 | M2 | sparse lagged kernel | 32 | 64 | 0.242 | 0.019 | -0.002 | no |
| P028 | M3 | dense lagged kernel | 45 | 90 | 0.043 | 0.018 | -0.018 | no |
| P028 | M4 | small neural network | 417 | 834 | 1.091 | -0.014 | -0.491 | no |
| P028 | M5 | gradient-boosted trees | 2900 | 400 | 0.151 | -0.004 | -3.303 | no |
| P029 | M1 | single-lag linear | 5 | 10 | 7.25e-04 | 0.006 | 0.010 | yes |
| P029 | M2 | sparse lagged kernel | 17 | 34 | 0.308 | 0.011 | 0.006 | no |
| P029 | M3 | dense lagged kernel | 42 | 84 | 0.035 | 0.010 | -0.023 | no |
| P029 | M4 | small neural network | 385 | 770 | 0.819 | 0.007 | -0.420 | no |
| P029 | M5 | gradient-boosted trees | 2904 | 400 | 0.130 | 0.007 | -3.288 | no |

## Other cross-modal measures at the discovered lag

| pattern | plv | plv null | mi nonlinear excess nats | dtw ratio | motif ratio |
|---|---|---|---|---|---|
| P001 | 0.843 | 0.045 | 0.062 | 1.439 | 0.460 |
| P002 | 0.547 | 0.064 | 0.001 | 0.687 | 0.842 |
| P003 | 0.606 | 0.150 | -0.064 | 1.021 | 0.954 |
| P004 | 0.527 | 0.044 | 0.059 | 0.726 | 0.595 |
| P005 | 0.412 | 0.068 | 0.054 | 0.766 | 0.962 |
| P006 | 0.294 | 0.037 | 0.023 | 0.756 | 0.861 |
| P007 | 0.370 | 0.042 | 0.039 | 0.774 | 0.744 |
| P008 | 0.228 | 0.037 | 0.043 | 0.841 | 0.883 |
| P009 | 0.159 | 0.041 | 0.067 | 0.821 | 0.941 |
| P010 | 0.214 | 0.027 | 0.046 | 0.822 | 0.972 |
| P011 | 0.168 | 0.025 | 0.018 | 0.862 | 0.928 |
| P012 | 0.122 | 0.078 | 0.081 | 1.000 | 0.987 |
| P013 | 0.115 | 0.060 | 0.188 | n/a | n/a |
| P014 | 0.111 | 0.029 | 0.027 | 0.928 | 0.906 |
| P015 | 0.126 | 0.030 | 0.005 | 1.104 | 1.000 |
| P016 | 0.153 | 0.056 | 0.003 | 0.990 | 0.976 |
| P017 | 0.062 | 0.021 | 0.009 | 1.003 | 0.983 |
| P018 | 0.083 | 0.034 | -7.04e-04 | 1.001 | 0.984 |
| P019 | 0.526 | 0.052 | 0.078 | 1.231 | 0.602 |
| P020 | 0.384 | 0.037 | 0.023 | 0.706 | 0.941 |
| P021 | 0.558 | 0.036 | 0.118 | 0.527 | 0.707 |
| P022 | 0.211 | 0.023 | 0.054 | 1.045 | 0.843 |
| P023 | 0.263 | 0.038 | 0.103 | 0.791 | 0.902 |
| P024 | 0.262 | 0.040 | 0.156 | 0.770 | 0.920 |
| P025 | 0.284 | 0.021 | 0.041 | 1.022 | 0.579 |
| P026 | 0.694 | 0.055 | 0.233 | 0.431 | 0.707 |
| P027 | 0.179 | 0.035 | 0.029 | 1.139 | 0.911 |
| P028 | 0.130 | 0.043 | 0.031 | 1.162 | 0.960 |
| P029 | 0.167 | 0.034 | 0.022 | 0.900 | 0.961 |

## Search strategy comparison

| strategy | candidates | screened on subsample | full null tests | predictive checks | confirmed families | ops | cpu s | ops vs exhaustive | recall of exhaustive families |
|---|---|---|---|---|---|---|---|---|---|
| exhaustive | 2589 | 0 | 2589 | 2589 | 49 | 8.02e+09 | 178.266 | 1.000 | 1.000 |
| staged | 2589 | 0 | 2589 | 725 | 49 | 3.80e+09 | 65.325 | 0.474 | 1.000 |
| adaptive | 2589 | 1556 | 762 | 612 | 43 | 2.29e+09 | 45.751 | 0.285 | 0.878 |

## What the adaptive search learned to attend to

| arm | pulls | successes | posterior mean | retired | untested |
|---|---|---|---|---|---|
| audio.spectral -> physio.hr | 12 | 12 | 0.929 | no | 0 |
| video.body -> physio.hr | 9 | 9 | 0.909 | no | 0 |
| audio.timing -> physio.pupil | 9 | 9 | 0.909 | no | 0 |
| audio.energy -> physio.pupil | 6 | 6 | 0.875 | no | 0 |
| audio.energy -> physio.eda | 12 | 11 | 0.857 | no | 0 |
| audio.spectral -> physio.pupil | 12 | 11 | 0.857 | no | 0 |
| video.wrist_r -> physio.eda | 42 | 36 | 0.841 | no | 0 |
| audio.spectral -> physio.eda | 24 | 20 | 0.808 | no | 0 |
| audio.pitch -> physio.eda | 18 | 15 | 0.800 | no | 0 |
| video.wrist_r -> physio.hr | 21 | 17 | 0.783 | no | 0 |
| video.wrist_r -> audio.energy | 42 | 33 | 0.773 | no | 0 |
| video.wrist_r -> audio.spectral | 84 | 62 | 0.733 | no | 0 |
| audio.pitch -> physio.pupil | 9 | 7 | 0.727 | no | 0 |
| video.elbow_r -> physio.hr | 21 | 15 | 0.696 | no | 0 |
| video.wrist_l -> physio.hr | 21 | 14 | 0.652 | no | 0 |
| video.wrist_r -> physio.pupil | 21 | 14 | 0.652 | no | 0 |
| video.elbow_l -> physio.hr | 21 | 14 | 0.652 | no | 0 |
| audio.timing -> physio.hr | 9 | 6 | 0.636 | no | 0 |
| audio.timing -> physio.hrv | 9 | 6 | 0.636 | no | 0 |
| video.wrist_r -> audio.timing | 63 | 39 | 0.615 | no | 0 |
| audio.timing -> physio.eda | 18 | 11 | 0.600 | no | 0 |
| video.elbow_r -> audio.spectral | 84 | 50 | 0.593 | no | 0 |
| video.elbow_r -> audio.energy | 42 | 25 | 0.591 | no | 0 |
| video.hands -> physio.resp | 12 | 7 | 0.571 | no | 0 |
| video.elbow_r -> physio.eda | 42 | 24 | 0.568 | no | 0 |
| video.elbow_r -> physio.pupil | 21 | 12 | 0.565 | no | 0 |
| video.elbow_l -> physio.resp | 42 | 22 | 0.523 | no | 0 |
| video.elbow_r -> audio.timing | 63 | 32 | 0.508 | no | 0 |
| audio.energy -> physio.hr | 6 | 3 | 0.500 | no | 0 |
| video.body -> audio.timing | 27 | 13 | 0.483 | no | 0 |
| video.wrist_r -> audio.pitch | 63 | 30 | 0.477 | no | 0 |
| video.hands -> audio.timing | 18 | 8 | 0.450 | no | 0 |
| video.body -> physio.eda | 18 | 8 | 0.450 | no | 0 |
| audio.timing -> physio.resp | 18 | 8 | 0.450 | no | 0 |
| video.wrist_l -> physio.resp | 42 | 17 | 0.409 | no | 0 |
| video.body -> audio.energy | 18 | 7 | 0.400 | no | 0 |
| video.body -> audio.spectral | 36 | 14 | 0.395 | no | 0 |
| video.elbow_r -> audio.pitch | 63 | 24 | 0.385 | no | 0 |
| video.hands -> audio.spectral | 24 | 9 | 0.385 | no | 0 |
| video.hands -> physio.hrv | 6 | 2 | 0.375 | no | 0 |

## Shared latent movement-sound component (CCA)

| lag s | validation r | test r | p shift | null mean abs r | top movement weights | top sound weights |
|---|---|---|---|---|---|---|
| 0.500 | 0.706 | 0.674 | 0.010 | 0.023 | video.wrist_r.y +0.76; video.hands.distance -0.38; video.wrist_r.x -0.28; video.wrist_r.speed +0.26; video.wrist_l.x +0.24 | audio.energy.rms_db +0.75; audio.pitch.voiced -0.47; audio.spectral.flatness +0.41; audio.timing.silence -0.22; audio.spectral.centroid_log -0.05 |

## Did pattern-derived (level-2) signals help?

| target | best raw signal | raw test gain | raw params | best pattern signal | pattern test gain | pattern params | abstraction helped |
|---|---|---|---|---|---|---|---|
| physio.eda.level | video.wrist_r.y (scale 0 s, lag 3.5 s) | 0.100 | 34 | pattern.P018.coact | 0.043 | 33 | no |
| physio.eda.phasic | video.wrist_r.speed (scale 1 s, lag 3.7 s) | 0.232 | 417 | pattern.P003.coact | 0.264 | 32 | yes |
| physio.hr.bpm | video.body.energy (scale 1 s, lag 2.1 s) | 0.103 | 417 | pattern.P003.drive | 0.045 | 401 | no |
| physio.pupil.diameter | audio.timing.silence (scale 1 s, lag 0.8 s) | 0.320 | 28 | pattern.P003.drive | 0.178 | 321 | no |

## Evolutionary versus random versus greedy search

| target | method | seed | evals | best val bits | evals to 90pct | terms | genome | test gain |
|---|---|---|---|---|---|---|---|---|
| physio.pupil.diameter | evolutionary | 0 | 308 | 0.824 | 207 | 4 | audio.spectral.flatness@1s lag 0.1s; audio.spectral.flatness@1s lag 1.0s; audio.timing.silence@1s lag 0.6s; video.head.z_est@0s lag 4.7s | 0.337 |
| physio.pupil.diameter | random | 0 | 300 | 0.413 | 88 | 1 | audio.spectral.flatness@1s lag 0.3s | 0.200 |
| physio.pupil.diameter | greedy | 0 | 300 | 1.148 | 238 | 4 | audio.timing.silence@0s lag 0.7s; audio.timing.silence@1s lag 0.5s; audio.pitch.voiced@4s lag 1.8s; audio.pitch.voiced@0s lag 1.1s | 0.381 |
| physio.pupil.diameter | evolutionary | 1 | 311 | 1.072 | 296 | 4 | audio.spectral.flatness@1s lag 0.7s; audio.spectral.zcr@4s lag 3.8s; video.wrist_r.vy@4s lag 5.2s; audio.spectral.flatness@1s lag 0.6s | 0.376 |
| physio.pupil.diameter | random | 1 | 300 | 0.769 | 177 | 4 | video.body.energy@1s lag 2.7s; audio.energy.d_rms@0s lag 3.2s; video.wrist_l.vy@1s lag 3.2s; audio.spectral.flatness@1s lag 0.5s | 0.317 |
| physio.pupil.diameter | greedy | 1 | 300 | 0.385 | 227 | 4 | video.wrist_r.accel@4s lag 2.5s; video.wrist_r.accel@4s lag 3.8s; audio.spectral.flatness@1s lag 0.2s; video.elbow_r.speed@1s lag 0.3s | 0.173 |
| physio.pupil.diameter | evolutionary | 2 | 312 | 1.080 | 210 | 2 | audio.pitch.voiced@1s lag 0.6s; audio.spectral.centroid_log@4s lag 3.9s | 0.375 |
| physio.pupil.diameter | random | 2 | 300 | 0.753 | 17 | 3 | audio.pitch.voiced@1s lag 0.7s; video.head.z_est@4s lag 2.3s; video.elbow_l.speed@4s lag 2.0s | 0.326 |
| physio.pupil.diameter | greedy | 2 | 300 | 0.743 | 252 | 4 | audio.timing.silence@0s lag 0.7s; video.wrist_r.y@1s lag 0.8s; audio.energy.rms_db@0s lag 1.0s; audio.pitch.voiced@4s lag 3.5s | 0.305 |
| physio.eda.phasic | evolutionary | 0 | 311 | 0.351 | 227 | 3 | video.elbow_r.speed@1s lag 3.1s; video.elbow_r.accel@4s lag 1.5s; audio.spectral.centroid_log@1s lag 3.1s | 0.191 |
| physio.eda.phasic | random | 0 | 300 | 0.286 | 189 | 2 | video.wrist_l.x@4s lag 6.4s; video.wrist_r.speed@1s lag 3.4s | 0.146 |
| physio.eda.phasic | greedy | 0 | 300 | 0.143 | 227 | 4 | audio.spectral.zcr@0s lag 2.9s; video.body.energy@1s lag 1.5s; audio.energy.d_rms@1s lag 2.0s; video.body.energy@4s lag 3.6s | 0.097 |
| physio.eda.phasic | evolutionary | 1 | 301 | 0.316 | 173 | 4 | video.wrist_r.z_speed_est@1s lag 6.7s; audio.pitch.f0_st@1s lag 3.0s; video.wrist_r.accel@4s lag 3.4s; video.wrist_r.accel@1s lag 3.2s | 0.175 |
| physio.eda.phasic | random | 1 | 300 | 0.309 | 247 | 4 | video.wrist_r.speed@1s lag 3.3s; video.head.y@1s lag 4.5s; audio.timing.onset@4s lag 7.7s; video.head.accel@4s lag 1.7s | 0.171 |
| physio.eda.phasic | greedy | 1 | 300 | 0.283 | 298 | 4 | video.wrist_r.accel@0s lag 3.7s; video.wrist_r.z_est@4s lag 4.6s; audio.pitch.f0_st@0s lag 2.8s; video.elbow_r.y@1s lag 3.4s | 0.178 |
| physio.eda.phasic | evolutionary | 2 | 317 | 0.244 | 248 | 3 | video.wrist_r.accel@4s lag 4.3s; video.elbow_r.accel@1s lag 3.0s; video.wrist_r.speed@4s lag 0.7s | 0.165 |
| physio.eda.phasic | random | 2 | 300 | 0.202 | 60 | 4 | video.hands.distance@1s lag 1.4s; video.elbow_r.accel@0s lag 2.6s; video.head.z_est@4s lag 6.1s; video.elbow_r.speed@1s lag 3.5s | 0.108 |
| physio.eda.phasic | greedy | 2 | 300 | 0.270 | 250 | 4 | video.elbow_r.speed@4s lag 4.0s; audio.timing.onset@4s lag 0.6s; video.elbow_r.speed@1s lag 3.5s; audio.timing.silence@1s lag 1.3s | 0.141 |
| physio.eda.level | evolutionary | 0 | 301 | 0.383 | 191 | 4 | video.elbow_r.speed@1s lag 3.1s; audio.spectral.zcr@0s lag 2.9s; video.body.energy@1s lag 3.4s; video.elbow_r.accel@0s lag 3.8s | 0.090 |
| physio.eda.level | random | 0 | 300 | 0.317 | 129 | 2 | video.wrist_l.x@4s lag 6.4s; video.wrist_r.speed@1s lag 3.4s | 0.072 |
| physio.eda.level | greedy | 0 | 300 | 0.195 | 228 | 4 | video.elbow_r.y@4s lag 2.2s; video.body.energy@1s lag 1.5s; audio.energy.d_rms@1s lag 2.0s; video.wrist_r.y@1s lag 0.7s | 0.056 |
| physio.eda.level | evolutionary | 1 | 310 | 0.407 | 213 | 4 | video.wrist_r.accel@1s lag 3.1s; audio.pitch.f0_st@0s lag 2.9s; video.wrist_r.accel@1s lag 3.4s; video.elbow_r.vy@0s lag 4.7s | 0.095 |
| physio.eda.level | random | 1 | 300 | 0.372 | 247 | 4 | video.wrist_r.speed@1s lag 3.3s; video.head.y@1s lag 4.5s; audio.timing.onset@4s lag 7.7s; video.head.accel@4s lag 1.7s | 0.086 |
| physio.eda.level | greedy | 1 | 300 | 0.347 | 262 | 4 | video.wrist_r.accel@4s lag 2.5s; video.body.energy@1s lag 3.6s; audio.pitch.f0_st@0s lag 2.8s; video.elbow_r.y@1s lag 3.4s | 0.088 |
| physio.eda.level | evolutionary | 2 | 306 | 0.434 | 223 | 4 | video.wrist_r.speed@1s lag 3.6s; audio.spectral.flatness@1s lag 2.7s; video.wrist_r.speed@1s lag 3.1s; video.wrist_r.speed@1s lag 3.4s | 0.100 |
| physio.eda.level | random | 2 | 300 | 0.291 | 175 | 2 | video.wrist_r.speed@1s lag 2.9s; video.elbow_l.speed@4s lag 0.6s | 0.084 |
| physio.eda.level | greedy | 2 | 300 | 0.280 | 250 | 4 | video.elbow_r.speed@4s lag 4.0s; video.elbow_r.speed@4s lag 2.2s; video.elbow_r.speed@1s lag 3.5s; audio.timing.onset@1s lag 3.0s | 0.065 |

## Synthetic ground-truth check

| id | description | found validation | found generalized | patterns |
|---|---|---|---|---|
| GT1 | right-arm movement -> sound loudness/onset (sound follows by ~0.2-0.8 s) | yes | yes | P002, P003, P005, P012, P013, P016 |
| GT3 | sound bursts after large strokes -> EDA response (~2 s later) | yes | yes | P006, P008, P009, P020, P022, P023, P024 |
| GT4 | sound-burst onsets -> pupil dilation (~0.9 s later) | yes | yes | P001, P004, P007, P019, P021, P025, P026 |
| GT5 | movement pauses -> heart-rate deceleration (~3 s later; weak by design) | yes | yes | P010, P011, P014, P015, P027, P028, P029 |

## Notes, assumptions and limitations

- SYNTHETIC DATA: generated by empc.synthetic with planted relationships. Results test the software only and are not evidence about human behaviour.
- World: coupled (planted relationships present); 10 videos x 3 viewers x 120 s; seed 0.
- Held-out test videos: synvideo07, synvideo08, synvideo09; held-out viewers: synviewer2
- Associations and predictive relationships are not causal claims and do not reveal universal principles of human behaviour.
- Monocular pose depth (features ending in _est) is a model estimate, not a physical measurement.
- Patterns are named with neutral identifiers only; no psychological or intentional meaning is assigned.
- Significance relies on circular-shift and block-shuffle surrogates; p-values smaller than the surrogate count allows are tail extrapolations (Gumbel or Gaussian fits) and are approximate.
- Validation data overlaps the data used to choose lags; only the held-out test recordings give an unbiased estimate.
- With few recordings, held-out testing cannot show that a pattern generalises to new people.
