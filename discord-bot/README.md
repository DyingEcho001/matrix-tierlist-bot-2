# Minecraft Tierlist Bot

A fully-featured Minecraft PvP tierlist Discord bot inspired by PvPTiers/MCTiers.

## Features

- Registration system with IGN, region, and preferred server
- 11 gamemodes: Nethpot, Potion, Mace, Axe & Shield, SMP, Diamond SMP, Cart PvP, Creeper, Sword, UHC, Vanilla
- Queue system per gamemode and region
- Testing ticket workflow with private channels
- HT3+ evaluation system
- Tier management with cooldowns
- Restriction system (Test Cheater / Hacking Subhuman)
- Staff hierarchy with role-based permissions
- Player data profiles
- Audit logging for all commands
- Temporary and permanent role assignment
- Ticket transcripts
- Profile migration

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your values
```

### 3. Set up the database
```bash
npm run db:push
```

### 4. Deploy slash commands to Discord
```bash
npm run deploy
```

### 5. Start the bot
```bash
npm run start
# or for development:
npm run dev
```

## Staff Hierarchy (lowest → highest)

1. Helper
2. Discord Moderator
3. Senior Moderator
4. Regulator
5. Tierlist Administrator
6. Tierlist Overseer
7. Manager

## Tier System

`LT5` → `LT4` → `LT3` → `HT3` → `HT2` → `HT1`

## Key Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/register` | Register/update your profile | Everyone |
| `/start` | Open a testing queue | Voluntary Tester + Gamemode Tester |
| `/pull` | Pull a testee from queue | Active tester |
| `/close` | Give tier and close ticket | Active tester |
| `/eval` | Trigger HT3 evaluation | Active tester |
| `/rank` | Manually give a tier | Regulator |
| `/player-data` | View player profile | Helper+ |
| `/restrict` | Restrict a player | Regulator+ |
| `/unrestrict` | Remove restriction | Regulator+ |
| `/add` | Add user to ticket | Helper+ |
| `/migrate-profile` | Migrate player data | Manager |
| `/temprole` | Temporary role | Senior Moderator+ |
| `/role` | Permanent role | Regulator+ |
| `/staff-role` | Assign staff roles | Manager |
| `/tier-role-assign` | Set tier roles | Manager |
| `/waitlist-panel-send` | Send registration panel | Manager |
| `/waitlist-post` | Post queue embed | Manager |
| `/set-channel` | Configure channels | Manager |
| `/join-tester-pool` | Join active queue | Voluntary Tester |

## Gamemodes

- `nethpot` — Nethpot
- `potion` — Potion
- `mace` — Mace
- `axe_shield` — Axe & Shield
- `smp` — SMP
- `diamond_smp` — Diamond SMP
- `cart_pvp` — Cart PvP
- `creeper` — Creeper
- `sword` — Sword
- `uhc` — UHC
- `vanilla` — Vanilla
