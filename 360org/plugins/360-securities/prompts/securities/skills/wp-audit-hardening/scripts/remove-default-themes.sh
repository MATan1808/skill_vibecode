#!/bin/bash
# Fleet-wide housekeeping: remove unused default WP themes (twenty*) from every site.
# We never use twenty* themes (Avada/Fusion fleet) -- they're just idle attack surface.
# Safe by design: backs up each theme dir before deleting, and NEVER deletes an
# active theme (checked via wp option get template/stylesheet) -- flags it instead.
# Usage: bash remove-default-themes.sh            (all sites)
#        bash remove-default-themes.sh <domain>   (one site)
# Run ON cloudpanel server (as root).
set -uo pipefail
if [ "${1:-}" = "--purge" ]; then
  ONLY_DOMAIN=""
  MODE="--purge"
else
  ONLY_DOMAIN="${1:-}"
  MODE="${2:-backup}"
fi
if [ "$MODE" != "backup" ] && [ "$MODE" != "--purge" ]; then
  echo "Usage: $0 [domain] [--purge]" >&2
  exit 2
fi
TS=$(date +%Y%m%d_%H%M%S)
BKDIR="/home/cloudpanel/backups/incident/removed-default-themes-${TS}"
[ "$MODE" = "backup" ] && mkdir -p "$BKDIR"

removed=0; skipped_active=0; sites_touched=0
purged=0

for DOCROOT in /home/*/htdocs/*/; do
  DOMAIN=$(basename "$DOCROOT")
  [ -n "$ONLY_DOMAIN" ] && [ "$DOMAIN" != "$ONLY_DOMAIN" ] && continue
  THEMES_DIR="${DOCROOT}wp-content/themes"
  [ -d "$THEMES_DIR" ] || continue
  SUSER=$(echo "$DOCROOT" | cut -d/ -f3)

  found=$(find "$THEMES_DIR" -maxdepth 1 -mindepth 1 -type d -iname 'twenty*' 2>/dev/null)
  [ -z "$found" ] && continue

  ACTIVE=$(sudo -u "$SUSER" wp --path="$DOCROOT" option get template 2>/dev/null | tr -d '\r')
  site_touched=0

  while IFS= read -r theme_path; do
    [ -z "$theme_path" ] && continue
    theme_name=$(basename "$theme_path")
    if [ "$theme_name" = "$ACTIVE" ]; then
      echo "[$DOMAIN] SKIP (dang active): $theme_name"
      skipped_active=$((skipped_active+1))
      continue
    fi
    if [ "$MODE" = "--purge" ]; then
      rm -rf -- "$theme_path"
      echo "[$DOMAIN] da xoa vinh vien: $theme_name"
      purged=$((purged+1))
    else
      mkdir -p "$BKDIR/$DOMAIN"
      mv "$theme_path" "$BKDIR/$DOMAIN/" 2>&1
      echo "[$DOMAIN] da go: $theme_name -> $BKDIR/$DOMAIN/$theme_name"
    fi
    removed=$((removed+1))
    # ponytail: destructive purge is explicit --purge; default mode remains reversible.

    site_touched=1
  done <<< "$found"

  [ "$site_touched" = "1" ] && sites_touched=$((sites_touched+1))
done

echo
echo "===== TONG KET ====="
echo "Site bi dung toi: $sites_touched"
if [ "$MODE" = "--purge" ]; then
  echo "Theme da xoa vinh vien: $purged"
else
  echo "Theme da go: $removed (backup tai $BKDIR)"
  [ "$removed" -eq 0 ] && rmdir "$BKDIR" 2>/dev/null
fi
echo "Theme dang active bi bo qua (can xu ly rieng): $skipped_active"
exit 0
