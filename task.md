# Jeepi Service Update

- [x] Stop current server <!-- id: 0 -->
- [x] Modify `server.js` to remove Home Hub <!-- id: 1 -->
- [x] Restart services <!-- id: 2 -->
- [x] Verify only Passenger, Driver, and Admin apps are running <!-- id: 3 -->

# New Features
- [x] implementation_plan.md update for Theming and i18n <!-- id: 4 -->
- [x] **Theming**: Implement Dark/Light/System modes <!-- id: 5 -->
- [x] **i18n**: Implement translation system (Tagalog default) <!-- id: 6 -->
- [x] **UI**: Add persistent Flag Icon/Language Selector to Nav <!-- id: 11 -->
- [x] **Branding**: Rename "Jeepi" to "jeepi" (lowercase) <!-- id: 12 -->
- [x] **UI**: Improve Driver App Layout (Details at bottom, smaller stats) <!-- id: 13 -->
- [x] **UI**: Optimize Passenger App Payment Card (Compact & Top) <!-- id: 14 -->
- [x] **UI**: Navbar Settings Icon (Replace Flag/Label) <!-- id: 15 -->
- [x] **UI**: Move Payment Buttons to Seat Map Header <!-- id: 16 -->
- [x] **UI**: Compact Passenger Header (Remove Text, Single Line Greeting) <!-- id: 17 -->
- [x] **UI**: Move Logout Button to Settings (Passenger) <!-- id: 18 -->
- [x] **UI**: Match Payment Button Height to Seats (52px) <!-- id: 19 -->
- [x] **UI**: Simplify Payment Modal Title (Remove Seat Numbers) <!-- id: 20 -->
- [x] **BugFix**: Fix "User not found" error (Guest Auth & Server Restart) <!-- id: 21 -->
- [x] **UI**: Move Driver Payment Requests to Seat Map Header <!-- id: 22 -->
- [x] **UI**: Remove Redundant "Pending" Banner (Driver) <!-- id: 23 -->
- [x] **UI**: Hide Payment Buttons After Request (Passenger) <!-- id: 24 -->
- [x] **UI**: Implement Seat Icons (Facing Chairs) <!-- id: 25 -->

# Phase 3: Scalable Persistence
- [x] implementation_plan.md update for Persistence <!-- id: 7 -->
- [x] **Schema Design**: Define Prisma schema for Users, Drivers, Trips <!-- id: 8 -->
- [x] **Integration**: Replace in-memory DB with Database Client <!-- id: 9 -->
- [x] **Migration**: Move User Settings (Theme/Lang) to DB <!-- id: 10 -->

# Phase 4: Friends System & Group Payments
- [x] **Database**: Add FriendRequest model to Prisma schema <!-- id: 26 -->
- [x] **Backend**: Implement 6 friend management API endpoints <!-- id: 27 -->
- [x] **Services**: Add 7 friend methods to JeepneyService <!-- id: 28 -->
- [x] **Frontend**: Add friends state management to PassengerPage <!-- id: 29 -->
- [x] **Frontend**: Implement loadFriends() on app initialization <!-- id: 30 -->
- [x] **Frontend**: Implement friend detection in trips (updateFriendsOnTrip) <!-- id: 31 -->
- [x] **UI**: Add Friends button to riding state header with badge <!-- id: 32 -->
- [x] **UI**: Add conditional "Pay for Friends" button <!-- id: 33 -->
- [x] **UI**: Implement friend management modals (8 methods) <!-- id: 34 -->
- [x] **Testing**: Verify end-to-end friend payment flow <!-- id: 35 -->

# Admin Page Refactor
- [x] **Architecture**: Split monolithic admin page into multi-page structure <!-- id: 36 -->
- [x] **UI**: Create admin dashboard landing page with navigation cards <!-- id: 37 -->
- [x] **UI**: Create dedicated Drivers management page <!-- id: 38 -->
- [x] **UI**: Create dedicated Jeepneys management page <!-- id: 39 -->
- [x] **UI**: Create dedicated Settings management page <!-- id: 40 -->
- [x] **UI**: Create dedicated Transactions history page <!-- id: 41 -->
- [x] **Navigation**: Add consistent navigation across all admin pages <!-- id: 42 -->

# Phase 3: Notifications (In-App Notification Center)
- [x] **3A: Model + Service**: Add Notification model to Prisma, create NotificationService (notify → DB + Socket.io + optional FCM) <!-- id: 43 -->
- [x] **3B: REST API**: GET list (paginated), GET count, PATCH read, PATCH read-all, DELETE dismiss <!-- id: 44 -->
- [x] **3C: Socket.io**: Emit notification_count on connection join <!-- id: 45 -->
- [x] **3D: Triggers**: 8 triggers across friends, wallet, seats, reservation-matcher <!-- id: 46 -->
- [x] **3E: Frontend**: Bell icon + inbox panel in passenger.html, notification-client.js <!-- id: 47 -->
- [x] **3F: Docs**: Phase renumbering (old 7→3) + all docs updated <!-- id: 48 -->

# Phase 4: Dagdag Bayad / Libre Ka-Jeepi
- [x] **4A: Schema + PaymentService Core**: groupId, sponsorId on Seat, addCompanionSeats, sponsorSeat, cancelSponsorship (15 unit tests) <!-- id: 49 -->
- [x] **4B: Dagdag Bayad API + Para Cascade**: POST /seat/dagdag, para cascade to groupId seats (8 integration tests) <!-- id: 50 -->
- [x] **4C: Libre Ka-Jeepi API**: POST /seat/libre, /libre/cancel, GET /friends-on-trip (9 integration tests) <!-- id: 51 -->
- [x] **4D: Driver UI**: formatPassengerLabel ("Name + N", "Libre" badge) <!-- id: 52 -->
- [x] **4E: Passenger UI — Dagdag**: "Add Companions" button, count stepper modal, companion status display <!-- id: 53 -->
- [x] **4F: Passenger UI — Libre**: "Treat a Friend" button, friend picker modal, libre status display <!-- id: 54 -->
- [x] **4G: Docs + Cleanup**: All docs updated, local Docker PG for tests (37x speedup) <!-- id: 55 -->
