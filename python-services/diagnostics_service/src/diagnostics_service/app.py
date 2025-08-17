from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import numpy as np
from .stiction import cross_corr_index
from .oscillation import dominant_period_fft, oscillation_index_acf

app = FastAPI(title="CLPM Diagnostics Service", version="0.2.0")

class Series(BaseModel):
    ts: List[float] = Field(..., description="Unix epoch seconds for samples")
    pv: List[float]
    op: List[float]
    sp: Optional[List[float]] = None

class RunRequest(BaseModel):
    loop_id: str
    series: Series
    sample_rate_hz: Optional[float] = None

class RunResponse(BaseModel):
    loop_id: str
    stiction_xcorr: float
    osc_period_s: Optional[float]
    osc_index: float
    classification: Literal["normal","stiction","tuning","deadband","oscillating"]

@app.post("/diagnostics/run", response_model=RunResponse)
def run(req: RunRequest):
    pv = np.asarray(req.series.pv, dtype=float)
    op = np.asarray(req.series.op, dtype=float)
    ts = np.asarray(req.series.ts, dtype=float)

    n = min(len(pv), len(op))
    pv, op, ts = pv[:n], op[:n], ts[:n]
    pv = pv - np.nanmean(pv)
    op = op - np.nanmean(op)

    xcorr = cross_corr_index(op, pv)
    period = dominant_period_fft(pv, ts)
    oi = float(oscillation_index_acf(pv))

    classification = "normal"
    if oi > 0.4 and period is not None:
        classification = "oscillating"
    if xcorr > 0.35 and oi > 0.2:
        classification = "stiction"

    return RunResponse(
        loop_id=req.loop_id,
        stiction_xcorr=float(xcorr),
        osc_period_s=float(period) if period is not None else None,
        osc_index=float(oi),
        classification=classification
    )
