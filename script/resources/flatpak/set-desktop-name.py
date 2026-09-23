"""Points the desktopName of the packaged application at the desktop file of
the Flatpak.

Under Wayland, Electron gives the window an app_id taken from desktopName, and
the compositor looks for the desktop file of that name to find the icon and
the name of the window, and to group it with its launcher. The .deb installs
github-desktop.desktop, while Flatpak installs its desktop file under the
application ID.

Usage: set-desktop-name.py <package.json> <desktop file name>
"""

import json
import sys

EXPECTED = 'github-desktop.desktop'

path, name = sys.argv[1], sys.argv[2]

with open(path, encoding='utf-8') as file:
    package = json.load(file)

# A .deb that ships another name stops the build here, rather than producing a
# Flatpak whose windows no launcher matches.
if package.get('desktopName') != EXPECTED:
    sys.exit(
        f'{path} names {package.get("desktopName")!r} as its desktopName, '
        f'where {EXPECTED!r} was expected.'
    )

package['desktopName'] = name

with open(path, 'w', encoding='utf-8') as file:
    json.dump(package, file, ensure_ascii=False, separators=(',', ':'))
