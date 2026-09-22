# Security policy

This repository publishes a Linux build of GitHub Desktop. It is not run by
GitHub, so a vulnerability found here does not reach the same people as one
found in the official product, and reporting it in the wrong place means it
stays unfixed.

## What belongs where

**In the packaging or the Linux-specific code of this fork**, report it to this
repository through
[private vulnerability reporting](https://github.com/NitramO-YT/Github-Desktop/security/advisories/new),
which keeps the report hidden until a fix is published. Examples: how the
packages are built or signed, the desktop entry and the protocol handlers it
registers, the way credentials are stored through the Secret Service, or
anything else this fork adds on top of the upstream code.

**In GitHub Desktop itself**, meaning code that behaves the same on Windows and
macOS, report it to GitHub rather than here, following
[their security policy](https://github.com/desktop/desktop/security/policy).
They own that code, and a fix there reaches every user of the application
instead of the few who run these packages. Telling us as well is welcome, so
that a build carrying the fix can be published quickly.

If you are unsure which of the two it is, report it here privately and we will
forward it.

**Please do not report security vulnerabilities through public issues,
discussions or pull requests.** A public report tells everyone how to exploit
the problem before anyone can install a fix.

## What to expect

This is a small project maintained on personal time, so an answer may take a
few days. You will be told what was understood of the report, whether it is
considered a vulnerability, and when a fixed build is published.
