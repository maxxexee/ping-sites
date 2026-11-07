# ping-sites

A single file uptime pinger. Give it a list of URLs and it requests each one on an interval,
logging the status code. Built to keep free tier services from spinning down after their idle
timeout.

No dependencies, no build step, one environment variable that matters.

## Why this exists

Free tiers sleep. Render stops a free web service after 15 minutes without inbound traffic, so
the first visitor after a quiet spell waits through a cold start. A request every few minutes
keeps the service in its running state.

## Run

```bash
LIST_OF_URLS="https://a.onrender.com,https://b.example.com" node index.js
```

| Variable | Default | Notes |
| --- | --- | --- |
| `LIST_OF_URLS` | empty | Comma separated, trimmed, blank entries dropped |
| `INTERVAL_SECONDS` | `240` | Minimum 30. Unparseable values fall back to 240 instead of looping |
| `PORT` | `0` | When set, also serves `200 pinger` on that port, which is what a platform health check needs |

The process does not exit on a failed target. This is a keep warm tool, not a monitor with
alerting: it logs what happened and moves to the next round.

## Output

```
[pinger] targets: https://example.com
[pinger] interval: 240s
[pinger] OK 200 https://example.com
[pinger] BAD 503 https://example.com
[pinger] FAIL invalid url not-a-url
[pinger] FAIL getaddrinfo ENOTFOUND no-such-host.invalid https://no-such-host.invalid
```

`OK` means a 2xx or 3xx arrived, which is enough to reset an idle timer. `BAD` means the service
answered with an error status, so it is awake but broken. `FAIL` means no usable response: bad
URL, DNS failure, refused connection, or a 15 second timeout.

## Deploy on Render

`render.yaml` defines one web service. Render injects `PORT`, so the process starts its small
HTTP listener and passes the health check:

```yaml
services:
  - type: web
    name: pinger
    env: node
    buildCommand: npm install
    startCommand: node index.js
```

Set `LIST_OF_URLS` in the dashboard after the first deploy, or edit `render.yaml` before it.

## Cost

Keeping a free instance awake spends your monthly free hours rather than saving them. One
always on service uses close to the 750 hours a free account gets. Ping what you actually need
warm, not everything you own.

## Limits

- Status codes only. The body is never read, so a page returning 200 with a broken render
  counts as OK.
- One process, in memory. Nothing is persisted between restarts.
- A round that overruns the interval is skipped rather than queued, so a slow target cannot
  stack up concurrent requests.
- No alerting. If you need paging, use a real monitor.

## License

MIT
