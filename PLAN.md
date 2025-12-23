# Map Center Enhancement Plan

## Task: Add feature that reporter selects a location, the map view must be on that point and not on the default view

## Information Gathered:
- Current AddEmergency.js has hardcoded center: [19.076, 72.8777]
- LocationPicker component handles click events and updates position state
- Selected position is stored in `position` state as [lat, lng]
- MapView.js shows how to dynamically calculate center based on markers

## Plan:
1. **Modify AddEmergency.js MapContainer**:
   - Replace hardcoded center with dynamic calculation
   - Use selected position as center when available, fallback to default
   - Add proper center state management

2. **Add MapAutoCenter component** (similar to MapView.js):
   - Create MapAutoCenter component to handle center updates
   - Ensure smooth transitions when center changes

3. **Update MapContainer props**:
   - Remove hardcoded center
   - Add center prop that updates dynamically
   - Ensure proper key prop for re-rendering when center changes

## Files to Edit:
- `/Users/khushalpatil/Desktop/EROS/frontend/src/components/AddEmergency.js`

## Implementation Details:
- Default center: [19.076, 72.8777] (Mumbai coordinates)
- When position is selected: use [position[0], position[1]] as center
- When no position: use default center
- Add smooth animation for center transitions

## Expected Outcome:
- When reporter selects a location on map, the map automatically centers on that point
- Map shows default view only when no location is selected
- Smooth transitions between different map views
