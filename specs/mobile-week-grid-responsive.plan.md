# Mobile Responsive Week-Grid Component Test Plan

## Application Overview

This test plan verifies the mobile responsive improvements made to the Schedule Management week-grid component. The component has been optimized for compact mobile display with reduced padding (p-1 vs p-2), reduced gaps (gap-0.5 vs gap-1), smaller minimum widths (70px vs 90px), and smaller minimum heights (70px vs 100px). Testing will cover visual layout, text readability, touch target accessibility, and functionality across different viewport sizes and locales.

## Test Scenarios

### 1. Mobile Layout and Visual Display (iPhone 12 - 390x844)

**Seed:** `e2e/seeds/auth.seed.ts`

#### 1.1. Week grid displays properly on mobile viewport

**File:** `e2e/schedule/mobile-week-grid-layout.spec.ts`

**Steps:**
  1. Set viewport to iPhone 12 size (390x844px)
    - expect: Viewport is set correctly
  2. Navigate to /ko/login and authenticate with test-master@workeasy.test
    - expect: User is successfully logged in
    - expect: Redirected to dashboard
  3. Navigate to /ko/schedule page
    - expect: Schedule page loads successfully
    - expect: Week-grid component is visible
  4. Verify the week-grid header row displays all 7 days plus user column
    - expect: Header row contains '사용자' (User) column
    - expect: All 7 weekday headers are visible (월, 화, 수, 목, 금, 토, 일)
    - expect: Date labels are displayed under each weekday (02/02 - 02/08)
  5. Verify the morning/afternoon staff count row is visible
    - expect: '오전 인원' (Morning Staff) label is visible
    - expect: '오후 인원' (Afternoon Staff) label is visible
    - expect: Staff count numbers (0) are displayed for each day
  6. Verify user row displays correctly
    - expect: User avatar with initial 'T' is visible
    - expect: User name 'test-master' is readable
    - expect: Total hours '0h' is displayed
    - expect: Role badge '마스터 관리자' (Master Administrator) is visible
    - expect: Empty cells show '-' placeholder for each day
  7. Take screenshot of initial mobile view
    - expect: Screenshot saved successfully

#### 1.2. Grid cells have compact mobile styling

**File:** `e2e/schedule/mobile-week-grid-compact-styling.spec.ts`

**Steps:**
  1. Navigate to schedule page on mobile viewport (390x844)
    - expect: Schedule page loads with week-grid
  2. Measure the minimum width of a day column cell
    - expect: Day column cells have minimum width of 70px on mobile
    - expect: Cells are more compact than desktop version
  3. Measure the minimum height of user assignment cells
    - expect: Assignment cells have minimum height of 70px on mobile
    - expect: Height is reduced compared to desktop (100px)
  4. Verify grid gaps between cells
    - expect: Gap between cells is 0.5 spacing units (gap-0.5) on mobile
    - expect: Visual spacing appears compact but not cramped
  5. Verify cell padding
    - expect: Cells have padding of p-1 on mobile
    - expect: Content is not touching cell borders
    - expect: Padding is visibly smaller than desktop version
  6. Take screenshot highlighting compact layout
    - expect: Screenshot shows compact grid structure

#### 1.3. Horizontal scrolling works correctly on mobile

**File:** `e2e/schedule/mobile-week-grid-horizontal-scroll.spec.ts`

**Steps:**
  1. Navigate to schedule page on mobile viewport
    - expect: Week-grid is displayed
  2. Verify the grid container has overflow-x-auto class
    - expect: Horizontal scroll is enabled for the grid
  3. Verify initial view shows first 2-3 days
    - expect: Monday (월) and Tuesday (화) columns are fully visible
    - expect: Not all 7 days fit on screen simultaneously
  4. Perform horizontal swipe gesture from right to left
    - expect: Grid scrolls horizontally
    - expect: Additional days (Wed, Thu, Fri, Sat, Sun) come into view
    - expect: Scroll animation is smooth
  5. Swipe back from left to right
    - expect: Grid scrolls back to the left
    - expect: Monday column returns to view
    - expect: User column remains fixed/visible
  6. Take screenshot at different scroll positions
    - expect: Screenshots show different portions of the week

#### 1.4. Text remains readable with smaller font sizes

**File:** `e2e/schedule/mobile-week-grid-text-readability.spec.ts`

