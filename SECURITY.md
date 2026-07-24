# Security and privacy

Live Game Animator is designed to run locally. OBS passwords, RTMP stream keys,
YouTube API keys and webhook access tokens are held only in the running process
and must never be committed to the repository.

## Files that must remain local

- `.env` and `.env.*` (except `.env.example`)
- `.live-game-animator/` runtime analytics, sessions, players and logs
- `.agents/`, `.codex/` and `.openai/` local development traces
- `stream-keys.*` and `obs-profile/`

These paths are covered by `.gitignore`. Before publishing a fork, also inspect
screenshots and exported reports because they may contain live-chat usernames or
video identifiers.

## Resetting local data

Stop Live Game Animator, then delete the `.live-game-animator` directory in the
project root. The application creates a fresh local store on its next start.

## Reporting a vulnerability

Use GitHub's private security advisory feature for the repository. Do not include
real API keys, stream keys, passwords or viewer data in a public issue.
