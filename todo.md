# Project TODO

## Core Features (Completed)
- [x] Admin login (role-gated) that unlocks exclusive access to the draw area.
- [x] CSV upload supporting up to 5,000,000 entries, using chunked/streamed parsing.
- [x] Cryptographic draw engine powered by CSPRNG, rejection sampling, and SHA-256 proof hash generation.
- [x] Public hash verification frontend with "Learn More" modal explaining SHA-256 and CSPRNG.
- [x] Supabase schema definition for `draws_audit` table (draw_id, competition_title, entry_count, winner_tickets, proof_hash, timestamp).
- [x] Full site redesign matching King of Comps logo aesthetic (dark regal theme, gold accents, crown iconography, bold typography).
- [x] Ensure all three draw modes (Classic Draw, Spin Wheel, Horse Race) are fully functional and accessible after admin login.
- [x] Security sidebar displaying compliance badges.
- [x] Winner count picker and proof hash generation on winner reveal.
- [x] Home page with feature showcase and navigation.
- [x] Verify Hash page with public verification and Learn More modal.
- [x] Confetti/particle celebration effects on winner reveal.

## Authentication (Completed)
- [x] Supabase Authentication with email/password login
- [x] Supabase Auth Context for managing login/logout
- [x] Admins table in Supabase for role-based access
- [x] Home.tsx with email/password login form
- [x] DrawArea.tsx checks Supabase admin status
- [x] App.tsx uses SupabaseAuthProvider
- [x] SUPABASE_AUTH_SETUP.md guide

## Windows Optimization (Completed)
- [x] Remove unused dependencies and resolve conflicts
- [x] Update package.json for Windows compatibility with cross-env
- [x] Create Windows batch files (dev.bat, build.bat)
- [x] Clean up unused files and documentation
- [x] Fix all TypeScript errors
- [x] Create WINDOWS_SETUP.md and ENV_SETUP.md guides

## Optional Enhancements
- [ ] Add sign-up form for new user registration
- [ ] Add admin management UI to promote/demote users
- [ ] Add password reset functionality
- [ ] Enable multi-factor authentication (MFA)
- [ ] Supabase integration: connect to Supabase for persistent audit trail (see SUPABASE_SETUP.md).
- [ ] Draw history dashboard showing past draws
- [ ] Export features (CSV/PDF) for draw results
