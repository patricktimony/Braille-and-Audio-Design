"""Evolutionary search for compact multi-term predictive patterns, compared
with random search and greedy forward selection under the SAME budget of
fitness evaluations.  We do not assume evolution wins; we measure it.

Genome: up to ``max_terms`` terms (source feature, temporal scale, lag).
Fitness: validation bits saved per sample over the target's own history
(two-part MDL, so every added term must pay for itself).
"""
from __future__ import annotations

import numpy as np

from .discovery import SearchConfig, bits_saved, design, ols, ols_pred, self_lags
from .store import FeatureStore


class Fitness:
    def __init__(self, store: FeatureStore, target: str, cfg: SearchConfig):
        self.store, self.target, self.cfg = store, target, cfg
        self.sl = self_lags(target, cfg, store.rate)
        self.cache: dict = {}
        self.evals = 0
        Sf, _, yf, _ = design(store, target, [], self.sl, 0.0, "fit", cfg.val_split)
        Sv, _, yv, _ = design(store, target, [], self.sl, 0.0, "val", cfg.val_split)
        b = ols(Sf, yf)
        self.sse_self = float(np.sum((yv - ols_pred(b, Sv)) ** 2))

    def __call__(self, genome: tuple) -> float:
        key = tuple(sorted(genome))
        if key in self.cache:
            return self.cache[key]
        self.evals += 1
        if not genome:
            self.cache[key] = 0.0
            return 0.0
        preds = list(key)
        Sf, Xf, yf, _ = design(self.store, self.target, preds, self.sl, 0.0, "fit", self.cfg.val_split)
        Sv, Xv, yv, _ = design(self.store, self.target, preds, self.sl, 0.0, "val", self.cfg.val_split)
        if len(yf) < 50 or len(yv) < 30:
            f = -1.0
        else:
            b = ols(np.column_stack([Sf, Xf]), yf)
            sse = float(np.sum((yv - ols_pred(b, np.column_stack([Sv, Xv]))) ** 2))
            f = bits_saved(self.sse_self, sse, len(yv), len(preds), len(yf))
        self.cache[key] = f
        return f


def _random_term(rng, sources, scales, lag_max):
    return (sources[rng.integers(len(sources))], float(scales[rng.integers(len(scales))]),
            int(rng.integers(0, lag_max + 1)))


def _random_genome(rng, sources, scales, lag_max, max_terms):
    return tuple(_random_term(rng, sources, scales, lag_max) for _ in range(rng.integers(1, max_terms + 1)))


def _mutate(g, rng, sources, scales, lag_max, max_terms, rate):
    g = list(g)
    op = rng.integers(4)
    if op == 0 and len(g) < max_terms:
        g.append(_random_term(rng, sources, scales, lag_max))
    elif op == 1 and len(g) > 1:
        g.pop(rng.integers(len(g)))
    elif op == 2 and g:
        i = rng.integers(len(g))
        s, sc, L = g[i]
        g[i] = (s, sc, int(np.clip(L + rng.integers(-int(rate), int(rate) + 1), 0, lag_max)))
    elif g:
        i = rng.integers(len(g))
        s, sc, L = g[i]
        g[i] = (sources[rng.integers(len(sources))] if rng.random() < 0.5 else s,
                float(scales[rng.integers(len(scales))]), L)
    return tuple(dict.fromkeys(g))


def evolutionary(fit: Fitness, sources, scales, lag_max, budget, rng, max_terms=4, pop=20, rate=10.0):
    P = [_random_genome(rng, sources, scales, lag_max, max_terms) for _ in range(pop)]
    trace, best, best_g = [], -np.inf, ()
    while fit.evals < budget:
        F = [fit(g) for g in P]
        for g, f in zip(P, F):
            if f > best:
                best, best_g = f, g
        trace.append((fit.evals, best))
        order = np.argsort(F)[::-1]
        elite = [P[i] for i in order[:2]]
        new = list(elite)
        while len(new) < pop:
            a, b = (P[max(rng.integers(pop, size=2), key=lambda i: F[i])] for _ in range(2))
            child = tuple(dict.fromkeys(t for t in a + b if rng.random() < 0.5))[:max_terms] or a
            new.append(_mutate(child, rng, sources, scales, lag_max, max_terms, rate))
        P = new
    return best_g, best, trace


def random_search(fit: Fitness, sources, scales, lag_max, budget, rng, max_terms=4):
    trace, best, best_g = [], -np.inf, ()
    while fit.evals < budget:
        g = _random_genome(rng, sources, scales, lag_max, max_terms)
        f = fit(g)
        if f > best:
            best, best_g = f, g
        trace.append((fit.evals, best))
    return best_g, best, trace


def greedy_forward(fit: Fitness, sources, scales, lag_max, budget, rng, max_terms=4, per_step=None):
    per_step = per_step or max(10, budget // max_terms)
    g, best, trace = (), fit(()), []
    for _ in range(max_terms):
        cand_best, cand_g = best, None
        for _ in range(per_step):
            if fit.evals >= budget:
                break
            gg = g + (_random_term(rng, sources, scales, lag_max),)
            f = fit(gg)
            if f > cand_best:
                cand_best, cand_g = f, gg
            trace.append((fit.evals, max(best, cand_best)))
        if cand_g is None:
            break
        g, best = cand_g, cand_best
    return g, best, trace


def test_genome(train: FeatureStore, test: FeatureStore, target: str, genome, cfg: SearchConfig) -> float:
    """Fit on all training rows, report R^2 gain over self-history on test."""
    if not genome:
        return 0.0
    sl = self_lags(target, cfg, train.rate)
    preds = list(genome)
    S, X, y, _ = design(train, target, preds, sl, 0.0, "all", 1.0)
    St, Xt, yt, _ = design(test, target, preds, sl, 0.0, "all", 1.0)
    if len(y) < 50 or len(yt) < 30:
        return np.nan
    bs, bf = ols(S, y), ols(np.column_stack([S, X]), y)
    sst = float(np.sum((yt - yt.mean()) ** 2)) or 1.0
    return float((np.sum((yt - ols_pred(bs, St)) ** 2) - np.sum((yt - ols_pred(bf, np.column_stack([St, Xt]))) ** 2)) / sst)


def compare(train: FeatureStore, test: FeatureStore, target: str, sources: list[str], cfg: SearchConfig,
            budget: int = 300, seeds=(0, 1, 2), max_terms: int = 4) -> list[dict]:
    lag_max = int((cfg.max_lag_physio_s if target.startswith("physio") else cfg.max_lag_av_s) * train.rate)
    rows = []
    for seed in seeds:
        for name, fn in (("evolutionary", evolutionary), ("random", random_search), ("greedy", greedy_forward)):
            rng = np.random.default_rng(seed)
            fit = Fitness(train, target, cfg)
            g, best, trace = fn(fit, sources, list(cfg.scales_s), lag_max, budget, rng, max_terms=max_terms)
            target90 = 0.9 * best
            evals90 = next((e for e, b in trace if b >= target90), budget) if best > 0 else np.nan
            rows.append({"target": target, "method": name, "seed": seed, "evals": fit.evals,
                         "best_val_bits": best, "evals_to_90pct": evals90, "terms": len(g),
                         "genome": "; ".join(f"{s}@{sc:g}s lag {L / train.rate:.1f}s" for s, sc, L in g),
                         "test_gain": test_genome(train, test, target, g, cfg)})
    return rows
