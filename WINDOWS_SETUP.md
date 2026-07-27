# Windows Setup Guide - The Cash Kings

This project is now optimized for Windows development.

## Quick Start

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Development Server:**
   
   **Option A (Command Line):**
   ```bash
   npm run dev
   ```
   
   **Option B (Double-click):**
   - Double-click `dev.bat` in the project folder

3. **Open in Browser:**
   - Go to `http://localhost:5173`

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run check` | Type check (TypeScript) |
| `npm run format` | Format code with Prettier |
| `npm test` | Run tests |

## Windows Batch Files

For convenience, use these batch files by double-clicking:

- **dev.bat** — Start development server
- **build.bat** — Build for production

## Environment Setup

1. Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-key-here"
   ```

2. Get your credentials from [Supabase](https://supabase.com)
3. Follow `SUPABASE_AUTH_SETUP.md` for detailed setup

## Troubleshooting

### "npm is not recognized"
- Install Node.js from [nodejs.org](https://nodejs.org)
- Restart your terminal after installation

### Port 5173 already in use
- The dev server will automatically use the next available port
- Check the terminal output for the actual URL

### Dependencies won't install
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again

## Project Structure

```
kings-draw-rebuild/
├── client/              # React frontend
│   └── src/
│       ├── pages/       # Page components
│       ├── components/  # Reusable components
│       ├── contexts/    # React contexts (Auth, Theme)
│       └── utils/       # Utilities (crypto, CSV parsing)
├── server/              # Express backend
├── drizzle/             # Database schema (optional)
├── .env                 # Environment variables (create this)
├── dev.bat              # Development batch file
├── build.bat            # Build batch file
└── package.json         # Dependencies
```

## Next Steps

1. **Set up Supabase** — Follow `SUPABASE_AUTH_SETUP.md`
2. **Create Admin User** — Add yourself as an admin
3. **Test Login** — Try logging in with your credentials
4. **Run a Draw** — Test the draw system

## Support

- Supabase Issues? → See `SUPABASE_AUTH_SETUP.md`
- Draw System? → See `README.md`
- Verification? → See `SUPABASE_SETUP.md`
