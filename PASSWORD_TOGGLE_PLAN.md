# Password Toggle Eye Button Implementation Plan

## Task Overview
Add eye buttons to password fields in login and signup forms to allow users to toggle between hidden and visible password states.

## Information Gathered
- **LoginModal.js**: Contains one password field that needs eye button
- **SignupModal.js**: Contains two password fields (password and confirmPassword) that need eye buttons
- Both components use React functional components with hooks
- Existing styling uses CSS custom properties from design system
- Current password fields use `type="password"`

## Implementation Plan

### 1. LoginModal.js Updates
**State Management:**
- Add `showPassword` state (boolean) to track password visibility

**UI Components:**
- Add eye button next to password input field
- Eye icon: 👁️ (hidden) / 👁️‍🗨️ (visible)
- Position button inside input container with proper styling

**Functionality:**
- Toggle `showPassword` state on button click
- Change input `type` between "password" and "text" based on state
- Add hover effects and accessibility features

### 2. SignupModal.js Updates
**State Management:**
- Add `showPassword` state for main password field
- Add `showConfirmPassword` state for confirm password field

**UI Components:**
- Add eye button next to password input field
- Add eye button next to confirm password input field
- Use same eye icon pattern as LoginModal

**Functionality:**
- Toggle respective state variables on button clicks
- Change input `type` between "password" and "text" independently
- Maintain consistent styling and behavior

### 3. Styling Guidelines
- Position eye buttons inside the input container
- Use proper padding to avoid overlap with input text
- Apply consistent styling with existing design system
- Add hover states and proper cursor pointer
- Ensure accessibility with proper aria-labels

### 4. Accessibility Features
- Add `aria-label` to eye buttons for screen readers
- Include `title` attributes for tooltip information
- Ensure keyboard navigation works properly

## Files to Edit
1. `/Users/khushalpatil/Desktop/EROS/frontend/src/components/LoginModal.js`
2. `/Users/khushalpatil/Desktop/EROS/frontend/src/components/SignupModal.js`

## Expected Outcome
- Users can click eye buttons to show/hide passwords in both login and signup forms
- Improved user experience and accessibility
- Consistent design with existing UI components
- Proper accessibility support for screen readers

## Testing Considerations
- Test toggle functionality in both modals
- Verify visual consistency across different screen sizes
- Test accessibility with screen readers
- Ensure proper focus management
