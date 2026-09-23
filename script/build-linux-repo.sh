#!/bin/bash
#
# Builds the APT and RPM repositories that packages-github-desktop.nitramo.fr
# serves, so that users install and upgrade with their own package manager
# instead of downloading a file by hand on every release.
#
# The whole tree is rebuilt from the packages handed to it, never patched in
# place. A repository that is regenerated cannot drift: whatever state the
# previous run left behind, the result only reflects the packages present now.
#
# Input: a staging directory holding the packages to publish, one folder per
# channel, which the release workflow fills by downloading published releases:
#
#   staging/deb/<channel>/*.deb   staging/rpm/<channel>/*.rpm
#
# along with what the landing page lists: state.json, the checksum files of
# each release in staging/checksums/, and the name and size of its files in
# staging/assets/<version>.json.
#
# Output: a tree ready to be copied to the bucket as-is.
#
# Usage: build-linux-repo.sh <staging-dir> <output-dir> <gpg-key-id>

set -euo pipefail

STAGING="${1:?staging directory required}"
OUTPUT="${2:?output directory required}"
GPG_KEY="${3:?gpg key id required}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Shown by apt in its update output and by dnf in its repository listing.
ORIGIN="GitHub Desktop for Linux"
LABEL="github-desktop"
DESCRIPTION="Maintained Linux builds of GitHub Desktop"
BASE_URL="https://packages-github-desktop.nitramo.fr"

# Debian names the architecture amd64 where RPM names it x86_64; both refer to
# the only architecture built today.
DEB_ARCH="amd64"
RPM_ARCH="x86_64"

# The three the README offers, with the same meaning: a version proven over
# time, the newest final release as soon as it is out, and the preview builds.
CHANNELS="stable latest beta"

log() { printf '\n== %s\n' "$1"; }

require() {
  command -v "$1" >/dev/null || {
    echo "$1 is required but not installed." >&2
    exit 1
  }
}

require apt-ftparchive
require createrepo_c
require gpg
require gzip
# createrepo_c reads the rpm configuration to know how to parse packages, and
# fails on every one of them when only its own binary is installed.
require rpm

rm -rf "$OUTPUT"
mkdir -p "$OUTPUT"

# The public key sits at the root of the repository: the installation
# instructions point users at this one URL, whichever package format they use.
log "Exporting the public key"
gpg --armor --export "$GPG_KEY" > "$OUTPUT/gpg.key"
test -s "$OUTPUT/gpg.key"

build_deb_channel() {
  local channel="$1"
  local source="$STAGING/deb/$channel"

  # A channel with nothing in it is not an error: beta is empty between two
  # upstream betas, and stable is empty until the first promotion.
  compgen -G "$source/*.deb" >/dev/null || {
    echo "No .deb for $channel, skipping."
    return
  }

  # Each channel owns its own pool rather than sharing one. apt-ftparchive
  # indexes a whole directory, so separate pools are what keeps a beta out of
  # the stable index without having to filter package by package.
  local pool="pool/$channel/main/g/github-desktop"
  local dist="dists/$channel"
  mkdir -p "$OUTPUT/deb/$pool" "$OUTPUT/deb/$dist/main/binary-$DEB_ARCH"
  cp "$source"/*.deb "$OUTPUT/deb/$pool/"

  # Run from the deb root so that the Filename field of each entry is relative
  # to the repository root, which is how apt resolves the download URL.
  (
    cd "$OUTPUT/deb"
    apt-ftparchive packages "$pool" > "$dist/main/binary-$DEB_ARCH/Packages"
    gzip -9 -c "$dist/main/binary-$DEB_ARCH/Packages" \
      > "$dist/main/binary-$DEB_ARCH/Packages.gz"

    # Written outside the directory being indexed, then moved in. Redirecting
    # straight into it would create the file before apt-ftparchive walks the
    # directory, and it would list a checksum of its own half-written self.
    apt-ftparchive release \
      -o "APT::FTPArchive::Release::Origin=$ORIGIN" \
      -o "APT::FTPArchive::Release::Label=$LABEL" \
      -o "APT::FTPArchive::Release::Suite=$channel" \
      -o "APT::FTPArchive::Release::Codename=$channel" \
      -o "APT::FTPArchive::Release::Architectures=$DEB_ARCH" \
      -o "APT::FTPArchive::Release::Components=main" \
      -o "APT::FTPArchive::Release::Description=$DESCRIPTION ($channel)" \
      "$dist" > "$dist.Release.tmp"
    mv "$dist.Release.tmp" "$dist/Release"

    # Both signature forms are published. InRelease carries the signature
    # inline and is what current apt fetches; Release.gpg is the detached form
    # older releases still ask for, and costs nothing to keep.
    gpg --batch --yes --default-key "$GPG_KEY" \
      --clearsign -o "$dist/InRelease" "$dist/Release"
    gpg --batch --yes --default-key "$GPG_KEY" \
      -abs -o "$dist/Release.gpg" "$dist/Release"
  )

  echo "  $channel: $(ls -1 "$OUTPUT/deb/$pool" | wc -l) package(s)"
}

build_rpm_channel() {
  local channel="$1"
  local source="$STAGING/rpm/$channel"

  compgen -G "$source/*.rpm" >/dev/null || {
    echo "No .rpm for $channel, skipping."
    return
  }

  local dir="$OUTPUT/rpm/$channel"
  mkdir -p "$dir"
  cp "$source"/*.rpm "$dir/"

  createrepo_c --quiet "$dir"

  # dnf checks repomd.xml against this signature before trusting anything it
  # lists, which is what makes the checksums it holds for each package
  # meaningful.
  gpg --batch --yes --default-key "$GPG_KEY" \
    --detach-sign --armor "$dir/repodata/repomd.xml"

  # Shipped in the repository so that a single curl into /etc/yum.repos.d is
  # enough to subscribe, with no hand-written file to get wrong.
  cat > "$dir/github-desktop.repo" <<EOF
[github-desktop-$channel]
name=$ORIGIN ($channel)
baseurl=$BASE_URL/rpm/$channel
enabled=1
type=rpm
repo_gpgcheck=1
gpgcheck=0
gpgkey=$BASE_URL/gpg.key
EOF

  echo "  $channel: $(ls -1 "$dir"/*.rpm | wc -l) package(s)"
}

log "Building the APT repository"
for channel in $CHANNELS; do
  build_deb_channel "$channel"
done

log "Building the RPM repository"
for channel in $CHANNELS; do
  build_rpm_channel "$channel"
done

# R2 serves objects and nothing else: without this page the address the README
# gives out answers 404. It holds the commands to subscribe and the files to
# download, so that landing on the repository by itself is enough to know what
# to do with it.
#
# Rendered rather than copied, because it names the version each channel
# serves, with the size and checksum of each file, which only the staging
# directory knows, and holds its texts in every language of
# resources/repo/locales/. The icons come from the application, so the page
# shows whichever artwork the build currently ships.
log "Rendering the landing page"
node "$HERE/render-repo-page.mjs" \
  "$HERE/resources/repo/index.html" "$OUTPUT/index.html" "$STAGING"
cp "$HERE/../app/static/linux/logos/128x128.png" "$OUTPUT/logo.png"
cp "$HERE/../app/static/linux/logos/32x32.png" "$OUTPUT/favicon.png"

log "Done"
du -sh "$OUTPUT"
