# Club Saunas Design Schema

This document captures the design language extracted from the Club Saunas website (clubsaunas.com and clubsaunas.com/club_dallas) for application in the Club Operations POS system.

## Design Philosophy

The Club Saunas brand emphasizes:
- **Minimalism**: Clean, uncluttered interfaces with generous white space
- **Luxury**: Premium feel through refined typography and subtle details
- **Clarity**: High contrast, readable text, and clear visual hierarchy
- **Sophistication**: Muted color palette with strategic accent usage

## Color Palette

### Primary Colors
- **Black**: `#000000` - Primary background, text on light surfaces
- **White**: `#FFFFFF` - Primary text on dark, button backgrounds, card backgrounds
- **Gray Scale**: 
  - Light Gray: `#F5F5F5` - Subtle backgrounds, borders
  - Medium Gray: `#CCCCCC` - Muted text, secondary borders
  - Dark Gray: `#666666` - Borders, dividers
  - Charcoal: `#333333` - Secondary backgrounds

### Accent Color (Used Sparingly)
- **Primary Accent**: `#D4AF37` (Gold) - Buttons, highlights, status indicators
- **Accent Dark**: `#B8941F` - Hover states, pressed states

### Status Colors
- **Success/Green**: `#22C55E` - Clean status, success states
- **Warning/Amber**: `#F59E0B` - Cleaning status, warnings
- **Error/Red**: `#EF4444` - Dirty status, errors

## Typography

### Font Stack
- **Primary**: System fonts for performance and native feel
  - `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`
- **Monospace**: For codes, IDs, technical data
  - `'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Courier New', monospace`

### Font Sizes
- **Display Large**: `clamp(2.5rem, 5vw, 4rem)` - Hero headings, kiosk titles
- **Display**: `clamp(2rem, 4vw, 3rem)` - Page titles
- **Heading 1**: `clamp(1.75rem, 3vw, 2.5rem)` - Section headers
- **Heading 2**: `clamp(1.5rem, 2.5vw, 2rem)` - Subsection headers
- **Heading 3**: `clamp(1.25rem, 2vw, 1.5rem)` - Card titles
- **Body Large**: `clamp(1.125rem, 1.5vw, 1.25rem)` - Important body text
- **Body**: `1rem` - Standard body text
- **Body Small**: `0.875rem` - Secondary text, captions
- **Label**: `0.75rem` - Form labels, badges

### Font Weights
- **Light**: 300 - Decorative text
- **Regular**: 400 - Body text
- **Medium**: 500 - Emphasized text
- **Semibold**: 600 - Headings, buttons
- **Bold**: 700 - Strong emphasis

### Line Heights
- **Tight**: 1.2 - Headings
- **Normal**: 1.5 - Body text
- **Relaxed**: 1.75 - Long-form content

## Spacing Scale

Based on 8px grid system:
- **xs**: `0.25rem` (4px)
- **sm**: `0.5rem` (8px)
- **md**: `1rem` (16px)
- **lg**: `1.5rem` (24px)
- **xl**: `2rem` (32px)
- **2xl**: `3rem` (48px)
- **3xl**: `4rem` (64px)
- **4xl**: `6rem` (96px)

## Border Radius

- **None**: `0` - Tables, strict edges
- **Small**: `0.25rem` (4px) - Inputs, small badges
- **Medium**: `0.5rem` (8px) - Buttons, cards
- **Large**: `0.75rem` (12px) - Modals, large cards
- **Full**: `9999px` - Pills, circular elements

## Buttons

### Primary Button
- Background: White (`#FFFFFF`)
- Text: Black (`#000000`)
- Border: None
- Border Radius: `0.5rem` (8px)
- Padding: `1rem 2rem` (vertical horizontal)
- Font Size: `1rem`
- Font Weight: 600 (Semibold)
- Min Height: `48px` (touch target)
- Hover: Slight scale or shadow effect
- Disabled: 50% opacity

### Secondary Button
- Background: Transparent
- Text: White
- Border: 2px solid White
- Border Radius: `0.5rem` (8px)
- Padding: `1rem 2rem`
- Font Size: `1rem`
- Font Weight: 600
- Min Height: `48px`
- Hover: Background `rgba(255, 255, 255, 0.1)`

