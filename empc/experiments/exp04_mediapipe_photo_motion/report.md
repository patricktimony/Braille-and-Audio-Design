# EMPC experiment report

## Plain-language summary

```
The system examined 1368 possible relationships between 39 movement, 12 sound and 0 physiological signals.
13 relationship groups passed the training-data tests (shuffled-time controls, false-discovery-rate correction and a validation stretch). 7 of them also predicted held-out data better than shuffled controls.
- Pattern 001: changes in audio.timing.silence tend to follow video.head.speed by about 0.4 s. On held-out recordings the leader signal explained an extra 70.1% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 7.72e-05). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
- Pattern 002: changes in audio.timing.silence tend to follow video.face.mouth_aperture by about 0.4 s. On held-out recordings the leader signal explained an extra 73.1% of the follower's variance beyond the follower's own recent past (p 8.86e-04 against time-shifted and block-shuffled controls). Compact form: sparse lagged kernel with 16 numbers. Found in 100% of resampled training sets.
- Pattern 004: changes in video.head.speed tend to follow audio.energy.d_rms by about 0.1 s. On held-out recordings the leader signal explained an extra 16.4% of the follower's variance beyond the follower's own recent past (p 0.006 against time-shifted and block-shuffled controls). Compact form: sparse lagged kernel with 6 numbers. Found in 100% of resampled training sets.
- Pattern 005: changes in video.face.mouth_speed tend to follow audio.energy.d_rms by about 0.1 s. On held-out recordings the leader signal explained an extra 21.7% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 1.77e-04). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
- Pattern 006: changes in audio.timing.silence tend to follow video.elbow_r.accel by about 0.2 s. On held-out recordings the leader signal explained an extra 10.3% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 0.006). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
- Pattern 009: changes in video.face.mouth_speed tend to follow audio.spectral.flux by about 0.1 s. On held-out recordings the leader signal explained an extra 5.8% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 0.016). Compact form: single-lag linear with 5 numbers. Found in 100% of resampled training sets.
- Pattern 010: changes in video.face.mouth_width tend to follow audio.timing.onset by about 1.5 s. On held-out recordings the leader signal explained an extra 10.9% of the follower's variance beyond the follower's own recent past (beat all 199 time-shifted and all 49 block-shuffled controls; extrapolated p about 0.004). Compact form: dense lagged kernel with 25 numbers. Found in 100% of resampled training sets.
Search cost: the adaptive search used 34% of the operations and 33% of the CPU time of uniform exhaustive search; it recovered 62% of the relationship families exhaustive search confirmed.
A simple staged filter (no learning) used 63% of exhaustive operations and 50% of its CPU time; it recovered 100% of the relationship families exhaustive search confirmed.
Compression: 9 of 51 raw signals take part in the generalising patterns. Their chosen models use 67 numbers in total, versus 128 for dense lag kernels and 13880 for boosted trees.
Evolutionary vs random vs greedy search (equal budgets, mean over targets and seeds): evolutionary: validation 0.548 bits/sample, held-out gain 0.190; greedy: validation 0.503 bits/sample, held-out gain 0.094; random: validation 0.432 bits/sample, held-out gain 0.211.
Correlation and prediction here do not establish causation, and patterns carry neutral identifiers only; interpretation is left to human researchers.
```

## Patterns (neutral identifiers)