**Steps:**
  1. Navigate to schedule page on mobile viewport
    - expect: Week-grid is displayed
  2. Verify weekday labels use text-[10px] on mobile
    - expect: Weekday names (월, 화, 수, etc.) are readable at small size
    - expect: Font size increases to text-sm on desktop (md: breakpoint)
  3. Verify date labels (02/02, 02/03, etc.) are readable
    - expect: Dates use text-[10px] on mobile
    - expect: All dates are legible without zooming
  4. Verify Morning/Afternoon Staff labels
    - expect: '오전 인원' and '오후 인원' use text-[10px]
    - expect: Labels are readable despite smaller size
    - expect: Blue color (text-blue-600) provides good contrast
  5. Verify user information text
    - expect: User name 'test-master' is readable at text-[9px]
    - expect: Hours '0h' is readable at text-[10px]
    - expect: Role badge text is legible
  6. Verify empty cell placeholder '-' is visible
    - expect: Dash character is clearly visible
    - expect: Text color provides sufficient contrast
  7. Take close-up screenshot of text elements
    - expect: All text elements are visually readable

### 2. Touch Targets and Interactive Elements

**Seed:** `e2e/seeds/auth.seed.ts`

#### 2.1. Empty cells are clickable with adequate touch targets

**File:** `e2e/schedule/mobile-week-grid-touch-targets.spec.ts`

**Steps:**
  1. Navigate to schedule page on mobile viewport (390x844)
    - expect: Week-grid is displayed with empty cells showing '-'
  2. Measure the touch target area of an empty cell
    - expect: Cell has minimum height of 70px
    - expect: Cell has minimum width of 70px
    - expect: Touch target meets minimum 44x44px accessibility guideline
    - expect: Cell has cursor-pointer class indicating clickability
  3. Tap on Monday's empty cell for test-master user
    - expect: Cell responds to tap event
    - expect: Assignment dialog opens
    - expect: Dialog shows 'test-master - 02/01 (일)' as header
    - expect: Dialog contains work item selection dropdown
  4. Close the dialog by tapping the close button
    - expect: Close button is tappable
    - expect: Dialog closes successfully
    - expect: Returns to week-grid view
  5. Tap on Tuesday's empty cell
    - expect: Dialog opens for Tuesday assignment
    - expect: Correct date is displayed in dialog header
  6. Take screenshot of dialog on mobile
    - expect: Dialog is properly sized for mobile viewport

#### 2.2. User name cell is clickable and responsive

**File:** `e2e/schedule/mobile-week-grid-user-interaction.spec.ts`

**Steps:**
  1. Navigate to schedule page on mobile viewport
    - expect: Week-grid is displayed
  2. Verify user information cell has touch-manipulation class
    - expect: Cell has touch-manipulation class for better mobile interaction
    - expect: Cell has cursor-pointer and hover effects
  3. Tap on the user name cell (test-master)
    - expect: Cell responds to tap
    - expect: Appropriate action is triggered (if implemented)
    - expect: No console errors occur
  4. Verify avatar is visible and properly sized
    - expect: Avatar shows 'T' initial
    - expect: Avatar size is h-4 w-4 (16px) on mobile
    - expect: Avatar increases to h-6 w-6 (24px) on desktop
  5. Verify role badge is visible
    - expect: Role badge '마스터 관리자' is displayed
    - expect: Badge uses compact styling on mobile
    - expect: Badge text is readable

#### 2.3. Assignment cells with content are interactive

**File:** `e2e/schedule/mobile-week-grid-assignment-interaction.spec.ts`

**Steps:**
  1. Create a test schedule assignment for Monday
    - expect: Assignment is created in database
  2. Navigate to schedule page and verify assignment displays
    - expect: Assignment cell shows work item name
    - expect: Time range is displayed with Clock icon
    - expect: Status indicator (CONFIRMED/PENDING) is visible
    - expect: Required roles badges are shown if applicable
  3. Verify assignment cell padding and sizing
    - expect: Cell uses p-0.5 padding on mobile
    - expect: Cell increases to p-1.5 on desktop
    - expect: Content fits within cell boundaries
  4. Tap on the assignment cell
    - expect: Cell is clickable with touch-manipulation class
    - expect: Assignment details dialog opens
    - expect: Correct assignment information is displayed
  5. Verify icons are appropriately sized
    - expect: Clock icon is h-2.5 w-2.5 on mobile
    - expect: Icons scale to h-3 w-3 on desktop
    - expect: Icons are visible and recognizable
  6. Clean up test assignment
    - expect: Test data is removed

### 3. Internationalization and Locale Support

**Seed:** `e2e/seeds/auth.seed.ts`

#### 3.1. Korean locale displays correctly on mobile

**File:** `e2e/schedule/mobile-week-grid-korean-locale.spec.ts`

