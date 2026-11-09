"""Held-out testing, null controls and descriptive diagnostics."""
from __future__ import annotations

import numpy as np
from scipy import signal as sps
from scipy import stats as spst

from .compression import LaggedModel
from .discovery import bits_saved, circ_shift_within, design, lagged
from .store import FeatureStore


def _sse(y, p):
    return float(np.sum((y - p) ** 2))


def null_p(obs: float, null: np.ndarray) -> float:
    """Empirical one-sided p; when fewer than 10 surrogates reach the observed
    value, a Gaussian tail fitted to the null is used instead so that p-values
    can be small enough to survive correction across many patterns."""
    null = np.asarray(null, float)
    exceed = int((null >= obs).sum())
    p_emp = (1 + exceed) / (1 + null.size)
    if exceed >= 10 or null.std() < 1e-12:
        return float(p_emp)
    p_norm = float(spst.norm.sf((obs - null.mean()) / null.std()))
    return float(max(min(p_emp, p_norm), 1e-300))


def test_model(m: LaggedModel, store: FeatureStore, rng, n_null: int = 199, min_shift_s: float = 10.0,
               block_s: float = 5.0) -> dict:
    """Evaluate a trained model on held-out segments (no refitting).

    Controls (the source signal is altered, the target is untouched):
      shift     source circularly shifted within each segment
      block     source cut into 5 s blocks which are shuffled
      mismatch  source taken from a *different* held-out recording
    """
    S, X, y, seg = design(store, m.response, m.preds(), m.slags, m.scale, "all", 1.0)
    out = {"n_test_rows": int(len(y)), "n_test_units": int(len(np.unique(seg)))}
    if len(y) < 30:
        return {**out, "test_gain": np.nan, "p_shift": 1.0, "p_block": 1.0}
    sst = float(np.sum((y - y.mean()) ** 2)) or 1.0
    base = m.self_coef[0] + S @ m.self_coef[1:]
    sse_self = _sse(y, base)
    sse = _sse(y, m.predict(S, X))
    gain = (sse_self - sse) / sst
    out.update({"test_gain": float(gain), "test_r2_self": 1 - sse_self / sst, "test_r2_model": 1 - sse / sst,
                "test_bits": bits_saved(sse_self, sse, len(y), m.params - 1 - len(m.slags), 10 ** 4)})
    ms = int(min_shift_s * store.rate)
    nul = np.array([(sse_self - _sse(y, m.predict(S, circ_shift_within(X, seg, rng, ms)))) / sst
                    for _ in range(n_null)])
    out["p_shift"] = null_p(gain, nul)
    out["shift_exceed"] = int((nul >= gain).sum())
    out["n_null"] = int(nul.size)
    out["null_shift_mean"] = float(nul.mean())
    b = int(block_s * store.rate)
    nb = []
    for _ in range(max(20, n_null // 4)):
        Xb = X.copy()
        for s in np.unique(seg):
            idx = np.where(seg == s)[0]
            blocks = [idx[i:i + b] for i in range(0, idx.size, b)]
            order = rng.permutation(len(blocks))
            Xb[idx] = X[np.concatenate([blocks[o] for o in order])][:idx.size] if blocks else X[idx]
        nb.append((sse_self - _sse(y, m.predict(S, Xb))) / sst)
    nb = np.array(nb)
    out["p_block"] = null_p(gain, nb)
    out["block_exceed"] = int((nb >= gain).sum())
    out["n_block_null"] = int(nb.size)
    segs = np.unique(seg)
    if segs.size >= 2:
        gains = []
        for i in segs:
            for j in segs:
                if i == j:
                    continue
                if store.segments[i].video and store.segments[i].video == store.segments[j].video:
                    continue  # same stimulus: not a true mismatch
                ri, rj = np.where(seg == i)[0], np.where(seg == j)[0]
                k = min(ri.size, rj.size)
                if k < 30:
                    continue
                yi, Si, Xj = y[ri[:k]], S[ri[:k]], X[rj[:k]]
                bi = m.self_coef[0] + Si @ m.self_coef[1:]
                st = float(np.sum((yi - yi.mean()) ** 2)) or 1.0
                gains.append((_sse(yi, bi) - _sse(yi, m.predict(Si, Xj))) / st)
        out["mismatch_gain_mean"] = float(np.mean(gains)) if gains else np.nan
        out["mismatch_pairs"] = len(gains)
    else:
        out["mismatch_gain_mean"] = np.nan
        out["mismatch_pairs"] = 0
    return out


def _pairs(store: FeatureStore, pred: str, resp: str, scale: float, tau: int):
    xs = [lagged(x, tau) for x in store.z(pred, scale)]
    ys = store.z(resp, scale)
    return xs, ys


def diagnostics(store: FeatureStore, pred: str, resp: str, scale: float, tau: int, rng,
                n_null: int = 20) -> dict:
    """Descriptive cross-modal measures at the discovered lag, each with a
    circular-shift null: phase locking (0.1-1 Hz), mutual information beyond
    the linear (Gaussian) part, DTW alignment cost, and recurrence of joint
    cross-modal motifs.  Ratios < 1 (DTW, motif) or > 1 (PLV, MI) relative to
    the null indicate structure."""
    from sklearn.feature_selection import mutual_info_regression

    rate = store.rate
    xs, ys = _pairs(store, pred, resp, scale, tau)
    ms = int(10 * rate)

    def shifted(xs_):
        out = []
        for x in xs_:
            n = x.size
            k = min(ms, n // 4)
            out.append(np.roll(x, int(rng.integers(k, max(k + 1, n - k)))))
        return out

    res = {}
    # phase locking
    try:
        b, a = sps.butter(2, [0.1 / (rate / 2), 1.0 / (rate / 2)], btype="band")

        def plv(xs_):
            d = []
            for x, y in zip(xs_, ys):
                ok = np.isfinite(x) & np.isfinite(y)
                if ok.sum() < 60:
                    continue
                px = np.angle(sps.hilbert(sps.filtfilt(b, a, np.where(ok, x, 0))))
                py = np.angle(sps.hilbert(sps.filtfilt(b, a, np.where(ok, y, 0))))
                d.append(np.exp(1j * (px - py))[ok])
            return float(np.abs(np.mean(np.concatenate(d)))) if d else np.nan
        obs = plv(xs)
        nul = np.array([plv(shifted(xs)) for _ in range(n_null)])
        res.update({"plv": obs, "plv_null": float(np.nanmean(nul)), "plv_p": float((1 + (nul >= obs).sum()) / (1 + n_null))})
    except Exception:
        pass
    # mutual information
    def flat(xs_):
        x = np.concatenate(xs_)
        y = np.concatenate(ys)
        ok = np.isfinite(x) & np.isfinite(y)
        x, y = x[ok], y[ok]
        if x.size > 3000:
            idx = rng.choice(x.size, 3000, replace=False)
            x, y = x[idx], y[idx]
        return x, y
    x, y = flat(xs)
    if x.size > 100:
        mi = float(mutual_info_regression(x[:, None], y, n_neighbors=4, random_state=0)[0])
        r = np.corrcoef(x, y)[0, 1]
        mig = float(-0.5 * np.log(max(1e-12, 1 - r ** 2)))
        nul = []
        for _ in range(min(n_null, 10)):
            xn, yn = flat(shifted(xs))
            nul.append(mutual_info_regression(xn[:, None], yn, n_neighbors=4, random_state=0)[0])
        res.update({"mi_nats": mi, "mi_linear_part": mig, "mi_nonlinear_excess": mi - mig,
                    "mi_null": float(np.mean(nul)), "mi_p": float((1 + (np.array(nul) >= mi).sum()) / (1 + len(nul)))})
    # DTW alignment on 10 s windows
    try:
        import librosa
        w = int(10 * rate)

        def dtw_cost(xs_):
            costs = []
            for x, y in zip(xs_, ys):
                for s in range(0, x.size - w, w):
                    a_, b_ = x[s:s + w], y[s:s + w]
                    if not (np.isfinite(a_).all() and np.isfinite(b_).all()):
                        continue
                    if a_.std() < 1e-6 or b_.std() < 1e-6:
                        continue
                    a_ = (a_ - a_.mean()) / a_.std()
                    b_ = (b_ - b_.mean()) / b_.std()
                    C = np.abs(a_[:, None] - b_[None, :])
                    D, wp = librosa.sequence.dtw(C=C, global_constraints=True, band_rad=0.1)
                    costs.append(D[-1, -1] / len(wp))
                    if len(costs) >= 60:
                        return float(np.mean(costs))
            return float(np.mean(costs)) if costs else np.nan
        obs = dtw_cost(xs)
        nul = np.array([dtw_cost(shifted(xs)) for _ in range(min(n_null, 8))])
        res.update({"dtw_cost": obs, "dtw_null": float(np.nanmean(nul)), "dtw_ratio": obs / float(np.nanmean(nul))})
    except Exception:
        pass
    # recurring joint motifs (3 s windows of [x(t-tau), y(t)])
    def motif_nn(xs_):
        L, step = int(3 * rate), max(1, int(0.5 * rate))
        W, owner, pos = [], [], []
        for si, (x, y) in enumerate(zip(xs_, ys)):
            for s in range(0, x.size - L, step):
                a_, b_ = x[s:s + L], y[s:s + L]
                if not (np.isfinite(a_).all() and np.isfinite(b_).all()):
                    continue
                v = np.concatenate([(a_ - a_.mean()) / (a_.std() + 1e-6), (b_ - b_.mean()) / (b_.std() + 1e-6)])
                W.append(v); owner.append(si); pos.append(s)
        if len(W) < 20:
            return np.nan
        W = np.array(W)
        if len(W) > 1500:
            idx = rng.choice(len(W), 1500, replace=False)
            W, owner, pos = W[idx], np.array(owner)[idx], np.array(pos)[idx]
        owner, pos = np.asarray(owner), np.asarray(pos)
        sq = (W ** 2).sum(1)
        D = np.sqrt(np.maximum(sq[:, None] + sq[None, :] - 2 * W @ W.T, 0))
        trivial = (owner[:, None] == owner[None, :]) & (np.abs(pos[:, None] - pos[None, :]) < L)
        D[trivial] = np.inf
        return float(np.median(D.min(axis=1)))
    obs = motif_nn(xs)
    nul = np.array([motif_nn(shifted(xs)) for _ in range(min(n_null, 5))])
    res.update({"motif_nn_dist": obs, "motif_nn_null": float(np.nanmean(nul)),
                "motif_ratio": obs / float(np.nanmean(nul)) if np.isfinite(nul).any() else np.nan})
    return res
