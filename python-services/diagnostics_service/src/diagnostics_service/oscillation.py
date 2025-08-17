import numpy as np

def oscillation_index_acf(x: np.ndarray, max_lag_ratio: float = 0.25) -> float:
    x = x - np.nanmean(x)
    if len(x) < 10 or np.nanstd(x) == 0:
        return 0.0
    n = len(x)
    max_lag = max(2, int(n * max_lag_ratio))
    ac = np.correlate(x, x, mode='full')[n-1: n-1+max_lag]
    ac = ac / ac[0]
    return float(np.nanmax(ac[1:]))

def dominant_period_fft(x: np.ndarray, ts: np.ndarray) -> float | None:
    if len(x) < 16:
        return None
    x = x - np.nanmean(x)
    dt = np.nanmedian(np.diff(ts))
    if not np.isfinite(dt) or dt <= 0:
        return None
    X = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(len(x), d=dt)
    if len(freqs) < 3:
        return None
    mag = np.abs(X)
    mag[0] = 0.0
    idx = np.argmax(mag)
    f = freqs[idx]
    if f <= 0:
        return None
    return float(1.0 / f)
