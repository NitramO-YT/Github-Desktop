#!/bin/bash
#
# Updates the Flatpak repository that packages-github-desktop.nitramo.fr
# serves under flatpak/, from the versions each channel holds: one branch per
# channel, stable, latest and beta, carrying the Flatpak of the version at the
# head of that channel.
#
# Unlike the APT and RPM trees, this repository is updated in place rather
# than rebuilt. Flatpak offers an update whenever the commit of a branch
# changes, so a branch whose version did not move keeps its commit, and a
# branch that moved receives a new commit on top of the previous ones. Those
# stay, KEEP per branch counting the newest, for a rollback with
# flatpak update --commit.
#
# Input: the repository as the bucket holds it, or a directory that does not
# exist yet on the first publication, and the staging directory: state.json,
# and in staging/flatpak/ the bundles of the versions at the head of each
# channel. A version released before this fork built a Flatpak has no bundle,
# and its channel keeps whatever its branch held.
#
# Output: the repository, signed, with its summary and static deltas, and in
# the output directory the files that point Flatpak at it: a .flatpakrepo to
# subscribe, and one .flatpakref per channel to install in a single step.
#
# Usage: build-flatpak-repo.sh <repo-dir> <staging-dir> <gpg-key-id> <output-dir>

set -euo pipefail

REPO="${1:?repository directory required}"
STAGING="${2:?staging directory required}"
GPG_KEY="${3:?gpg key id required}"
OUTPUT="${4:?output directory required}"

APP_ID="io.github.nitramo_yt.Github-Desktop"
ARCH="x86_64"
BASE_URL="https://packages-github-desktop.nitramo.fr"
REPO_URL="$BASE_URL/flatpak/repo/"
RUNTIME_REPO="https://dl.flathub.org/repo/flathub.flatpakrepo"
REMOTE_NAME="github-desktop-nitramo"
CHANNELS="stable latest beta"
KEEP="${KEEP:-3}"

log() { printf '\n== %s\n' "$1"; }

require() {
  command -v "$1" >/dev/null || {
    echo "$1 is required but not installed." >&2
    exit 1
  }
}

require flatpak
require ostree
require jq
require gpg
require base64

# The subject of the commit at the head of a branch names the version it
# holds. Nothing is printed for a branch that does not exist yet.
held_version() {
  ostree --repo="$REPO" rev-parse "$1" >/dev/null 2>&1 || return 0
  ostree --repo="$REPO" show "$1" |
    awk 'NF == 0 { body = 1; next } body && NF { sub(/^ +/, ""); print; exit }'
}

if [ -f "$REPO/config" ]; then
  # The bucket keeps no empty directory, and OSTree refuses a repository that
  # lacks one of those it created.
  mkdir -p "$REPO/tmp" "$REPO/state" "$REPO/extensions" \
    "$REPO/refs/heads" "$REPO/refs/mirrors" "$REPO/refs/remotes"

  # A copy that arrived with an object missing or damaged stops the run here.
  # Published, it would serve that hole to every client, and the upload that
  # follows deletes from the bucket whatever this copy does not hold.
  log "Checking the repository"
  ostree --repo="$REPO" fsck --quiet
else
  log "Creating the repository"
  mkdir -p "$REPO"
  ostree --repo="$REPO" init --mode=archive-z2
fi

for channel in $CHANNELS; do
  ref="app/$APP_ID/$ARCH/$channel"
  version="$(jq -r --arg channel "$channel" '.[$channel][0] // empty' \
    "$STAGING/state.json")"

  if [ -z "$version" ]; then
    echo "$channel: no version yet."
    continue
  fi

  bundle="$STAGING/flatpak/GitHubDesktop-linux-$ARCH-$version.flatpak"
  if [ ! -f "$bundle" ]; then
    echo "$channel: $version has no Flatpak, the branch keeps what it held."
    continue
  fi

  held="$(held_version "$ref")"
  if [ "$held" = "$version" ]; then
    echo "$channel: already on $version."
    continue
  fi

  log "Moving $channel from ${held:-nothing} to $version"

  # The bundle is read into a repository of its own, then committed onto the
  # branch of the channel. It was built for latest, or beta for a beta, and a
  # promotion later lands the same bundle on stable.
  imported="$(mktemp -d)"
  ostree --repo="$imported" init --mode=archive-z2
  flatpak build-import-bundle --no-update-summary "$imported" "$bundle"
  source_ref="$(ostree --repo="$imported" refs | grep "^app/$APP_ID/")"

  # --force commits even when the content matches the head of the branch, so
  # that the subject always names the version the channel holds, which is
  # what held_version reads back on the next run.
  flatpak build-commit-from --src-repo="$imported" --src-ref="$source_ref" \
    --subject="$version" --gpg-sign="$GPG_KEY" --no-update-summary --force \
    "$REPO" "$ref"
  rm -rf "$imported"
done

# The summary is what clients read first: which branches exist, on which
# commit, signed. The static deltas let an update download one file per
# change instead of every object that changed.
log "Updating the summary"
flatpak build-update-repo --gpg-sign="$GPG_KEY" \
  --title="GitHub Desktop for Linux" --default-branch=stable \
  --generate-static-deltas --prune --prune-depth="$((KEEP - 1))" "$REPO"

log "Writing the files that point Flatpak at the repository"
mkdir -p "$OUTPUT"
KEY="$(gpg --export "$GPG_KEY" | base64 --wrap=0)"

cat > "$OUTPUT/github-desktop.flatpakrepo" <<EOF
[Flatpak Repo]
Title=GitHub Desktop for Linux
Comment=Maintained Linux builds of GitHub Desktop
Url=$REPO_URL
Homepage=$BASE_URL/
Icon=$BASE_URL/logo.png
DefaultBranch=stable
GPGKey=$KEY
EOF

# A channel whose branch does not exist yet gets no file: it would only lead
# to an error.
for channel in $CHANNELS; do
  ostree --repo="$REPO" rev-parse "app/$APP_ID/$ARCH/$channel" \
    >/dev/null 2>&1 || continue
  cat > "$OUTPUT/github-desktop-$channel.flatpakref" <<EOF
[Flatpak Ref]
Title=GitHub Desktop ($channel)
Name=$APP_ID
Branch=$channel
Url=$REPO_URL
SuggestRemoteName=$REMOTE_NAME
RuntimeRepo=$RUNTIME_REPO
IsRuntime=false
Homepage=$BASE_URL/
Icon=$BASE_URL/logo.png
GPGKey=$KEY
EOF
done

ls -l "$OUTPUT"
du -sh "$REPO"