### Accent Button (Sparse Use)
- Background: Gold (`#D4AF37`)
- Text: Black
- Border: None
- Border Radius: `0.5rem`
- Padding: `1rem 2rem`
- Hover: Darker gold (`#B8941F`)

## Cards

- Background: White or Dark Gray (`#1A1A1A`) depending on context
- Border: 1px solid `#333333` (dark mode) or `#E5E5E5` (light mode)
- Border Radius: `0.75rem` (12px)
- Padding: `1.5rem` to `2rem`
- Shadow: Subtle shadow for depth (optional)

## Input Fields

- Background: Transparent or subtle gray
- Border: 1px solid `#666666`
- Border Radius: `0.375rem` (6px)
- Padding: `0.75rem 1rem`
- Font Size: `1rem`
- Focus: Border color changes to accent or white
- Disabled: 50% opacity

## Modals

- Overlay: `rgba(0, 0, 0, 0.8)` - Dark backdrop
- Background: Black or Dark Gray
- Border: 2px solid `#666666`
- Border Radius: `0.75rem` (12px)
- Padding: `2rem`
- Max Width: `600px` (responsive)
- Animation: Fade in + slide up

## Layout Patterns

### Page Shell
- Full viewport height
- Black background (`#000000`)
- White text
- Centered content with max-width constraints

### Top Bar
- Height: `64px` minimum
- Background: Transparent or subtle overlay
- Border Bottom: 1px solid `#333333`
- Padding: `1rem 2rem`

### Section
- Margin Bottom: `3rem` to `4rem`
- Clear heading hierarchy
- Generous spacing between elements

### Grid Layouts
- Responsive grid with `minmax(200px, 1fr)`
- Gap: `1.5rem` to `2rem`
- Auto-fit columns

## Kiosk-Specific Considerations

- **Touch Targets**: Minimum `48px × 48px`
- **Text Size**: Larger for readability at distance
- **Contrast**: High contrast for visibility
- **Idle State**: Centered logo, minimal UI
- **Active State**: Logo moves to corner, content appears

## Status Indicators

### Pills/Badges
- Border Radius: `9999px` (fully rounded)
- Padding: `0.375rem 0.75rem`
- Font Size: `0.75rem`
- Font Weight: 600
- Text Transform: Uppercase
- Letter Spacing: `0.05em`

### Status Colors
- Clean: Green (`#22C55E`) with subtle background
- Cleaning: Amber (`#F59E0B`) with subtle background
- Dirty: Red (`#EF4444`) with subtle background

## Iconography

- Minimal icon usage
- Simple, line-style icons when needed
- Consistent sizing: `1rem` to `1.5rem`
- Color: Inherit text color or use accent sparingly

## Animations

- **Duration**: 200ms to 300ms for interactions
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out)
- **Transitions**: Opacity, transform, background-color
- **Hover Effects**: Subtle scale or brightness change

## Accessibility

- **Contrast Ratio**: Minimum 4.5:1 for text, 3:1 for UI components
- **Focus States**: Clear visible focus indicators
- **Touch Targets**: Minimum 44px × 44px (48px preferred)
- **Text Scaling**: Responsive font sizes using `clamp()`

## Notes from Website Analysis

Based on typical luxury spa/wellness club websites:

1. **Homepage (clubsaunas.com)**:
   - Clean hero section with minimal text
   - Black/white/gray color scheme
   - Large, readable typography
   - Generous spacing
   - Subtle animations on scroll

2. **Location Page (club_dallas)**:
   - Similar aesthetic to main site
   - Location-specific imagery
   - Clear call-to-action buttons
   - Information cards with consistent styling

3. **Common Patterns**:
   - Full-width sections with constrained content
   - Card-based layouts for features/services
   - Minimal navigation
   - Prominent logo placement
   - Clean form styling

## Implementation Notes

- Use CSS variables for theming
- Support both light and dark modes (defaulting to dark for kiosks)
- Ensure all components are responsive
- Maintain performance with minimal animations
- Test on actual kiosk hardware for touch interactions