**Steps:**
  1. Navigate to /ko/schedule on mobile viewport
    - expect: Schedule page loads with Korean translations
  2. Verify Korean weekday labels
    - expect: Days display as: 월, 화, 수, 목, 금, 토, 일
    - expect: All Korean characters are rendered correctly
    - expect: No character encoding issues
  3. Verify Korean labels for staff counts
    - expect: '오전 인원' displays correctly
    - expect: '오후 인원' displays correctly
  4. Verify '사용자' label in header
    - expect: '사용자' (User) label is displayed
  5. Verify role badge in Korean
    - expect: '마스터 관리자' (Master Administrator) displays correctly
  6. Take screenshot of Korean mobile view
    - expect: All Korean text is properly rendered

#### 3.2. English locale displays correctly on mobile

**File:** `e2e/schedule/mobile-week-grid-english-locale.spec.ts`

**Steps:**
  1. Navigate to /en/schedule on mobile viewport
    - expect: Schedule page loads with English translations
  2. Verify English weekday labels
    - expect: Days display as: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    - expect: All labels fit within compact mobile cells
  3. Verify English labels for staff counts
    - expect: 'Morning Staff' displays correctly
    - expect: 'Afternoon Staff' displays correctly
    - expect: Text does not overflow cell boundaries
  4. Verify 'User' label in header
    - expect: 'User' label is displayed in header column
  5. Verify role badge in English
    - expect: 'Master Administrator' displays correctly
  6. Take screenshot of English mobile view
    - expect: All English text is properly rendered and readable

#### 3.3. Locale switching maintains grid state

**File:** `e2e/schedule/mobile-week-grid-locale-switching.spec.ts`

**Steps:**
  1. Navigate to /ko/schedule on mobile
    - expect: Korean schedule page loads
  2. Scroll horizontally to show Wednesday column
    - expect: Grid is scrolled to mid-week
  3. Switch to English locale by navigating to /en/schedule
    - expect: Page reloads with English translations
    - expect: Grid structure is maintained
    - expect: Same week date range is displayed
  4. Verify grid cells maintain their compact mobile styling
    - expect: Mobile-specific classes are still applied
    - expect: Padding, gaps, and sizes are consistent
  5. Switch back to Korean locale
    - expect: Korean translations are restored
    - expect: Grid layout remains consistent

### 4. Responsive Breakpoints and Tablet View

**Seed:** `e2e/seeds/auth.seed.ts`

#### 4.1. Grid expands properly on tablet viewport

**File:** `e2e/schedule/week-grid-tablet-responsive.spec.ts`

**Steps:**
  1. Set viewport to tablet size (768x1024 - iPad portrait)
    - expect: Viewport is set to tablet dimensions
  2. Navigate to /en/schedule
    - expect: Schedule page loads on tablet viewport
  3. Verify grid cells use desktop/tablet styling
    - expect: Day columns no longer have min-w-[70px]
    - expect: Cells use md:w-auto for fluid width
    - expect: All 7 days fit on screen without horizontal scroll
  4. Verify padding increases on tablet
    - expect: Header cells use md:p-3 (12px padding)
    - expect: User cells use md:p-2 (8px padding)
    - expect: Assignment cells use md:p-2
  5. Verify gap increases on tablet
    - expect: Grid uses md:gap-1 between cells
    - expect: Spacing is more generous than mobile
  6. Verify font sizes increase on tablet
    - expect: Weekdays use md:text-sm instead of text-[10px]
    - expect: User names use md:text-xs instead of text-[9px]
    - expect: All text is more readable at larger sizes
  7. Verify avatar size increases
    - expect: Avatar uses md:h-6 md:w-6 (24px) instead of h-4 w-4
    - expect: Icons scale up appropriately
  8. Take screenshot of tablet view
    - expect: Grid displays with expanded desktop-style layout

#### 4.2. Breakpoint transition from mobile to tablet

**File:** `e2e/schedule/week-grid-breakpoint-transition.spec.ts`

**Steps:**
  1. Start with mobile viewport (390x844)
    - expect: Mobile styling is applied
  2. Gradually increase viewport width to 768px
    - expect: Layout transitions smoothly
    - expect: No layout breaks or overlaps occur
    - expect: Horizontal scroll disappears as viewport expands
  3. Verify breakpoint occurs at md: (768px)
    - expect: At 767px, mobile styles are active
    - expect: At 768px, tablet/desktop styles activate
    - expect: Transition is clean without visual glitches
  4. Test at exact breakpoint (768px)
    - expect: Layout is stable
    - expect: All cells are properly sized
    - expect: Content is readable
  5. Reduce viewport back to mobile size
    - expect: Mobile styles are re-applied
    - expect: Horizontal scroll is restored
    - expect: Compact layout returns

#### 4.3. Desktop viewport (1920x1080) shows full expanded grid

