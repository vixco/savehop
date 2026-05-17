#!/bin/bash
# Install / refresh the Savehop relay watchdog on this LXC.
# Idempotent: safe to run repeatedly. Use after a `git pull` in /opt/savehop.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

install -m 755 "$SCRIPT_DIR/watchdog.sh" /usr/local/bin/savehop-watchdog
install -m 644 "$SCRIPT_DIR/savehop-watchdog.service" /etc/systemd/system/savehop-watchdog.service

systemctl daemon-reload
systemctl enable savehop-watchdog
systemctl restart savehop-watchdog

sleep 1
systemctl --no-pager -n 8 status savehop-watchdog || true

echo
echo "Watchdog installed. Tail with:  journalctl -u savehop-watchdog -f"