| pattern | level | status | leader signal | follower signal | lag s | temporal scale s | test gain r2 | test p shift | test p block | test mismatch gain | stability | chosen model | parameters |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P001 | 1 | Generalizes to held-out data | video.head.speed | audio.timing.silence | 0.400 | 1.000 | 0.701 | 8.15e-06 | 7.72e-05 | n/a | 1.000 | M1 single-lag linear | 5 |
| P002 | 1 | Generalizes to held-out data | video.face.mouth_aperture | audio.timing.silence | 0.400 | 1.000 | 0.731 | 4.78e-06 | 8.86e-04 | n/a | 1.000 | M2 sparse lagged kernel | 16 |
| P003 | 1 | Did not generalize (validated on training data only) | audio.energy.d_rms | video.elbow_r.y | 0.200 | 1.000 | 0.438 | 0.005 | 1.000 | n/a | 1.000 | M4 small neural network | 193 |
| P004 | 1 | Generalizes to held-out data | audio.energy.d_rms | video.head.speed | 0.100 | 4.000 | 0.164 | 8.60e-05 | 0.006 | n/a | 1.000 | M2 sparse lagged kernel | 6 |
| P005 | 1 | Generalizes to held-out data | audio.energy.d_rms | video.face.mouth_speed | 0.100 | 1.000 | 0.217 | 1.77e-04 | 1.23e-04 | n/a | 1.000 | M1 single-lag linear | 5 |
| P006 | 1 | Generalizes to held-out data | video.elbow_r.accel | audio.timing.silence | 0.200 | 1.000 | 0.103 | 9.99e-04 | 0.006 | n/a | 1.000 | M1 single-lag linear | 5 |
| P007 | 1 | Did not generalize (validated on training data only) | audio.timing.periodicity | video.wrist_l.y | 0.900 | 1.000 | n/a | 1.000 | 1.000 | n/a | 0.600 | M4 small neural network | 241 |
| P008 | 1 | Did not generalize (validated on training data only) | audio.timing.silence | video.elbow_l.accel | 1.300 | 4.000 | -0.008 | 0.375 | 0.140 | n/a | 0.000 | M1 single-lag linear | 5 |
| P009 | 1 | Generalizes to held-out data | audio.spectral.flux | video.face.mouth_speed | 0.100 | 0.000 | 0.058 | 6.04e-06 | 0.016 | n/a | 1.000 | M1 single-lag linear | 5 |
| P010 | 1 | Generalizes to held-out data | audio.timing.onset | video.face.mouth_width | 1.500 | 1.000 | 0.109 | 4.93e-04 | 0.004 | n/a | 1.000 | M3 dense lagged kernel | 25 |
| P011 | 1 | Did not generalize (validated on training data only) | audio.timing.onset | video.head.vy | 0.700 | 1.000 | -0.043 | 0.110 | 0.040 | n/a | 1.000 | M1 single-lag linear | 5 |
| P012 | 1 | Did not generalize (validated on training data only) | audio.energy.d_rms | video.elbow_l.accel | 2.000 | 4.000 | -0.021 | 0.455 | 0.156 | n/a | 0.000 | M1 single-lag linear | 5 |
| P013 | 1 | Did not generalize (validated on training data only) | video.elbow_l.speed | audio.spectral.zcr | 0.300 | 1.000 | 0.056 | 0.020 | 0.100 | n/a | 0.000 | M1 single-lag linear | 5 |

## Mathematical representations

