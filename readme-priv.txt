 PROJECT HANDOVER & TECHNICAL SPECIFICATION README
Confidential & Proprietary

Document Version: 1.0.0

Signed over: To David Harding - Lee Harding

Platform: The Cash King Draws

1. Executive Summary & Deliverables Overview
This README serves as the master technical and compliance deliverable document for The cash King. Designed to accompany the full source code handover, this guide outlines our cryptographic architecture, compliance frameworks, verification workflows, deployment procedures, and data ingestion protocols to satisfy legal counsel, payment gateway underwriters, and regulatory compliance standards.

2. Full Source Code & Intellectual Property Transfer
Repository Access: The complete, production-ready codebase is provisioned via the designated private GitHub repository, inclusive of all frontend layouts, backend draw modules, database migration scripts, and administrative control panels.

Hosting Environment: Configured for seamless deployment on modern cloud infrastructure (Vercel / Supabase backend architecture).

IP Assignment & Ownership: Upon delivery of this README and final repository access, all intellectual property rights, source code ownership, and custom compliance algorithms developed form Eddie are fully assigned to the client.

3. RNG Technical Specification Document
To ensure absolute cryptographic integrity and non-repudiation, the The cash King draw engine avoids basic pseudo-random functions in favor of a provably fair, cryptographically secure architecture.

A. Seed Generation & Cryptographic Commitment
Server Seed: Generated using Node.js built-in crypto.randomBytes(32), producing a 256-bit cryptographically secure pseudorandom number generator (CSPRNG) byte string.

Pre-Commitment Hash: Prior to initiating any draw, the raw server seed is hashed using SHA-256 (server_seed_hash). This hash is published publicly or locked into the database before entries close, ensuring operators cannot alter the seed post-entry.

B. Entry Snapshot & Hashing
Snapshot State: At the exact closing timestamp of a competition, all eligible entries are compiled into a sequential array (sorted deterministically by entry/ticket ID or timestamp).

Entry Hash: A Merkle root or aggregated SHA-256 fingerprint (entry_hash) is generated from the complete participant dataset, locking the entry pool against post-draw tampering.

C. Index Mapping & Zero Modulo Bias
To select winning tickets without introducing statistical bias (avoiding modulo bias common in standard integer division):

The system combines the Server Seed and Entry Hash using HMAC-SHA256 to derive a deterministic hex digest.

The digest is converted into a high-precision floating-point number between 0 and 1, or parsed via strict rejection sampling.

Rejection Sampling Execution: Any raw random value exceeding the highest valid range threshold is discarded, ensuring every single ticket in the pool has an mathematically identical probability of selection.

D. Audit Logging
Every executed draw automatically commits an immutable record to the draws_audit PostgreSQL table, capturing:

draw_id (UUID)

Competition Title & Timestamps

Total Max Tickets & Sold Tickets Count

server_seed (revealed post-draw for verification)

proof_hash (combined cryptographic proof)

winner_tickets (JSON array containing winning participant details and assigned ticket numbers)

E. Login Details upon Database
When the cash king use the platform they are assigned log in details to access "draw area" (changeable via Eddie and The Cash King once in ownership) 
I have taken the decice to stop all new accounts being made to stop abuse, However if you want a new account for new employees just send Eddie a message for support or to do it
this prevents db slowing down and abuse to crash the site - strictly for The Cash King purpose

4. Public Verification Guide & Tool
A. Plain-English 'How to Verify Your Draw' Guide
(Recommended text for placement on your public Terms & Conditions / Provably Fair page)

How The cash kings Guarantees 100% Fairness
At The cash kings, every competition draw is provably fair. You don't just have to trust our word—you can mathematically verify the results yourself. Here is how our cryptographic system works:

Before the Draw: We lock in the exact list of all competing ticket numbers and generate a secure cryptographic fingerprint (Entry Hash). We also generate a secret Server Seed, and publish its SHA-256 hash publicly. Because the hash cannot be reversed, we cannot change the seed later.

During the Draw: Our system uses a cryptographically secure random number generator (CSPRNG) combined with our seed and entry data to select the winning ticket index without bias.

After the Draw: We reveal the unencrypted Server Seed. You can take this seed, the public Entry Hash, and our open-source verification tool to independently re-run the exact same mathematical formula and confirm that your ticket or the winning ticket was chosen fairly.

B. Front-End Verification Tool
The platform includes an embedded verification page (/verify) where users can input:

The revealed Server Seed

The Competition Entry Hash

The Total Ticket Pool Size

The tool instantly re-computes the selection algorithm client-side, giving participants cryptographic proof of the draw's legitimacy.

5. System Deployment & Maintenance Guide
A. Infrastructure Stack
Frontend / Edge: Next.js / React deployed via Vercel.

Database & Auth: Supabase (PostgreSQL with Row Level Security enabled).

B. Deployment & Configuration Steps
Environment Variables: Ensure the following environment variables are securely provisioned in your hosting dashboard:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY (restricted to server-side execution)

Database Migration: Execute the base schema migration script provided in /supabase/migrations/ to initialize tables (competitions, tickets, draws_audit).

C. Error Recovery & Fail-Safe Protocols
Database Transaction Rollbacks: Draw execution routines are wrapped in atomic database transactions (BEGIN / COMMIT / ROLLBACK). If a server exception occurs mid-draw, state changes are instantly reverted to prevent partial or corrupted winner assignments.

Log Persistence: In the rare event of a runtime crash during a live stream draw, the raw entropy inputs and state logs are persisted in local server memory buffers, allowing administrators to safely re-verify and replay the exact draw state from the audit trail.

6. API Scraper & Exception Protocol
This is for meta, and will be added soon - need to speak to Lee or David on best route