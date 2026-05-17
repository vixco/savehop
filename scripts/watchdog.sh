#!/bin/sh
# Savehop relay watchdog.
#
# Runs as a systemd service on the LXC. Polls both the LOCAL health endpoint
# (catches container hangs the Docker HEALTHCHECK + autoheal somehow missed)
# and the PUBLIC URL through the Cloudflare tunnel (catches tunnel failures
# the cloudflared service didn't recover from on its own).
#
# Tunable via env, with sensible defaults for the standard deploy:
#   LOCAL_URL=http://127.0.0.1:8787/health
#   PUBLIC_URL=https://relay.savehop.tovix.nl/health
#   INTERVAL=30                # seconds between checks
#   FAILS_BEFORE_ACTION=3      # consecutive misses required to trigger
#   COMPOSE_DIR=/opt/savehop   # where docker-compose.yml lives

set -u

LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:8787/health}"
PUBLIC_URL="${PUBLIC_URL:-https://savehoprelay.tovix.nl/health}"
INTERVAL="${INTERVAL:-30}"
FAILS_BEFORE_ACTION="${FAILS_BEFORE_ACTION:-3}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/savehop}"

log() { echo "$(date -Is) $*"; }

local_fails=0
public_fails=0

log "watchdog start: local=$LOCAL_URL public=$PUBLIC_URL interval=${INTERVAL}s threshold=$FAILS_BEFORE_ACTION"

while true; do
  # ── Local probe ─────────────────────────────────────────────────────
  if curl -fsS --max-time 5 "$LOCAL_URL" >/dev/null 2>&1; then
    if [ "$local_fails" -ne 0 ]; then
      log "local OK again after $local_fails miss(es)"
    fi
    local_fails=0
  else
    local_fails=$((local_fails + 1))
    log "LOCAL MISS ($local_fails/$FAILS_BEFORE_ACTION) $LOCAL_URL"
    if [ "$local_fails" -ge "$FAILS_BEFORE_ACTION" ]; then
      log "LOCAL THRESHOLD HIT — restarting savehop container"
      if docker compose -f "$COMPOSE_DIR/docker-compose.yml" restart savehop; then
        log "savehop restarted"
      else
        log "ERROR: docker compose restart failed; falling back to docker restart"
        docker restart savehop || log "docker restart savehop also failed"
      fi
      local_fails=0
      sleep 5
    fi
  fi

  # ── Public probe via the Cloudflare tunnel ─────────────────────────
  if curl -fsS --max-time 8 "$PUBLIC_URL" >/dev/null 2>&1; then
    if [ "$public_fails" -ne 0 ]; then
      log "public OK again after $public_fails miss(es)"
    fi
    public_fails=0
  else
    public_fails=$((public_fails + 1))
    log "PUBLIC MISS ($public_fails/$FAILS_BEFORE_ACTION) $PUBLIC_URL"
    if [ "$public_fails" -ge "$FAILS_BEFORE_ACTION" ]; then
      # Only bounce cloudflared if LOCAL is actually healthy — otherwise
      # we'd be bouncing the tunnel while the real problem is the container,
      # and the local-probe branch above already handles that.
      if curl -fsS --max-time 5 "$LOCAL_URL" >/dev/null 2>&1; then
        log "PUBLIC THRESHOLD HIT, local is healthy — restarting cloudflared"
        if systemctl restart cloudflared; then
          log "cloudflared restarted"
        else
          log "ERROR: systemctl restart cloudflared failed"
        fi
      else
        log "PUBLIC THRESHOLD HIT but local is also down — letting local branch handle"
      fi
      public_fails=0
      sleep 5
    fi
  fi

  sleep "$INTERVAL"
done