| pattern | equation | best model | variants | merged groups | note |
|---|---|---|---|---|---|
| P001 | y(t) = 0.14*y(t-0.5s) + 0.09*y(t-1.5s) + 0.00*y(t-2.5s) - 0.848*x(t-0.4s);  x = z[video.head.speed, smoothed 1 s], y = z[audio.timing.silence] | M1 | 41 | video.head -> audio.timing; video.head -> audio.energy; video.head -> audio.spectral |  |
| P002 | y(t) = 0.46*y(t-0.5s) + 0.00*y(t-1.5s) + 0.01*y(t-2.5s) - 0.270*x(t-0.4s) + 0.351*x(t-1.0s) + 0.429*x(t-1.1s) - 0.338*x(t-1.4s) (+8 smaller terms);  x = z[video.face.mouth_aperture, smoothed 1 s], y = z[audio.timing.silence] | M5 | 127 | video.face -> audio.timing; video.face -> audio.pitch; video.face -> audio.energy; video.face -> audio.spectral |  |
| P003 | z[video.elbow_r.y](t) = f(own history at t-0.5s.., z[audio.energy.d_rms, smoothed 1 s] at lags 0..1.2 s); f = M4 (193 parameters) | M4 | 2 | audio.energy -> video.elbow_r |  |
| P004 | y(t) = 0.79*y(t-0.5s) + 0.00*y(t-1.5s) + -0.00*y(t-2.5s) + 0.141*x(t-0.0s) + 0.013*x(t-0.1s) + 0.031*x(t-0.2s) + 0.025*x(t-0.3s);  x = z[audio.energy.d_rms, smoothed 4 s], y = z[video.head.speed] | M3 | 6 | audio.energy -> video.head |  |
| P005 | y(t) = 0.59*y(t-0.5s) + -0.06*y(t-1.5s) + 0.01*y(t-2.5s) + 0.404*x(t-0.1s);  x = z[audio.energy.d_rms, smoothed 1 s], y = z[video.face.mouth_speed] | M3 | 6 | audio.energy -> video.face |  |
| P006 | y(t) = 0.39*y(t-0.5s) + 0.02*y(t-1.5s) + -0.11*y(t-2.5s) - 0.772*x(t-0.2s);  x = z[video.elbow_r.accel, smoothed 1 s], y = z[audio.timing.silence] | M1 | 34 | video.elbow_r -> audio.timing; video.elbow_r -> audio.pitch; video.elbow_r -> audio.energy; video.elbow_r -> audio.spectral |  |
| P007 | z[video.wrist_l.y](t) = f(own history at t-0.5s.., z[audio.timing.periodicity, smoothed 1 s] at lags 0..1.8 s); f = M4 (241 parameters) | M4 | 1 | audio.timing -> video.wrist_l |  |
| P008 | y(t) = 0.85*y(t-0.5s) + -0.12*y(t-1.5s) + 0.03*y(t-2.5s) - 0.140*x(t-1.3s);  x = z[audio.timing.silence, smoothed 4 s], y = z[video.elbow_l.accel] | M1 | 1 | audio.timing -> video.elbow_l |  |
| P009 | y(t) = 0.14*y(t-0.5s) + -0.04*y(t-1.5s) + -0.03*y(t-2.5s) + 0.203*x(t-0.1s);  x = z[audio.spectral.flux], y = z[video.face.mouth_speed] | M2 | 1 | audio.spectral -> video.face |  |
| P010 | y(t) = 0.47*y(t-0.5s) + -0.00*y(t-1.5s) + 0.10*y(t-2.5s) - 0.078*x(t-1.5s) - 0.086*x(t-1.6s) - 0.089*x(t-1.7s) - 0.091*x(t-1.8s) (+17 smaller terms);  x = z[audio.timing.onset, smoothed 1 s], y = z[video.face.mouth_width] | M3 | 1 | audio.timing -> video.face |  |
| P011 | y(t) = 0.17*y(t-0.5s) + 0.12*y(t-1.5s) + -0.06*y(t-2.5s) + 0.389*x(t-0.7s);  x = z[audio.timing.onset, smoothed 1 s], y = z[video.head.vy] | M1 | 1 | audio.timing -> video.head |  |
| P012 | y(t) = 0.89*y(t-0.5s) + -0.08*y(t-1.5s) + 0.05*y(t-2.5s) + 0.117*x(t-2.0s);  x = z[audio.energy.d_rms, smoothed 4 s], y = z[video.elbow_l.accel] | M1 | 1 | audio.energy -> video.elbow_l |  |
| P013 | y(t) = 0.29*y(t-0.5s) + -0.05*y(t-1.5s) + -0.14*y(t-2.5s) - 0.335*x(t-0.3s);  x = z[video.elbow_l.speed, smoothed 1 s], y = z[audio.spectral.zcr] | M1 | 1 | video.elbow_l -> audio.spectral |  |

## Model ladder (minimum-intelligence selection)

