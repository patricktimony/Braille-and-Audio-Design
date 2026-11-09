# EMPC experiment report

## Plain-language summary

```
IMPORTANT: this run used SYNTHETIC data with NO planted relationships (null world). It tests the software; it is not evidence about people.
The system examined 2589 possible relationships between 42 movement, 12 sound and 7 physiological signals.
0 relationship groups passed the training-data tests (shuffled-time controls, false-discovery-rate correction and a validation stretch). 0 of them also predicted held-out data better than shuffled controls.
No reliable relationships were found on held-out data. This is reported as a negative result; nothing has been invented to fill the gap.
Search cost: the adaptive search used 3% of the operations and 1% of the CPU time of uniform exhaustive search; it exhaustive search confirmed nothing, so recall is undefined.
A simple staged filter (no learning) used 26% of exhaustive operations and 8% of its CPU time; it exhaustive search confirmed nothing, so recall is undefined.
Null world check: 0 patterns generalised although no relationships were planted (each one is a false positive).
Correlation and prediction here do not establish causation, and patterns carry neutral identifiers only; interpretation is left to human researchers.
```

## Patterns (neutral identifiers)

_none_

## Mathematical representations

_none_

## Model ladder (minimum-intelligence selection)

_none_

## Other cross-modal measures at the discovered lag

_none_

## Search strategy comparison

| strategy | candidates | screened on subsample | full null tests | predictive checks | confirmed families | ops | cpu s | ops vs exhaustive | recall of exhaustive families |
|---|---|---|---|---|---|---|---|---|---|
| exhaustive | 2589 | 0 | 2589 | 2589 | 0 | 8.10e+09 | 176.139 | 1.000 | n/a |
| staged | 2589 | 0 | 2589 | 10 | 0 | 2.07e+09 | 14.955 | 0.255 | n/a |
| adaptive | 2589 | 629 | 107 | 1 | 0 | 2.35e+08 | 2.251 | 0.029 | n/a |

## What the adaptive search learned to attend to

| arm | pulls | successes | posterior mean | retired | untested |
|---|---|---|---|---|---|
| audio.timing -> physio.resp | 18 | 12 | 0.650 | no | 0 |
| audio.energy -> physio.resp | 12 | 6 | 0.500 | no | 0 |
| video.elbow_l -> physio.resp | 42 | 18 | 0.432 | no | 0 |
| video.hands -> physio.resp | 12 | 5 | 0.429 | no | 0 |
| audio.spectral -> physio.resp | 24 | 8 | 0.346 | no | 0 |
| video.wrist_l -> physio.resp | 42 | 14 | 0.341 | no | 0 |
| video.body -> physio.resp | 18 | 5 | 0.300 | no | 0 |
| audio.spectral -> physio.pupil | 12 | 3 | 0.286 | no | 0 |
| audio.spectral -> physio.hr | 12 | 3 | 0.286 | no | 0 |
| audio.timing -> physio.hr | 9 | 2 | 0.273 | no | 0 |
| video.elbow_l -> physio.eda | 42 | 10 | 0.250 | no | 0 |
| video.elbow_r -> physio.resp | 42 | 9 | 0.227 | no | 0 |
| video.wrist_r -> physio.pupil | 19 | 3 | 0.190 | yes | 2 |
| video.elbow_r -> physio.eda | 14 | 2 | 0.188 | yes | 28 |
| video.elbow_r -> physio.pupil | 14 | 2 | 0.188 | yes | 7 |
| audio.pitch -> physio.resp | 14 | 2 | 0.188 | yes | 4 |
| video.elbow_l -> audio.pitch | 9 | 1 | 0.182 | yes | 54 |
| video.wrist_r -> physio.resp | 9 | 1 | 0.182 | yes | 33 |
| audio.timing -> physio.eda | 9 | 1 | 0.182 | yes | 9 |
| video.head -> audio.energy | 4 | 0 | 0.167 | yes | 44 |
| video.head -> audio.timing | 4 | 0 | 0.167 | yes | 68 |
| video.head -> audio.spectral | 4 | 0 | 0.167 | yes | 92 |
| video.head -> audio.pitch | 4 | 0 | 0.167 | yes | 68 |
| video.wrist_l -> audio.energy | 4 | 0 | 0.167 | yes | 38 |
| video.wrist_l -> audio.timing | 4 | 0 | 0.167 | yes | 59 |
| video.wrist_l -> audio.spectral | 4 | 0 | 0.167 | yes | 80 |
| video.wrist_l -> audio.pitch | 4 | 0 | 0.167 | yes | 59 |
| video.wrist_r -> audio.energy | 4 | 0 | 0.167 | yes | 38 |
| video.wrist_r -> audio.timing | 4 | 0 | 0.167 | yes | 59 |
| video.wrist_r -> audio.spectral | 4 | 0 | 0.167 | yes | 80 |
| video.wrist_r -> audio.pitch | 4 | 0 | 0.167 | yes | 59 |
| video.elbow_l -> audio.energy | 4 | 0 | 0.167 | yes | 38 |
| video.elbow_l -> audio.timing | 4 | 0 | 0.167 | yes | 59 |
| video.elbow_l -> audio.spectral | 4 | 0 | 0.167 | yes | 80 |
| video.elbow_r -> audio.energy | 4 | 0 | 0.167 | yes | 38 |
| video.elbow_r -> audio.timing | 4 | 0 | 0.167 | yes | 59 |
| video.elbow_r -> audio.spectral | 4 | 0 | 0.167 | yes | 80 |
| video.elbow_r -> audio.pitch | 4 | 0 | 0.167 | yes | 59 |
| video.body -> audio.energy | 4 | 0 | 0.167 | yes | 14 |
| video.body -> audio.timing | 4 | 0 | 0.167 | yes | 23 |

## Shared latent movement-sound component (CCA)

| lag s | validation r | test r | p shift | null mean abs r | top movement weights | top sound weights |
|---|---|---|---|---|---|---|
| -1.000 | 0.052 | -0.041 | 0.310 | 0.031 | video.wrist_r.x +0.64; video.hands.distance +0.50; video.wrist_l.x -0.28; video.head.periodicity +0.20; video.wrist_r.y -0.18 | audio.spectral.flatness -0.72; audio.spectral.centroid_log +0.66; audio.timing.silence +0.16; audio.energy.rms_db +0.09; audio.spectral.zcr -0.08 |

## Did pattern-derived (level-2) signals help?

_none_

## Evolutionary versus random versus greedy search

_none_

## Synthetic ground-truth check

_none_

## Notes, assumptions and limitations

- SYNTHETIC DATA: generated by empc.synthetic with planted relationships. Results test the software only and are not evidence about human behaviour.
- World: NULL (no cross-modal relationships); 10 videos x 3 viewers x 120 s; seed 7.
- Held-out test videos: synvideo07, synvideo08, synvideo09; held-out viewers: synviewer2
- Associations and predictive relationships are not causal claims and do not reveal universal principles of human behaviour.
- Monocular pose depth (features ending in _est) is a model estimate, not a physical measurement.
- Patterns are named with neutral identifiers only; no psychological or intentional meaning is assigned.
- Significance relies on circular-shift and block-shuffle surrogates; p-values smaller than the surrogate count allows are tail extrapolations (Gumbel or Gaussian fits) and are approximate.
- Validation data overlaps the data used to choose lags; only the held-out test recordings give an unbiased estimate.
- With few recordings, held-out testing cannot show that a pattern generalises to new people.
