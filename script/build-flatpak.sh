#!/bin/bash
#
# Builds the Flatpak of a version from its .deb. The application is
# repackaged rather than compiled a second time, so that the Flatpak holds
# exactly the binaries of the other packages.
#
# Needs flatpak-builder and network access to Flathub, which provides the
# runtime and the Electron base the manifest names. ci-linux.yml runs it in
# the build image Flathub maintains, which has both.
#
# The bundle carries the address of the package repository and the public
# part of the key given: installing it subscribes to the repository, on the
# latest channel, or on beta for a beta, and flatpak update then brings the
# versions that follow. Flatpak then refuses a bundle whose content that key
# did not sign, so the content is signed with it, which makes the key of the
# repository the one to give.
#
# Output, in the output directory: the bundle, named like the other packages,
# and its checksum in the format of sha256sum.
#
# Usage: build-flatpak.sh <deb> <version> <output-dir> <gpg-key-id>

set -euo pipefail

DEB="${1:?.deb required}"
VERSION="${2:?version required}"
OUTPUT="${3:?output directory required}"
GPG_KEY="${4:?gpg key id required}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESOURCES="$HERE/resources/flatpak"

APP_ID="io.github.nitramo_yt.Github-Desktop"
REPO_URL="https://packages-github-desktop.nitramo.fr/flatpak/repo/"
RUNTIME_REPO="https://dl.flathub.org/repo/flathub.flatpakrepo"

case "$VERSION" in
  *beta*) BRANCH="beta" ;;
  *) BRANCH="latest" ;;
esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cp "$RESOURCES/$APP_ID.yml" "$RESOURCES/$APP_ID.desktop" \
  "$RESOURCES/$APP_ID.metainfo.xml" "$RESOURCES/set-desktop-name.py" "$WORK/"
cp "$DEB" "$WORK/github-desktop.deb"
sed -i -e "s/@VERSION@/$VERSION/" -e "s/@DATE@/$(date -u +%F)/" \
  "$WORK/$APP_ID.metainfo.xml"

gpg --export "$GPG_KEY" > "$WORK/repository.gpg"
test -s "$WORK/repository.gpg"

# The build image runs as root and comes with the runtime and the SDK
# installed system-wide: a user installation would download them again.
if [ "$(id -u)" = 0 ]; then
  INSTALLATION="--system"
else
  INSTALLATION="--user"
fi

flatpak remote-add "$INSTALLATION" --if-not-exists flathub "$RUNTIME_REPO"

# FUSE is not available inside a container, and rofiles-fuse only guards
# against a build step modifying files it did not create.
flatpak-builder "$INSTALLATION" --install-deps-from=flathub \
  --disable-rofiles-fuse \
  --state-dir="$WORK/state" --default-branch="$BRANCH" \
  --repo="$WORK/repo" --gpg-sign="$GPG_KEY" --force-clean \
  "$WORK/build" "$WORK/$APP_ID.yml"

mkdir -p "$OUTPUT"
BUNDLE="GitHubDesktop-linux-x86_64-$VERSION.flatpak"

flatpak build-bundle \
  --runtime-repo="$RUNTIME_REPO" \
  --repo-url="$REPO_URL" \
  --gpg-keys="$WORK/repository.gpg" \
  "$WORK/repo" "$OUTPUT/$BUNDLE" "$APP_ID" "$BRANCH"

(cd "$OUTPUT" && sha256sum "$BUNDLE" > "$BUNDLE.sha256")
ls -l "$OUTPUT/$BUNDLE"
