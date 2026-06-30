# Minecraft Tierlist Bot

A fully-featured Minecraft PvP tierlist Discord bot inspired by PvPTiers/MCTiers.

## Stack
- **Runtime**: Node.js + TypeScript (`ts-node` for dev)
- **Discord**: discord.js v14
- **Database**: PostgreSQL via Drizzle ORM
- **Hosting**: Railway (auto-deploys from GitHub `main` branch)

## GitHub Repository
`https://github.com/DyingEcho001/matrix-tierlist-bot-2`

After every code change, push to `main` so Railway redeploys automatically.

## Project Structure
- `src/` — all source code
- `src/index.ts` — bot entry point
- `src/deploy-commands.ts` — slash command registration
- `drizzle.config.ts` — database config

## Environment Variables Required
- `DISCORD_TOKEN` — Discord bot token
- `DISCORD_CLIENT_ID` — Application/client ID
- `DISCORD_GUILD_ID` — Guild (server) ID
- `DATABASE_URL` — PostgreSQL connection string

## Scripts
- `npm run dev` — run with ts-node (development)
- `npm run build && npm run start` — compile and run (production)
- `npm run deploy` — register slash commands with Discord
- `npm run db:push` — push schema to database

## User Preferences
- After every code change: commit and push to GitHub (`main`) so Railway auto-deploys.
