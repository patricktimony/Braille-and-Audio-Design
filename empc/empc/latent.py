"""Shared latent representation between movement and sound (lagged CCA).

Fits one pair of canonical directions (a weighted sum of movement features
and a weighted sum of sound features that co-vary most) at several relative
lags, picks the lag on validation data, then tests the learned projection on
held-out recordings against circular-shift nulls.  Linear and low-capacity by
design."""
from __future__ import annotations

import warnings

import numpy as np

from .discovery import lagged


def _matrix(store, feats, lag):
    cols = [[np.nan_to_num(lagged(z, lag), nan=0.0) if lag else np.nan_to_num(z, nan=0.0)
             for z in store.z(f)] for f in feats]
    return [np.column_stack([c[i] for c in cols]) for i in range(len(store.segments))]


def lagged_cca(train, test, vfeats, afeats, rate, rng, lags_s=(-1.0, -0.5, 0.0, 0.25, 0.5, 1.0),
               val_split=0.65, n_null=99):
    from sklearn.cross_decomposition import CCA

    if not vfeats or not afeats or not train.segments:
        return None
    best = None
    A_all = _matrix(train, afeats, 0)
    for ls in lags_s:
        lag = int(round(ls * rate))
        V_all = _matrix(train, vfeats, lag)  # video at t-lag vs audio at t
        cut = [int(val_split * v.shape[0]) for v in V_all]
        lo = int(abs(lag))
        Vf = np.vstack([v[lo:c] for v, c in zip(V_all, cut)])
        Af = np.vstack([a[lo:c] for a, c in zip(A_all, cut)])
        Vv = np.vstack([v[c:] for v, c in zip(V_all, cut)])
        Av = np.vstack([a[c:] for a, c in zip(A_all, cut)])
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            cca = CCA(n_components=1, max_iter=1000).fit(Vf, Af)
        u, v = cca.transform(Vv, Av)
        r = float(np.corrcoef(u[:, 0], v[:, 0])[0, 1])
        if best is None or r > best["val_r"]:
            best = {"lag_s": lag / rate, "lag": lag, "val_r": r, "cca": cca}
    cca, lag = best["cca"], best["lag"]
    Vt = _matrix(test, vfeats, lag)
    At = _matrix(test, afeats, 0)
    if not Vt:
        return None
    lo = int(abs(lag))
    u = [cca.transform(v[lo:], a[lo:])[0][:, 0] for v, a in zip(Vt, At)]
    w = [cca.transform(v[lo:], a[lo:])[1][:, 0] for v, a in zip(Vt, At)]
    r_test = float(np.corrcoef(np.concatenate(u), np.concatenate(w))[0, 1])
    nul = []
    for _ in range(n_null):
        us = [np.roll(x, int(rng.integers(min(100, x.size // 4), max(101, x.size - 100)))) for x in u]
        nul.append(np.corrcoef(np.concatenate(us), np.concatenate(w))[0, 1])
    nul = np.array(nul)
    xw = cca.x_weights_[:, 0]
    yw = cca.y_weights_[:, 0]
    top = lambda names, wts: [(names[i], float(wts[i])) for i in np.argsort(-np.abs(wts))[:5]]
    return {"lag_s": best["lag_s"], "val_r": best["val_r"], "test_r": r_test,
            "p_shift": float((1 + (np.abs(nul) >= abs(r_test)).sum()) / (1 + n_null)),
            "null_mean_abs": float(np.abs(nul).mean()),
            "video_weights": top(vfeats, xw), "audio_weights": top(afeats, yw),
            "params": len(vfeats) + len(afeats), "n_video": len(vfeats), "n_audio": len(afeats)}
