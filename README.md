# DinkPlugin Webhook Filter

A simple proxy service that filters Discord webhook messages from [DinkPlugin](https://github.com/pajlads/DinkPlugin) based on player allowlists and denylists.

## What It Does

This service sits between DinkPlugin and Discord, letting you control which players' messages get posted to your Discord channel. You can:

- **Allowlist mode**: Only players with specific dink account hashes or player names are forwarded (recommended; more secure)
- **Denylist mode**: All players except those with specific names or account hashes are forwarded (simpler; easier to bypass)

## Setup Guide

### Creating Your Webhook Filter

1. Visit your [deployed worker URL](https://dink.pajlada.se)
2. Click "Create New Webhook Filter"
3. Copy the webhook URL shown (it includes a secret code)
4. Enter your Discord channel's webhook URL
5. Choose your filter mode (allowlist or denylist)
6. Add player identifiers (one per line)
7. Save the configuration

### Configuration Options

| Field | Description |
|-------|-------------|
| **Discord Webhook URL** | The webhook URL from your Discord channel settings |
| **Filter Mode** | `allow` — only listed players are forwarded.<br>`deny` — all players except listed ones are forwarded |
| **Identifiers** | One identifier per line. You can include both dink account hashes (from `::DinkHash`) and player names in the same list. Matching is case-insensitive. Maximum: 1024 players. |

### Connect DinkPlugin

In your DinkPlugin configuration, set the webhook URL to:

```
https://dink.pajlada.se/webhook/GENERATED_SECRET_HASH
```

That's it; DinkPlugin will now send messages through your filter automatically.

## How Filtering Works

When DinkPlugin sends a message, the service checks it against your list:

- **Allow mode**: The message is forwarded if the player's dink account hash **or** player name appears in your list
- **Deny mode**: The message is forwarded only if **neither** the player's dink account hash **nor** the player name appears in your list

Messages that don't pass the filter are silently dropped.

**Note**: Your identifier list can contain a mix of dink account hashes and player names simultaneously.
The most secure option is to solely use an allowlist of account hashes.

## Troubleshooting

**Webhook not working**

- Verify your Discord webhook URL is correct
- Make sure DinkPlugin is using the full webhook URL (including the secret hash; but not the secret key)


**Filtering doesn't seem to work**

- For allow mode: confirm the player's dink account hash or name is listed
- For deny mode: confirm the player's dink account hash and name is not listed


**Lost your secret?**

Navigate to `/new` to create a fresh configuration (if you can't find the old secret in your browser history) and update your DinkPlugin settings.

## Self Hosting

Instead of relying upon [our instance](https://dink.pajlada.se/), you can create your own Cloudflare Worker using this repo.

#### Disabling New Webhook Creation

The admin can disable the creation of new webhook configurations by setting the
`DISABLE_NEW_CONFIGS` environment variable in `wrangler.toml` to `true`:

```toml
[vars]
DISABLE_NEW_CONFIGS = true
```

When enabled, requests to `/new` are rejected with `403 Forbidden`. Existing
configurations and their webhooks continue to function normally. This is useful
for "freezing" a deployment once the desired filters have been created.
