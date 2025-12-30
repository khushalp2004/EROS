# calculateApproximateProgress Initialization Fix Plan

## Problem Analysis
The error "Cannot access 'calculateApproximateProgress' before initialization" occurs because:
- The function `calculateApproximateProgress` is called on line ~439 within the `enhancedPolylines` React.useMemo
- But the function is defined later on line ~481 inside the same component
- This creates a temporal dead zone where the function is accessed before initialization

## Root Cause
```javascript
// Called BEFORE definition
progress = calculateApproximateProgress(polyline.positions, currentPosition);

// Defined AFTER usage
const calculateApproximateProgress = (routePositions, currentPosition) => {
  // ... function implementation
};
```

## Solution Plan

### Step 1: Move Function Definition
Move the `calculateApproximateProgress` function definition to the top of the MapView component, before the `enhancedPolylines` useMemo where it's first called.

### Step 2: Function Placement
- Place the function right after the component declaration
- Keep it as a const function expression but ensure it's defined before use
- Or convert to function declaration for proper hoisting

### Step 3: Verification
- Ensure no other references to `calculateApproximateProgress` exist
- Test that the component renders without initialization errors
- Verify that route progress calculations work correctly

## Implementation Details

### Current Structure (Broken)
```javascript
function MapView() {
  // ... other code ...
  
  const enhancedPolylines = React.useMemo(() => {
    // ... calculateApproximateProgress called here (line ~439)
    progress = calculateApproximateProgress(...);
  }, [polylines, finalMarkers, animateRoutes]);
  
  // ... more code ...
  
  // Function defined here (line ~481) - TOO LATE!
  const calculateApproximateProgress = (routePositions, currentPosition) => {
    // implementation
  };
}
```

### Fixed Structure
```javascript
function MapView() {
  // Helper function defined FIRST - before any usage
  const calculateApproximateProgress = (routePositions, currentPosition) => {
    if (!routePositions || routePositions.length < 2 || !currentPosition) {
      return 0;
    }
    // ... rest of implementation
  };
  
  // ... other code ...
  
  const enhancedPolylines = React.useMemo(() => {
    // Now calculateApproximateProgress is available
    progress = calculateApproximateProgress(...);
  }, [polylines, finalMarkers, animateRoutes]);
  
  // ... rest of component
}
```

## Expected Outcome
- ✅ No more "before initialization" errors
- ✅ Route progress calculations work correctly
- ✅ Component renders without errors
- ✅ Real-time tracking functionality preserved

## Testing Strategy
1. Load the component and verify no console errors
2. Check that route progress indicators display correctly
3. Verify real-time unit tracking shows progress percentages
4. Test with various route configurations
