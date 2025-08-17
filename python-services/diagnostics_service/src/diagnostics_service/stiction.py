import numpy as np

def cross_corr_index(op: np.ndarray, pv: np.ndarray, max_lag: int = 10) -> float:
    op = op - np.nanmean(op)
    pv = pv - np.nanmean(pv)
    denom = np.nanstd(op) * np.nanstd(pv)
    if denom == 0 or len(op) < 5:
        return 0.0
    corr = []
    for lag in range(-max_lag, max_lag + 1):
        if lag < 0:
            c = np.nansum(op[:lag] * pv[-lag:])
        elif lag > 0:
            c = np.nansum(op[lag:] * pv[:-lag])
        else:
            c = np.nansum(op * pv)
        corr.append(c / (len(op) * denom))
    return float(np.nanmax(corr))
