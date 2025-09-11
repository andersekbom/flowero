# Performance Tasks - Card Generation Issues

## Problem Summary
The visualization stops generating cards after running for extended periods. Starfield mode fails within minutes, while falling boxes mode lasts several hours. The backend continues receiving messages (performance info updates), but no new cards are created.

## Root Causes Identified

1. **Radial Animation Counter Bug** - `activeRadialAnimations` counter may not decrement properly
2. **Z-Index Overflow** - Unbounded z-index decrementing causes rendering issues
3. **DOM Query Performance** - Expensive DOM operations in visualization clearing
4. **Backend Queue Limits** - 10k message limit causes message drops
5. **Thread Safety Issues** - Backend message processor can crash silently

## Tasks to Address Issues

### Critical Issues (High Priority)

#### 1. Fix Radial Animation Counter Bug
**Location**: `frontend/app.js:453-494`
**Problem**: `activeRadialAnimations` increments but may not decrement properly, blocking new card creation
**Tasks**:
- Ensure `activeRadialAnimations--` executes in all code paths
- Add try-catch around animation cleanup at line 492
- Consider using Promise-based animation tracking instead of manual counting
- Add bounds checking to prevent counter from going negative

#### 2. Add Z-Index Bounds Checking
**Location**: `frontend/app.js:431-433`
**Problem**: `messageZIndex` decrements indefinitely, potentially causing CSS rendering issues
**Tasks**:
- Reset `messageZIndex` when it gets too low (e.g. < -999999)
- Use modulo operation to cycle z-index values within safe range
- Consider using CSS `isolation: isolate` to create new stacking contexts
- Add maximum and minimum z-index constants

#### 3. Optimize DOM Query Performance
**Location**: `frontend/app.js:705-726`
**Problem**: `clearAllVisualizations()` uses expensive DOM queries repeatedly
**Tasks**:
- Cache DOM queries in `clearAllVisualizations()`
- Use more efficient selectors (class-based instead of querySelectorAll)
- Batch DOM operations using DocumentFragment
- Consider maintaining active element references instead of querying

### Backend Issues (Medium Priority)

#### 4. Increase Message Queue Capacity
**Location**: `src/message_queue.py:29, 41`
**Problem**: 10,000 message queue limit causes message drops during high traffic
**Tasks**:
- Increase `max_queue_size` from 10,000 to 50,000 or 100,000
- Add queue utilization monitoring and alerts
- Implement queue size auto-scaling based on message rate
- Add configuration option for queue size limits

#### 5. Add Thread Recovery Mechanism
**Location**: `src/message_queue.py:147-171`
**Problem**: Message processing thread can crash silently, breaking message flow
**Tasks**:
- Add automatic restart logic for crashed processing threads
- Implement health checks for message processing
- Add exponential backoff for thread restart attempts
- Add thread status monitoring to the API endpoints

### Diagnostics (Low Priority)

#### 6. Add Performance Monitoring
**Problem**: Lack of visibility into system state during long-running sessions
**Tasks**:
- Log animation counter values periodically in frontend
- Monitor queue sizes and processing rates in backend
- Add performance metrics to the UI dashboard
- Track memory usage and DOM element counts
- Add debug mode for detailed performance logging
- Create performance alerts for critical thresholds

## Implementation Priority

1. **Immediate**: Fix radial animation counter bug (blocks starfield mode)
2. **Short-term**: Add z-index bounds checking and DOM optimization
3. **Medium-term**: Backend queue improvements and thread recovery
4. **Long-term**: Comprehensive performance monitoring and diagnostics

## Testing Strategy

- Test each visualization mode for 24+ hours continuous operation
- Monitor memory usage and performance metrics during extended runs
- Verify message processing continues without interruption
- Test with high message rates (1000+ messages/second)
- Validate queue overflow handling and recovery mechanisms

## Key Files Modified

- `frontend/app.js` - Animation counter fixes, z-index bounds, DOM optimization
- `src/message_queue.py` - Queue size limits, thread recovery
- `backend/main.py` - Performance monitoring endpoints