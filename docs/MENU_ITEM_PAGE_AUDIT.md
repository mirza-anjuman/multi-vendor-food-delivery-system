# Menu Item Page UX & Technical Audit (Food Rush)

**Audited Route:** `/menu/6adc39be46fe935d61094ccf/6adc39bf46fe935d6109517e` ("Classic Beef Burger" at "The Burgers Point")  
**Audit Date:** 2026-10-25  
**Screenshots captured:**
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-360-guest-nocart.png`
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-360-guest-incart.png`
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-414-guest-nocart.png`
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-414-guest-incart.png`
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-768-guest-nocart.png`
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-768-guest-incart.png`
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-1280-guest-nocart.png`
- `/home/usign/.temp/mvfds/docs/ui-audit/menu-item-1280-guest-incart.png`

---

## 1. Visual Hierarchy & Primary Action Clarity
- **Primary CTA Friction:** The "Add to cart" CTA does not reflect existing cart state. When an item is already added to the cart, the button continues to say "Add to cart" with quantity 1. There is no indication that the item is currently in the cart, no stepper showing the cart quantity, no direct "Remove" action, and no "View Cart" shortcut.
- **Mobile Sticky Bar:** The current bottom bar on mobile (`<768px`) lacks `env(safe-area-inset-bottom)` padding, risking overlap with browser navigation controls or iOS home indicators. Furthermore, it only has a simple stepper + add button, without cart sync or variant breakdown.

## 2. Image Handling & Brand Fallbacks
- Uses `FoodImage`, which correctly resolves canonical dish WebP assets (such as `beef-burger.webp`).
- However, image display ratio and responsive framing can be significantly improved to provide a hero-grade experience with badging for popularity, spicy level, and dietary classifications.

## 3. Price, Variants & Add-ons UX
- Selecting variants updates unit price correctly in memory, but adding a different variant of the same item does not differentiate cart line items in the page UI.
- The user cannot view existing cart configurations for the item (e.g., "Regular" vs "Large" in cart).

## 4. Restaurant Context & Delivery Information
- **Delivery Fee Violation:** The sidebar previously showed "Free delivery" or a static `deliveryFee` field if present on the restaurant document. This violates the server-authoritative delivery distance standard: delivery fees MUST come from `POST /api/delivery/quote` based on the user's specific delivery coordinates.
- **Location Awareness:** When no user delivery address/location is known, the UI must never show fake fees or "Free". It must display a clear "Set your location to see delivery fee" prompt that triggers the `LocationPicker`.
- **Open / Closed Status:** The restaurant's operating hours and `isOpen` status were not explicitly surfaced to explain whether orders can currently be accepted.

## 5. Missing Core Functional Sections
- **Price Comparison (§3):** No mechanism exists to find and compare this dish against equivalent items from other active restaurants.
- **Complementary Pairings ("Goes well with") (§4):** Only a basic "More from this kitchen" section existed, without order co-occurrence ranking, category pairing rules, or cross-restaurant pairings.
- **Nutrition Information (§5):** No nutrition estimation block or vendor nutrition display exists.
- **Reviews Block:** Customer reviews and ratings were not integrated directly into the item detail screen.

## 6. Redesign Strategy
1. **Mobile-First Unified Action Area:**
   - Real-time cart state synchronization: if item is in cart, show "In your cart" badge, quantity stepper controlling the cart quantity directly, a "Remove" button, and a "View Cart" CTA.
   - For items with multiple variant lines in cart, list each configured variant line with its own stepper/remove buttons, and provide an "Add another variation" toggle.
2. **Delivery & Location Integration:**
   - Integrate a shared location and quote hook (`useDeliveryQuote` / `useCustomerLocation`).
   - If user location is available, quote real road distance (or "~" estimate) and delivery fee from `apiService.quoteDelivery`.
   - If location is unknown, display a "Set location to calculate delivery fee" button opening `LocationPicker`.
3. **Pluggable Functional Blocks:**
   - Embed the Price Comparison section (`/api/menu-items/:id/compare`).
   - Embed the "Goes well with" pairings section (`/api/menu-items/:id/pairings`).
   - Embed the AI Nutrition section (`/api/menu-items/:id/nutrition`).
   - Embed real customer reviews with rating breakdown.
