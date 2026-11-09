import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="session")
def small_world():
    from empc.synthetic import make_dataset
    return make_dataset(n_videos=4, n_viewers=2, duration=75, seed=3)


@pytest.fixture(scope="session")
def null_world():
    from empc.synthetic import make_dataset
    return make_dataset(n_videos=4, n_viewers=2, duration=75, seed=4, coupled=False)


@pytest.fixture(scope="session")
def fast_cfg():
    from empc.discovery import SearchConfig
    from empc.pipeline import ExperimentConfig
    return ExperimentConfig(search=SearchConfig(n_surrogates=199, n_val_surrogates=49, scales_s=(0.0, 1.0)),
                            compare=("staged", "adaptive"), stability_runs=1, evolve_budget=40,
                            evolve_seeds=(0,), evolve_targets=1, max_patterns=6, run_diagnostics=True)