| pattern | model | description | parameters | flops per prediction | fit cpu s | validation gain r2 | validation bits per sample | chosen |
|---|---|---|---|---|---|---|---|---|
| P001 | M1 | single-lag linear | 5 | 10 | 1.37e-04 | 0.682 | 0.975 | yes |
| P001 | M2 | sparse lagged kernel | 16 | 32 | 0.034 | 0.662 | 0.689 | no |
| P001 | M3 | dense lagged kernel | 19 | 38 | 0.003 | 0.681 | 0.685 | no |
| P001 | M4 | small neural network | 209 | 418 | 0.336 | 0.670 | -3.274 | no |
| P001 | M5 | gradient-boosted trees | 2008 | 400 | 0.042 | 0.610 | -40.589 | no |
| P002 | M1 | single-lag linear | 5 | 10 | 9.96e-05 | 0.578 | 0.705 | no |
| P002 | M2 | sparse lagged kernel | 16 | 32 | 0.017 | 0.730 | 0.919 | yes |
| P002 | M3 | dense lagged kernel | 19 | 38 | 0.002 | 0.722 | 0.827 | no |
| P002 | M4 | small neural network | 209 | 418 | 0.174 | 0.794 | -2.751 | no |
| P002 | M5 | gradient-boosted trees | 2020 | 400 | 0.045 | 0.825 | -39.929 | no |
| P003 | M1 | single-lag linear | 5 | 10 | 1.24e-04 | 1.292 | 0.471 | no |
| P003 | M2 | sparse lagged kernel | 16 | 32 | 0.011 | 1.509 | 0.074 | no |
| P003 | M3 | dense lagged kernel | 17 | 34 | 0.001 | 1.544 | 0.050 | no |
| P003 | M4 | small neural network | 193 | 386 | 0.138 | 2.017 | -8.086 | yes |
| P003 | M5 | gradient-boosted trees | 988 | 400 | 0.018 | 1.312 | -47.652 | no |
| P004 | M1 | single-lag linear | 5 | 10 | 8.31e-05 | 0.127 | 0.251 | no |
| P004 | M2 | sparse lagged kernel | 6 | 12 | 0.010 | 0.173 | 0.361 | yes |
| P004 | M3 | dense lagged kernel | 16 | 32 | 0.002 | 0.177 | 0.166 | no |
| P004 | M4 | small neural network | 177 | 354 | 0.213 | 0.068 | -3.440 | no |
| P004 | M5 | gradient-boosted trees | 1968 | 400 | 0.037 | 0.094 | -40.371 | no |
| P005 | M1 | single-lag linear | 5 | 10 | 7.85e-05 | 0.198 | 0.213 | yes |
| P005 | M2 | sparse lagged kernel | 7 | 14 | 0.027 | 0.240 | 0.233 | no |
| P005 | M3 | dense lagged kernel | 16 | 32 | 0.003 | 0.249 | 0.061 | no |
| P005 | M4 | small neural network | 177 | 354 | 0.137 | 0.097 | -3.468 | no |
| P005 | M5 | gradient-boosted trees | 1928 | 400 | 0.040 | 0.162 | -39.551 | no |
| P006 | M1 | single-lag linear | 5 | 10 | 1.23e-04 | 0.246 | 0.207 | yes |
| P006 | M2 | sparse lagged kernel | 5 | 10 | 0.009 | 0.200 | 0.159 | no |
| P006 | M3 | dense lagged kernel | 17 | 34 | 0.002 | 0.195 | -0.095 | no |
| P006 | M4 | small neural network | 193 | 386 | 0.273 | -0.085 | -3.968 | no |
| P006 | M5 | gradient-boosted trees | 1720 | 400 | 0.043 | 0.217 | -35.244 | no |
| P007 | M1 | single-lag linear | 5 | 10 | 8.98e-05 | 0.278 | 0.109 | no |
| P007 | M2 | sparse lagged kernel | 1 | 2 | 0.033 | -0.577 | -0.066 | no |
| P007 | M3 | dense lagged kernel | 24 | 48 | 0.002 | -0.056 | -1.369 | no |
| P007 | M4 | small neural network | 241 | 482 | 0.143 | 0.629 | -15.375 | yes |
| P007 | M5 | gradient-boosted trees | 728 | 400 | 0.018 | -0.501 | -48.684 | no |
| P008 | M1 | single-lag linear | 5 | 10 | 8.27e-05 | 0.028 | 0.050 | yes |
| P008 | M2 | sparse lagged kernel | 4 | 8 | 0.012 | 0.003 | 0.008 | no |
| P008 | M3 | dense lagged kernel | 25 | 50 | 0.002 | 0.024 | -0.374 | no |
| P008 | M4 | small neural network | 257 | 514 | 0.231 | -0.414 | -5.852 | no |
| P008 | M5 | gradient-boosted trees | 2124 | 400 | 0.033 | -0.185 | -44.131 | no |
| P009 | M1 | single-lag linear | 5 | 10 | 1.20e-04 | 0.097 | 0.048 | yes |
| P009 | M2 | sparse lagged kernel | 9 | 18 | 0.012 | 0.111 | -0.024 | no |
| P009 | M3 | dense lagged kernel | 16 | 32 | 0.002 | 0.109 | -0.171 | no |
| P009 | M4 | small neural network | 177 | 354 | 0.255 | 0.060 | -3.531 | no |
| P009 | M5 | gradient-boosted trees | 2000 | 400 | 0.032 | -0.049 | -41.255 | no |
| P010 | M1 | single-lag linear | 5 | 10 | 2.17e-04 | 0.062 | 0.046 | no |
| P010 | M2 | sparse lagged kernel | 14 | 28 | 0.009 | 0.058 | -0.144 | no |
| P010 | M3 | dense lagged kernel | 25 | 50 | 0.002 | 0.104 | -0.318 | yes |
| P010 | M4 | small neural network | 257 | 514 | 0.067 | 0.100 | -5.113 | no |
| P010 | M5 | gradient-boosted trees | 2236 | 400 | 0.036 | -0.187 | -46.268 | no |
| P011 | M1 | single-lag linear | 5 | 10 | 7.40e-05 | 0.071 | 0.029 | yes |
| P011 | M2 | sparse lagged kernel | 6 | 12 | 0.009 | 0.017 | -0.030 | no |
| P011 | M3 | dense lagged kernel | 22 | 44 | 0.002 | -0.019 | -0.385 | no |
| P011 | M4 | small neural network | 225 | 450 | 0.040 | -0.131 | -4.648 | no |
| P011 | M5 | gradient-boosted trees | 1912 | 400 | 0.036 | -0.044 | -39.434 | no |
| P012 | M1 | single-lag linear | 5 | 10 | 1.03e-04 | 0.019 | 0.028 | yes |
| P012 | M2 | sparse lagged kernel | 15 | 30 | 0.013 | 0.011 | -0.199 | no |
| P012 | M3 | dense lagged kernel | 25 | 50 | 0.002 | 9.57e-04 | -0.430 | no |
| P012 | M4 | small neural network | 257 | 514 | 0.291 | -0.159 | -5.520 | no |
| P012 | M5 | gradient-boosted trees | 2028 | 400 | 0.049 | -0.104 | -41.915 | no |
| P013 | M1 | single-lag linear | 5 | 10 | 9.43e-05 | 0.027 | 1.91e-04 | yes |
| P013 | M2 | sparse lagged kernel | 12 | 24 | 0.013 | -0.089 | -0.230 | no |
| P013 | M3 | dense lagged kernel | 18 | 36 | 0.002 | -0.183 | -0.418 | no |
| P013 | M4 | small neural network | 193 | 386 | 0.130 | -0.589 | -4.255 | no |
| P013 | M5 | gradient-boosted trees | 2080 | 400 | 0.048 | -0.203 | -43.016 | no |

