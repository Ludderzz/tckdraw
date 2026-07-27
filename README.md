# The Cash Kings - Official Draw System

A gambling-grade, cryptographically verified draw system with three interactive reveal modes, built with Vite, React, and TypeScript.

## 🎯 Features

**Three Draw Modes:**
- **♛ Classic Draw** — Instant cryptographic selection with dramatic slot-machine reveal animation
- **◎ Spin Wheel** — Animated spinning wheel with smooth deceleration
- **🏇 Horse Race** — Live animated race with multiple competitors

**Cryptographic Security:**
- CSPRNG (Cryptographically Secure Random Number Generator) using Web Crypto API
- Rejection sampling to eliminate modulo bias — ensuring perfect fairness
- SHA-256 proof hash generation for every draw
- Client-side only processing — no data leaves your browser during draws

**Admin Features:**
- Role-based authentication (admin-only access to draw area)
- CSV upload supporting up to 5,000,000 entries with chunked parsing
- Configurable winner count picker
- Confetti celebration effects on winner reveal
- Proof hash generation and storage

**Public Verification:**
- Anyone can verify draw authenticity using the proof hash
- "Learn More" modal explaining SHA-256 and CSPRNG concepts
- Audit trail storage for permanent draw records

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- pnpm 10+

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at `http://localhost:3000`

### Admin Login

1. Click "Admin Login" on the home page
2. Log in with your admin account (admin role required)
3. Navigate to "Draw Area" to access all three draw modes

## 📋 How to Use

### Running a Draw

1. **Select a Draw Mode** — Choose Classic Draw, Spin Wheel, or Horse Race
2. **Upload CSV** — Upload a CSV file with two columns:
   - Column A: Ticket Numbers
   - Column B: Participant Names
   - First row: Competition Title
3. **Set Winner Count** — Choose how many winners to draw
4. **Execute Draw** — Click the draw button and watch the animation
5. **View Results** — Winners are displayed with the proof hash

### Verifying a Draw

1. Go to "Verify a Draw" on the home page
2. Paste the proof hash from any draw
3. Click "Verify Hash" to check authenticity
4. Click "Learn More" to understand how verification works

## 🔐 Security & Compliance

**Gambling-Grade Compliance:**
- ✅ CSPRNG Randomness — Cryptographically secure random values
- ✅ Zero Modulo Bias — Rejection sampling ensures fairness
- ✅ SHA-256 Entry Hash — Verifiable fingerprint of all entries
- ✅ Proof Hash — Every draw generates permanent proof
- ✅ Timestamp Lock — Immutable record of when draw occurred
- ✅ Client-Side Only — No data transmission during draws

## 📊 CSV Format

Your CSV file should follow this format:

```
Competition Name,
Ticket001,John Doe
Ticket002,Jane Smith
Ticket003,Bob Johnson
...
```

**Requirements:**
- First row: Competition title (any text in column A)
- Subsequent rows: Ticket number (column A) and participant name (column B)
- Maximum 5,000,000 entries
- Supported formats: CSV, XLSX, XLS

## 🔗 Supabase Integration

To connect your draws to Supabase for persistent audit trail storage and public verification:

1. **Read the Setup Guide** — See `SUPABASE_SETUP.md` for detailed instructions
2. **Create Supabase Project** — Set up a new project at supabase.com
3. **Create Table** — Run the provided SQL to create the `draws_audit` table
4. **Update Environment** — Add your Supabase credentials to `.env`
5. **Enable Integration** — Modify the draw components to save to Supabase

The setup guide includes code examples for both hybrid (local + Supabase) and Supabase-only approaches.

## 🛠️ Development

### Project Structure

```
client/src/
  ├── pages/
  │   ├── Home.tsx              # Landing page
  │   ├── DrawArea.tsx          # Admin draw interface
  │   └── VerifyHash.tsx        # Public verification
  ├── components/
  │   ├── draw/
  │   │   ├── ClassicDraw.tsx   # Classic draw mode
  │   │   ├── SpinWheel.tsx     # Spin wheel mode
  │   │   └── HorseRace.tsx     # Horse race mode
  │   └── Confetti.tsx          # Celebration effects
  └── utils/
      ├── csvParser.ts          # Chunked CSV parsing
      └── crypto.ts             # Cryptographic utilities

server/
  ├── routers.ts                # tRPC procedures
  └── db.ts                     # Database queries

drizzle/
  └── schema.ts                 # Database schema
```

### Key Technologies

- **Frontend:** React 19, Tailwind CSS 4, TypeScript
- **Backend:** Express, tRPC, Drizzle ORM
- **Database:** MySQL/TiDB (local), Supabase (optional)
- **Cryptography:** Web Crypto API (CSPRNG, SHA-256)
- **Build:** Vite 7

### Adding Features

1. **Update Database Schema** — Edit `drizzle/schema.ts`
2. **Generate Migration** — Run `pnpm drizzle-kit generate`
3. **Apply Migration** — Run the SQL migration via your database client or Supabase dashboard
4. **Add Procedures** — Create tRPC procedures in `server/routers.ts`
5. **Build UI** — Create React components in `client/src/pages/` or `client/src/components/`
6. **Test** — Write tests in `server/*.test.ts` and run `pnpm test`

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

## 📦 Build & Deploy

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

The app is ready for deployment to any Node.js hosting platform.

## 🎓 Understanding the Cryptography

### CSPRNG (Cryptographically Secure Random Number Generator)

The app uses `window.crypto.getRandomValues()` to generate truly random numbers, not predictable pseudo-random values. This ensures every participant has an equal chance of winning.

### Rejection Sampling

To eliminate modulo bias, the system uses rejection sampling:
1. Generate a random number
2. If it's outside the valid range, discard and try again
3. This ensures perfect fairness — no entry has a higher probability than any other

### SHA-256 Proof Hash

Every draw generates a SHA-256 hash that combines:
- Competition title
- Timestamp
- Total entry count
- Winner list

This creates a permanent, verifiable fingerprint of the draw that cannot be altered after the fact.

## 📝 License

MIT

## 🤝 Support

For issues or questions:
1. Check the `SUPABASE_SETUP.md` for integration help
2. Review the "Learn More" modal in the app for cryptography explanations
3. Check the project README for setup instructions

## 🔄 Version History

**v1.0.0** — Initial release
- Three draw modes (Classic, Spin Wheel, Horse Race)
- CSV upload with chunked parsing
- Cryptographic randomness and verification
- Admin authentication
- Confetti celebration effects
- Supabase integration guide

---