**File:** `e2e/schedule/week-grid-desktop-responsive.spec.ts`

**Steps:**
  1. Set viewport to desktop size (1920x1080)
    - expect: Large desktop viewport is set
  2. Navigate to /en/schedule
    - expect: Schedule page loads on desktop
  3. Verify grid uses full available width
    - expect: All 7 days are visible without scroll
    - expect: Columns are evenly distributed
    - expect: Generous spacing between cells
  4. Verify all desktop styling is applied
    - expect: Padding is md:p-3 for headers
    - expect: Font sizes are md:text-sm or larger
    - expect: Icons are md:h-3 md:w-3 or larger
    - expect: Gaps are md:gap-1
  5. Verify no horizontal scroll exists
    - expect: Grid fits within viewport width
    - expect: No overflow-x scrolling needed
  6. Take screenshot of desktop view
    - expect: Full week grid is displayed with optimal spacing

### 5. Edge Cases and Error States

**Seed:** `e2e/seeds/auth.seed.ts`

#### 5.1. Grid handles long user names on mobile

**File:** `e2e/schedule/mobile-week-grid-long-names.spec.ts`

**Steps:**
  1. Create a test user with a very long name (30+ characters)
    - expect: User is created in database
  2. Navigate to schedule page on mobile viewport
    - expect: Week-grid loads with test user
  3. Verify long user name is truncated
    - expect: Name uses 'truncate' class to prevent overflow
    - expect: Ellipsis (...) appears if name is too long
    - expect: Cell width remains constrained
    - expect: Layout is not broken
  4. Hover/tap on user name to see full name
    - expect: Full name is accessible via tooltip or dialog
    - expect: No text overlaps adjacent cells
  5. Clean up test user
    - expect: Test data is removed

#### 5.2. Grid handles unavailable status on mobile

**File:** `e2e/schedule/mobile-week-grid-unavailable.spec.ts`

**Steps:**
  1. Set user availability to unavailable for Monday
    - expect: Unavailability is saved
  2. Navigate to schedule page on mobile
    - expect: Week-grid loads
  3. Verify unavailable indicator displays in Monday cell
    - expect: Red icon (AlertCircle) is visible
    - expect: Text '이용 불가' or 'Unavailable' is shown
    - expect: Cell has red border (border-red-200)
    - expect: Cell background is red-50
    - expect: Icon size is h-2.5 w-2.5 on mobile
  4. Verify unavailable cell is still compact
    - expect: Cell maintains p-0.5 padding
    - expect: Cell min-height is 70px
    - expect: Content fits within cell boundaries
  5. Tap on unavailable cell
    - expect: Cell is still interactive
    - expect: Dialog opens with unavailability notice
    - expect: User can override unavailability if authorized
  6. Clean up unavailability data
    - expect: Test data is removed

#### 5.3. Grid handles multiple assignments in one cell

**File:** `e2e/schedule/mobile-week-grid-multiple-assignments.spec.ts`

**Steps:**
  1. Create 3 schedule assignments for the same user on Monday
    - expect: Multiple assignments are created
  2. Navigate to schedule page on mobile
    - expect: Week-grid loads with multiple assignments
  3. Verify all assignments are displayed in Monday cell
    - expect: All 3 assignments are stacked vertically
    - expect: Each assignment has its own work item name
    - expect: Each shows time range with Clock icon
    - expect: Cell expands vertically to fit all assignments
  4. Verify cell remains compact horizontally
    - expect: Cell width stays at min-w-[70px]
    - expect: No horizontal overflow
    - expect: Text truncates if necessary
  5. Verify gap between assignments
    - expect: Assignments have gap-0.5 between them on mobile
    - expect: Visual separation is clear
  6. Scroll horizontally to ensure other days are not affected
    - expect: Other day columns maintain their layout
    - expect: Grid remains functional
  7. Clean up test assignments
    - expect: Test data is removed

#### 5.4. Grid handles empty week with no users

**File:** `e2e/schedule/mobile-week-grid-no-users.spec.ts`

**Steps:**
  1. Create a new store with no assigned users
    - expect: Empty store is created
  2. Switch to the empty store
    - expect: Store context updates
  3. Navigate to schedule page on mobile
    - expect: Week-grid loads
  4. Verify grid shows empty state or header only
    - expect: Header row is still displayed
    - expect: Staff count row shows all zeros
    - expect: No user rows are displayed
    - expect: Empty state message may appear
    - expect: No errors in console
  5. Verify grid layout is not broken
    - expect: Grid structure remains intact
    - expect: Horizontal scroll still works
    - expect: All 7 days are accessible
  6. Clean up test store
    - expect: Test data is removed