## Other cross-modal measures at the discovered lag

| pattern | plv | plv null | mi nonlinear excess nats | dtw ratio | motif ratio |
|---|---|---|---|---|---|
| P001 | 0.711 | 0.143 | 0.137 | 1.659 | 0.611 |
| P002 | 0.796 | 0.132 | -0.036 | 1.617 | 0.541 |
| P003 | 0.732 | 0.259 | -0.009 | n/a | n/a |
| P004 | 0.608 | 0.153 | 0.071 | 0.758 | 0.840 |
| P005 | 0.453 | 0.122 | 0.085 | 0.734 | 0.641 |
| P006 | 0.535 | 0.226 | 0.053 | n/a | n/a |
| P007 | 0.575 | 0.253 | 0.357 | n/a | n/a |
| P008 | 0.242 | 0.174 | 0.355 | 1.502 | 0.944 |
| P009 | 0.597 | 0.125 | 0.004 | 0.867 | 0.864 |
| P010 | 0.214 | 0.147 | 0.043 | 1.453 | 0.957 |
| P011 | 0.129 | 0.093 | -0.002 | 0.908 | 0.984 |
| P012 | 0.214 | 0.123 | 0.040 | 0.983 | 0.977 |
| P013 | 0.223 | 0.115 | 0.086 | 1.210 | 1.010 |

