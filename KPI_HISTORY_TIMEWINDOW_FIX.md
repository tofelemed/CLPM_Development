# KPI History Time Window Fix

## Issue
The KPI History tab in the Loop Detail page had a time window selector, but changing it didn't actually filter the data. It was always showing 30 days of data regardless of the selected time window.

## Root Cause
**File:** `frontend/src/pages/LoopDetail.tsx`  
**Lines:** 338-353 (before fix)

The KPI data fetching was using a hardcoded 30-day time window:

```typescript
// ❌ BEFORE - Hardcoded 30 days
const endTime = new Date();
const startTime = new Date(endTime.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days
```

While the `kpiWindow` state variable existed and was included in the `useEffect` dependencies, it was never actually used in the data fetch logic.

## Solution

The fix uses the existing `parseTimeWindow` helper function to convert the `kpiWindow` state (e.g., "1h", "6h", "24h") into milliseconds:

```typescript
// ✅ AFTER - Uses kpiWindow state
const kpiWindowMs = parseTimeWindow(kpiWindow);
const endTime = new Date();
const startTime = new Date(endTime.getTime() - kpiWindowMs);

console.log('Fetching KPI data for window:', kpiWindow, 'from:', startTime.toISOString(), 'to:', endTime.toISOString());
```

## Changes Made

### Modified: `frontend/src/pages/LoopDetail.tsx` (Lines 338-353)

**Before:**
```typescript
// Fetch comprehensive KPI history
try {
  // Use a wider time window to ensure we get data
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days
  
  const kpiResponse = await axios.get(`${API}/loops/${id}/kpis/comprehensive`, {
    params: {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      limit: 100
    }
  });
```

**After:**
```typescript
// Fetch comprehensive KPI history
try {
  // Use the selected kpiWindow time range
  const kpiWindowMs = parseTimeWindow(kpiWindow);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - kpiWindowMs);
  
  console.log('Fetching KPI data for window:', kpiWindow, 'from:', startTime.toISOString(), 'to:', endTime.toISOString());
  
  const kpiResponse = await axios.get(`${API}/loops/${id}/kpis/comprehensive`, {
    params: {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      limit: 100
    }
  });
```

## How It Works

1. **User selects time window** (e.g., "6h") from the dropdown in KPI History tab
2. **State updates:** `setKpiWindow("6h")` is called
3. **useEffect triggers:** Since `kpiWindow` is in the dependency array `[id, timeWindow, kpiWindow]`, the effect runs
4. **fetchLoopData executes:** Calls `parseTimeWindow("6h")` which returns `6 * 60 * 60 * 1000` milliseconds
5. **API request:** Fetches KPI data for the last 6 hours
6. **Chart updates:** Shows data for the selected time window

## Time Window Options

The KPI History tab supports the following time windows:
- **15 minutes** (`"15m"`)
- **1 hour** (`"1h"`) - Default
- **6 hours** (`"6h"`)
- **24 hours** (`"24h"`)

## Testing

### Manual Test Steps:
1. Navigate to any loop detail page
2. Click on the "KPI History" tab
3. Change the time window dropdown from "1 hour" to "6 hours"
4. Verify:
   - Browser console shows: `Fetching KPI data for window: 6h from: [timestamp] to: [timestamp]`
   - The time range is 6 hours
   - The KPI chart updates with data for that time range
5. Try other time windows (15m, 24h) and verify they work

### Verification in Browser Console:
```javascript
// After changing time window, you should see:
Fetching KPI data for window: 6h from: 2025-10-08T06:00:00.000Z to: 2025-10-08T12:00:00.000Z
KPI Response: {results: Array(72), ...}
KPI Results count: 72
```

## Related Components

### Live Trends Time Window
The Live Trends tab already had working time window functionality:
- Uses `timeWindow` state variable
- Properly calls `parseTimeWindow(timeWindow)` for data fetching
- Options: 1h, 6h, 24h, 7d

### Consistency
Both tabs now follow the same pattern:
1. State variable for time window
2. Dropdown selector
3. Use `parseTimeWindow()` helper
4. Include in useEffect dependencies
5. API call uses calculated time range

## Impact

✅ **Before Fix:**
- KPI History always showed 30 days of data
- Time window selector was non-functional
- Confusing UX - users couldn't control data range

✅ **After Fix:**
- KPI History respects selected time window
- Time window selector is fully functional
- Consistent behavior with Live Trends tab
- Better performance with smaller data sets

## Additional Notes

### Performance Improvement
By allowing users to select shorter time windows (15m, 1h), the app now:
- Fetches less data from the API
- Renders charts faster
- Uses less memory
- Provides better granularity for recent data

### Debug Logging
Added console logging to help troubleshoot time window issues:
```typescript
console.log('Fetching KPI data for window:', kpiWindow, 'from:', startTime.toISOString(), 'to:', endTime.toISOString());
```

This can be removed in production or kept for debugging purposes.

## Files Modified
- `frontend/src/pages/LoopDetail.tsx` (Lines 338-353)

## Linter Status
✅ No linter errors

## Related Documentation
- See `FRONTEND_BUG_FIXES.md` for other bugs fixed in this session
- See `CRITICAL_FIXES_SUMMARY.md` for quick reference guide

