[ ![🇫🇷 Français](https://img.shields.io/badge/%F0%9F%87%AB%F0%9F%87%B7-Fran%C3%A7ais-blue) ](README.fr.md)

# [GitHub Desktop](https://desktop.github.com) for Linux

A community-maintained Linux build of [GitHub Desktop](https://desktop.github.com), kept up to date with each official release.

> [!NOTE]
> This is an unofficial fork. It is not affiliated with, maintained or endorsed by GitHub. Please report problems specific to Linux here, not to the official project: see [I have a problem with GitHub Desktop](#i-have-a-problem-with-github-desktop).

[GitHub Desktop](https://desktop.github.com/) is an open-source [Electron](https://www.electronjs.org/)-based GitHub app. It is written in [TypeScript](https://www.typescriptlang.org) and uses [React](https://reactjs.org/).

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="A screenshot of the GitHub Desktop application showing changes being viewed and committed with two attributed co-authors"
  />
</picture>

---

## About this fork

GitHub Desktop has no official Linux version. For years, Linux users relied on [`shiftkey/desktop`](https://github.com/shiftkey/desktop), the fork recommended by the official README, which packaged the application for Linux. Its last release, `3.4.13-linux1`, dates from February 2025, while the official application kept moving forward.

This fork picks up where `shiftkey/desktop` left off:

- it starts from the current official release of [`desktop/desktop`](https://github.com/desktop/desktop);
- it re-applies the Linux work done in `shiftkey/desktop` on top of it (packaging, Linux-specific adjustments to the application, continuous integration), updated for the current codebase;
- it fixes the problems found on Linux along the way;
- it follows each new official release.

The original Linux work is the work of [Brendan Forster (@shiftkey)](https://github.com/shiftkey) and the contributors of `shiftkey/desktop`. Their commits keep their authors in this repository.

### Versions

Each version carries the number of the official version it is built from, followed by a Linux revision number: `X.Y.Z-linuxN`. For example, `3.6.6-linux1` is the first Linux build of the official `3.6.6`, and `3.6.6-linux2` a Linux fix on the same base.

---

## Where can I get it?

Three channels are available, each with a link that never changes:

| Channel | What it is | Link |
| --- | --- | --- |
| **Stable** | The most recent version that has been in use for a while without known issues. It is promoted by hand, never on the day it is released. | [Stable release](https://github.com/NitramO-YT/Github-Desktop/releases/tag/stable) |
| **Latest** | The most recent non-beta version, as soon as it is published. It may not have been proven yet. | [Latest release](https://github.com/NitramO-YT/Github-Desktop/releases/latest) |
| **Beta** | Built from the official beta versions, to test new features and fixes before everyone else. | [Beta release](https://github.com/NitramO-YT/Github-Desktop/releases/tag/beta) |

Most of the time, Stable and Latest are the same version. They differ after a new release, until it has been proven.

Each release provides, for x86_64:

- a `.deb` package, for Debian, Ubuntu and their derivatives;
- a `.rpm` package, for Fedora, openSUSE and their derivatives;
- an `.AppImage`, for any distribution.

Each file comes with a `.sha256` checksum file.

### Installing from the package repository

The packages are also published in an APT and RPM repository, <https://packages-github-desktop.nitramo.fr/>. Installed from it, GitHub Desktop is updated by `apt` or `dnf` along with the rest of the system. The repository offers the same three channels as the links above: the commands below follow the stable channel, and replacing `stable` with `latest` or `beta` follows another one.

```sh
# Debian, Ubuntu and their derivatives
curl -fsSL https://packages-github-desktop.nitramo.fr/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/github-desktop.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/github-desktop.gpg] \
https://packages-github-desktop.nitramo.fr/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/github-desktop.list
sudo apt update && sudo apt install github-desktop

# Fedora, RHEL and their derivatives
sudo rpm --import https://packages-github-desktop.nitramo.fr/gpg.key
sudo curl -fsSL -o /etc/yum.repos.d/github-desktop.repo \
  https://packages-github-desktop.nitramo.fr/rpm/stable/github-desktop.repo
sudo dnf install github-desktop
```

The repository is signed with the key `0A63 E20B 6AF5 A6EC D45B D895 6B53 59F0 1735 4722`. [Its page](https://packages-github-desktop.nitramo.fr/) explains how to move to another channel later.

### Installing a downloaded file

Download the file for your distribution from one of the links above, then:

```sh
# Debian, Ubuntu and their derivatives
sudo apt install ./GitHubDesktop-linux-amd64-<version>.deb

# Fedora
sudo dnf install ./GitHubDesktop-linux-x86_64-<version>.rpm

# openSUSE
sudo zypper install ./GitHubDesktop-linux-x86_64-<version>.rpm

# AppImage, on any distribution
chmod +x GitHubDesktop-linux-x86_64-<version>.AppImage
./GitHubDesktop-linux-x86_64-<version>.AppImage
```

On Ubuntu 24.04 and its derivatives, the AppImage needs one extra step before it starts: see [the known issues](docs/known-issues.md#linux). The `.deb` and the `.rpm` are not affected.

To check a download, put its `.sha256` file next to it and run `sha256sum -c <file>.sha256`.

A downloaded file is not updated automatically. To update, download the new version from the same link and install it the same way, or install from the package repository instead.

### Saving your credentials

GitHub Desktop stores your credentials through the Secret Service API, which needs a provider running in your session, such as GNOME Keyring or KDE Wallet (KWallet). Desktop environments usually start one automatically. Without one, your credentials are not saved between sessions.

### Windows and macOS

This fork only provides Linux builds. On Windows and macOS, use the [official installers](https://github.com/desktop/desktop#where-can-i-get-it).

### Past Releases

All previous versions are available on the [Releases](https://github.com/NitramO-YT/Github-Desktop/releases) page.

---

## Is GitHub Desktop right for me? What are the primary areas of focus?

[This document](https://github.com/desktop/desktop/blob/development/docs/process/what-is-desktop.md) describes the focus of GitHub Desktop and who the product is most useful for.

## I have a problem with GitHub Desktop

Note: The [GitHub Desktop Code of Conduct](./CODE_OF_CONDUCT.md) applies in all interactions relating to the GitHub Desktop project, and to this fork as well.

First, check the [known issues on Linux](docs/known-issues.md#linux): some of them have workarounds.

Then, where to report depends on the problem:

- **It is specific to Linux or to this build** (installation, packaging, desktop integration, or anything that works on Windows and macOS): search the [issues of this fork](https://github.com/NitramO-YT/Github-Desktop/issues), and open a [new issue](https://github.com/NitramO-YT/Github-Desktop/issues/new) if yours is not there.
- **It also happens on Windows or macOS**: it comes from the application itself. Search the [open issues](https://github.com/desktop/desktop/issues?q=is%3Aopen) and [closed issues](https://github.com/desktop/desktop/issues?q=is%3Aclosed) of the official project, and report it there if needed. Fixes made there reach this fork with the next release.

## The issue I reported isn't fixed yet. What can I do?

This fork is maintained by a single volunteer. If nobody has responded to your issue in a few days, you're welcome to respond to it with a friendly ping. Please do not respond more than a second time if nobody has responded.

## How can I contribute?

Contributions to the Linux support (packaging, desktop integration, fixes specific to Linux) are welcome here: open an issue or a pull request on this repository.

Everything else, such as new features or fixes that concern every platform, belongs to the [official project](https://github.com/desktop/desktop). Its [CONTRIBUTING.md](./.github/CONTRIBUTING.md) document will help you get set up and familiar with the source, and the [documentation](docs/) folder contains more resources.

## Building Desktop

To set up your development environment for building Desktop, check out [`setup.md`](./docs/contributing/setup.md), and [`setup-linux.md`](./docs/contributing/setup-linux.md) for the dependencies needed on Linux.

## More Resources

See the [README of the official project](https://github.com/desktop/desktop#github-desktop) and [desktop.github.com](https://desktop.github.com) for more product-oriented information about GitHub Desktop.

See the official [getting started documentation](https://docs.github.com/en/desktop/overview/getting-started-with-github-desktop) for more information on how to set up, authenticate, and configure GitHub Desktop.

---

## License

**[MIT](LICENSE)**

The MIT license grant is not for GitHub's trademarks, which include the logo designs. GitHub reserves all trademark and copyright rights in and to all GitHub trademarks. GitHub's logos include, for instance, the stylized Invertocat designs that include "logo" in the file title in the following folder: [logos](app/static/logos).

GitHub® and its stylized versions and the Invertocat mark are GitHub's Trademarks or registered Trademarks. When using GitHub's logos, be sure to follow the GitHub [logo guidelines](https://github.com/logos).