## Search strategy comparison

| strategy | candidates | screened on subsample | full null tests | predictive checks | confirmed families | ops | cpu s | ops vs exhaustive | recall of exhaustive families |
|---|---|---|---|---|---|---|---|---|---|
| exhaustive | 1368 | 0 | 1368 | 1368 | 34 | 1.90e+08 | 5.905 | 1.000 | 1.000 |
| staged | 1368 | 0 | 1368 | 528 | 34 | 1.21e+08 | 2.932 | 0.634 | 1.000 |
| adaptive | 1368 | 1079 | 460 | 335 | 21 | 6.45e+07 | 1.942 | 0.339 | 0.618 |

## What the adaptive search learned to attend to

| arm | pulls | successes | posterior mean | retired | untested |
|---|---|---|---|---|---|
| video.face -> audio.spectral | 108 | 84 | 0.773 | no | 0 |
| video.face -> audio.energy | 54 | 40 | 0.732 | no | 0 |
| video.head -> audio.timing | 72 | 35 | 0.486 | no | 0 |
| video.head -> audio.energy | 48 | 23 | 0.480 | no | 0 |
| video.head -> audio.spectral | 96 | 44 | 0.459 | no | 0 |
| video.face -> audio.timing | 81 | 36 | 0.446 | no | 0 |
| video.face -> audio.pitch | 81 | 35 | 0.434 | no | 0 |
| video.elbow_r -> audio.spectral | 84 | 34 | 0.407 | no | 0 |
| video.elbow_l -> audio.energy | 42 | 15 | 0.364 | no | 0 |
| video.elbow_r -> audio.energy | 42 | 15 | 0.364 | no | 0 |
| video.elbow_r -> audio.timing | 63 | 22 | 0.354 | no | 0 |
| video.elbow_l -> audio.spectral | 84 | 26 | 0.314 | no | 0 |
| video.wrist_l -> audio.timing | 63 | 19 | 0.308 | no | 0 |
| video.elbow_l -> audio.timing | 63 | 17 | 0.277 | no | 0 |
| video.elbow_r -> audio.pitch | 63 | 12 | 0.200 | no | 0 |
| video.wrist_l -> audio.energy | 9 | 1 | 0.182 | yes | 33 |
| video.wrist_l -> audio.pitch | 9 | 1 | 0.182 | yes | 54 |
| video.elbow_l -> audio.pitch | 9 | 1 | 0.182 | yes | 54 |
| video.head -> audio.pitch | 4 | 0 | 0.167 | yes | 68 |
| video.wrist_l -> audio.spectral | 4 | 0 | 0.167 | yes | 80 |

## Shared latent movement-sound component (CCA)

| lag s | validation r | test r | p shift | null mean abs r | top movement weights | top sound weights |
|---|---|---|---|---|---|---|
| 0.500 | 0.598 | 0.592 | 0.010 | 0.116 | video.face.mouth_aperture +0.67; video.head.x +0.34; video.face.yaw_proxy +0.27; video.wrist_l.x -0.22; video.elbow_r.x -0.21 | audio.energy.rms_db +0.57; audio.spectral.flatness +0.57; audio.pitch.voiced -0.45; audio.timing.silence -0.36; audio.spectral.centroid_log -0.12 |

## Did pattern-derived (level-2) signals help?

_none_

## Evolutionary versus random versus greedy search

| target | method | seed | evals | best val bits | evals to 90pct | terms | genome | test gain |
|---|---|---|---|---|---|---|---|---|
| audio.timing.silence | evolutionary | 0 | 300 | 0.764 | 300 | 4 | video.face.mouth_aperture@0s lag 0.6s; video.wrist_l.z_speed_est@4s lag 1.9s; video.elbow_l.y@4s lag 1.4s; video.face.eye_aperture_l@0s lag 0.5s | 0.507 |
| audio.timing.silence | random | 0 | 300 | 0.567 | 72 | 4 | video.elbow_l.z_est@1s lag 1.2s; video.face.mouth_aperture@0s lag 0.6s; video.elbow_r.z_speed_est@0s lag 0.5s; video.face.mouth_speed@0s lag 2.0s | 0.440 |
| audio.timing.silence | greedy | 0 | 300 | 0.726 | 264 | 4 | video.face.mouth_speed@4s lag 2.0s; video.head.speed@0s lag 0.2s; video.face.mouth_aperture@0s lag 0.6s; video.face.eye_aperture_l@0s lag 0.3s | 0.546 |
| audio.timing.silence | evolutionary | 1 | 305 | 0.755 | 137 | 2 | video.face.mouth_aperture@0s lag 0.6s; video.head.speed@1s lag 0.5s | 0.574 |
| audio.timing.silence | random | 1 | 300 | 0.573 | 3 | 4 | video.head.periodicity@4s lag 1.1s; video.face.eye_aperture_l@0s lag 0.9s; video.face.mouth_aperture@0s lag 0.6s; video.head.speed@1s lag 2.0s | 0.448 |
| audio.timing.silence | greedy | 1 | 295 | 0.758 | 76 | 4 | video.face.mouth_aperture@0s lag 0.6s; video.head.speed@0s lag 0.7s; video.head.vy@0s lag 0.8s; video.elbow_r.z_est@1s lag 0.0s | 0.498 |
| audio.timing.silence | evolutionary | 2 | 309 | 0.677 | 217 | 4 | video.head.speed@1s lag 0.3s; video.face.brow_eye_l@0s lag 0.2s; video.face.mouth_aperture@0s lag 0.7s; video.elbow_r.z_speed_est@1s lag 1.7s | 0.567 |
| audio.timing.silence | random | 2 | 300 | 0.455 | 269 | 4 | video.face.pitch_proxy@0s lag 0.8s; video.wrist_l.y@4s lag 1.0s; video.face.mouth_aperture@1s lag 1.1s; video.face.mouth_aperture@1s lag 0.8s | 0.466 |
| audio.timing.silence | greedy | 2 | 300 | 0.610 | 275 | 4 | video.head.speed@1s lag 0.2s; video.elbow_r.vy@1s lag 0.2s; video.face.mouth_speed@0s lag 0.7s; video.face.eye_aperture_l@1s lag 0.7s | 0.632 |
| video.elbow_r.y | evolutionary | 0 | 300 | 0.741 | 118 | 4 | audio.energy.rms_db@1s lag 0.0s; audio.spectral.flatness@0s lag 0.0s; audio.pitch.voiced@4s lag 2.0s; audio.timing.onset@1s lag 0.1s | -0.258 |
| video.elbow_r.y | random | 0 | 300 | 0.546 | 294 | 4 | audio.pitch.f0_st@4s lag 1.0s; audio.timing.silence@0s lag 0.5s; audio.timing.silence@4s lag 0.0s; audio.pitch.voiced@1s lag 0.7s | -0.264 |
| video.elbow_r.y | greedy | 0 | 217 | 0.658 | 92 | 2 | audio.pitch.voiced@4s lag 2.0s; audio.timing.onset@1s lag 0.0s | -1.860 |
| video.elbow_r.y | evolutionary | 1 | 310 | 0.734 | 124 | 2 | audio.spectral.flatness@1s lag 0.8s; audio.timing.silence@4s lag 0.0s | -0.324 |
| video.elbow_r.y | random | 1 | 300 | 0.566 | 189 | 4 | audio.energy.rms_db@1s lag 0.8s; audio.energy.rms_db@4s lag 1.7s; audio.spectral.flatness@4s lag 1.0s; audio.pitch.voiced@4s lag 0.0s | 0.129 |
| video.elbow_r.y | greedy | 1 | 289 | 0.608 | 166 | 3 | audio.spectral.flatness@4s lag 1.9s; audio.spectral.centroid_log@4s lag 0.8s; audio.spectral.flatness@0s lag 1.2s | 0.346 |
| video.elbow_r.y | evolutionary | 2 | 307 | 0.781 | 223 | 2 | audio.energy.rms_db@1s lag 0.0s; audio.spectral.centroid_log@4s lag 1.9s | -0.170 |
| video.elbow_r.y | random | 2 | 300 | 0.767 | 21 | 2 | audio.timing.silence@1s lag 0.0s; audio.timing.silence@4s lag 1.9s | -0.208 |
| video.elbow_r.y | greedy | 2 | 281 | 0.663 | 230 | 4 | audio.timing.silence@4s lag 1.9s; audio.timing.onset@1s lag 0.1s; audio.spectral.centroid_log@4s lag 0.5s; audio.spectral.zcr@1s lag 0.0s | -0.182 |
| video.head.speed | evolutionary | 0 | 313 | 0.188 | 120 | 3 | audio.timing.silence@1s lag 1.5s; audio.timing.silence@4s lag 1.0s; audio.spectral.zcr@4s lag 1.9s | 0.328 |
| video.head.speed | random | 0 | 300 | 0.109 | 69 | 3 | audio.timing.silence@4s lag 1.0s; audio.timing.onset@4s lag 0.0s; audio.spectral.zcr@4s lag 1.7s | 0.277 |
| video.head.speed | greedy | 0 | 289 | 0.206 | 197 | 3 | audio.spectral.centroid_log@1s lag 0.0s; audio.timing.silence@0s lag 0.3s; audio.energy.d_rms@4s lag 1.3s | 0.330 |
| video.head.speed | evolutionary | 1 | 306 | 0.113 | 199 | 3 | audio.timing.silence@4s lag 0.8s; audio.spectral.flux@1s lag 0.0s; audio.spectral.centroid_log@1s lag 1.9s | 0.209 |
| video.head.speed | random | 1 | 300 | 0.148 | 106 | 4 | audio.spectral.zcr@4s lag 2.0s; audio.energy.rms_db@4s lag 1.2s; audio.spectral.zcr@1s lag 1.5s; audio.spectral.zcr@4s lag 0.7s | 0.298 |
| video.head.speed | greedy | 1 | 289 | 0.159 | 146 | 4 | audio.pitch.voiced@4s lag 0.9s; audio.timing.silence@4s lag 1.6s; audio.spectral.centroid_log@4s lag 2.0s; audio.energy.rms_db@1s lag 1.6s | 0.292 |
| video.head.speed | evolutionary | 2 | 300 | 0.183 | 89 | 2 | audio.timing.silence@4s lag 1.0s; audio.spectral.flatness@4s lag 2.0s | 0.280 |
| video.head.speed | random | 2 | 300 | 0.155 | 210 | 3 | audio.pitch.voiced@1s lag 2.0s; audio.pitch.voiced@4s lag 1.8s; audio.timing.silence@4s lag 1.0s | 0.313 |
| video.head.speed | greedy | 2 | 212 | 0.141 | 96 | 2 | audio.energy.d_rms@4s lag 1.6s; audio.energy.d_rms@4s lag 1.3s | 0.241 |

## Notes, assumptions and limitations

- Video feature method: mediapipe for photo_motion
- Fewer than 3 videos: each recording is split in time; the first 65% trains, the rest (after a 5 s gap) is held out for testing. Held-out data then comes from the same person and session, so generalisation to new people or recordings is NOT tested.
- Associations and predictive relationships are not causal claims and do not reveal universal principles of human behaviour.
- Monocular pose depth (features ending in _est) is a model estimate, not a physical measurement.
- Patterns are named with neutral identifiers only; no psychological or intentional meaning is assigned.
- Significance relies on circular-shift and block-shuffle surrogates; p-values smaller than the surrogate count allows are tail extrapolations (Gumbel or Gaussian fits) and are approximate.
- Validation data overlaps the data used to choose lags; only the held-out test recordings give an unbiased estimate.
- With few recordings, held-out testing cannot show that a pattern generalises to new people.
