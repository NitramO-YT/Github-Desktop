[ ![🇬🇧 English](https://img.shields.io/badge/%F0%9F%87%AC%F0%9F%87%A7-English-blue) ](README.md)

# [GitHub Desktop](https://desktop.github.com) pour Linux

Une version Linux de [GitHub Desktop](https://desktop.github.com) maintenue par la communauté, tenue à jour à chaque version officielle.

> [!NOTE]
> Ceci est un fork non officiel. Il n'est ni affilié à GitHub, ni maintenu, ni cautionné par GitHub. Merci de signaler ici les problèmes propres à Linux, et non au projet officiel : voir [J'ai un problème avec GitHub Desktop](#jai-un-problème-avec-github-desktop).

[GitHub Desktop](https://desktop.github.com/) est une application GitHub open source basée sur [Electron](https://www.electronjs.org/). Elle est écrite en [TypeScript](https://www.typescriptlang.org) et utilise [React](https://reactjs.org/).

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="Une capture d'écran de l'application GitHub Desktop montrant des modifications en cours de consultation et de commit, avec deux co-auteurs attribués"
  />
</picture>

---

## À propos de ce fork

GitHub Desktop n'a pas de version Linux officielle. Pendant des années, les utilisateurs de Linux se sont appuyés sur [`shiftkey/desktop`](https://github.com/shiftkey/desktop), le fork recommandé par le README officiel, qui empaquetait l'application pour Linux. Sa dernière version, `3.4.13-linux1`, date de février 2025, alors que l'application officielle a continué d'avancer.

Ce fork reprend là où `shiftkey/desktop` s'est arrêté :

- il part de la version officielle actuelle de [`desktop/desktop`](https://github.com/desktop/desktop) ;
- il y réapplique le travail Linux réalisé dans `shiftkey/desktop` (empaquetage, adaptations de l'application propres à Linux, intégration continue), mis à jour pour le code actuel ;
- il corrige au passage les problèmes rencontrés sous Linux ;
- il suit chaque nouvelle version officielle.

Le travail Linux d'origine est l'œuvre de [Brendan Forster (@shiftkey)](https://github.com/shiftkey) et des contributeurs de `shiftkey/desktop`. Leurs commits conservent leurs auteurs dans ce dépôt.

### Versions

Chaque version porte le numéro de la version officielle à partir de laquelle elle est construite, suivi d'un numéro de révision Linux : `X.Y.Z-linuxN`. Par exemple, `3.6.6-linux1` est la première version Linux de la `3.6.6` officielle, et `3.6.6-linux2` un correctif Linux sur la même base.

---

## Où puis-je l'obtenir ?

Trois canaux sont disponibles, chacun avec un lien qui ne change jamais :

| Canal | Ce que c'est | Lien |
| --- | --- | --- |
| **Stable** | La version la plus récente utilisée depuis un certain temps sans problème connu. Elle est promue à la main, jamais le jour de sa sortie. | [Version stable](https://github.com/NitramO-YT/Github-Desktop/releases/tag/stable) |
| **Dernière version** | La version hors bêta la plus récente, dès sa publication. Elle n'a peut-être pas encore fait ses preuves. | [Dernière version](https://github.com/NitramO-YT/Github-Desktop/releases/latest) |
| **Bêta** | Construite à partir des versions bêta officielles, pour tester les nouvelles fonctionnalités et les correctifs avant tout le monde. | [Version bêta](https://github.com/NitramO-YT/Github-Desktop/releases/tag/beta) |

La plupart du temps, Stable et Dernière version désignent la même version. Elles diffèrent après une nouvelle sortie, jusqu'à ce que celle-ci ait fait ses preuves.

Chaque version fournit, pour x86_64 :

- un paquet `.deb`, pour Debian, Ubuntu et leurs dérivées ;
- un paquet `.rpm`, pour Fedora, openSUSE et leurs dérivées ;
- une `.AppImage`, pour n'importe quelle distribution ;
- un fichier `.flatpak`, pour n'importe quelle distribution dotée de Flatpak.

Chaque fichier est accompagné d'un fichier d'empreinte `.sha256`.

### Installer depuis le dépôt de paquets

Les paquets sont aussi publiés dans un dépôt APT, RPM et Flatpak, <https://packages-github-desktop.nitramo.fr/>. Installé depuis ce dépôt, GitHub Desktop est mis à jour par `apt`, `dnf` ou `flatpak` avec le reste du système. Le dépôt propose les trois mêmes canaux que les liens ci-dessus : les commandes ci-dessous suivent le canal stable, et remplacer `stable` par `latest` ou `beta` permet d'en suivre un autre.

```sh
# Debian, Ubuntu et leurs dérivées
curl -fsSL https://packages-github-desktop.nitramo.fr/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/github-desktop.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/github-desktop.gpg] \
https://packages-github-desktop.nitramo.fr/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/github-desktop.list
sudo apt update && sudo apt install github-desktop

# Fedora, RHEL et leurs dérivées
sudo rpm --import https://packages-github-desktop.nitramo.fr/gpg.key
sudo curl -fsSL -o /etc/yum.repos.d/github-desktop.repo \
  https://packages-github-desktop.nitramo.fr/rpm/stable/github-desktop.repo
sudo dnf install github-desktop

# Flatpak, sur n'importe quelle distribution, pour votre compte seulement
flatpak install --user \
  https://packages-github-desktop.nitramo.fr/flatpak/github-desktop-stable.flatpakref
```

L'identifiant Flatpak est `io.github.nitramo_yt.Github-Desktop`. Son socle, partagé avec de nombreuses autres applications, vient de Flathub.

Le dépôt est signé avec la clé `0A63 E20B 6AF5 A6EC D45B D895 6B53 59F0 1735 4722`. [Sa page](https://packages-github-desktop.nitramo.fr/) explique comment passer ensuite à un autre canal.

### Installer un fichier téléchargé

Téléchargez le fichier correspondant à votre distribution depuis l'un des liens ci-dessus, puis :

```sh
# Debian, Ubuntu et leurs dérivées
sudo apt install ./GitHubDesktop-linux-amd64-<version>.deb

# Fedora
sudo dnf install ./GitHubDesktop-linux-x86_64-<version>.rpm

# openSUSE
sudo zypper install ./GitHubDesktop-linux-x86_64-<version>.rpm

# AppImage, sur n'importe quelle distribution
chmod +x GitHubDesktop-linux-x86_64-<version>.AppImage
./GitHubDesktop-linux-x86_64-<version>.AppImage

# Flatpak, sur n'importe quelle distribution
flatpak install --user ./GitHubDesktop-linux-x86_64-<version>.flatpak
```

Sur Ubuntu 24.04 et ses dérivées, l'AppImage demande une étape supplémentaire avant de démarrer : voir [les problèmes connus](docs/known-issues.md#linux). Le `.deb` et le `.rpm` ne sont pas concernés.

Pour vérifier un téléchargement, placez son fichier `.sha256` à côté et exécutez `sha256sum -c <fichier>.sha256`.

Un `.deb`, un `.rpm` ou une AppImage téléchargés ne se mettent pas à jour tout seuls. Pour mettre à jour, téléchargez la nouvelle version depuis le même lien et installez-la de la même façon, ou installez plutôt depuis le dépôt de paquets. Le fichier `.flatpak` fait exception : l'installer abonne au dépôt de paquets, sur le canal latest, ou beta pour une bêta, et `flatpak update` apporte ensuite les versions suivantes.

### Enregistrer vos identifiants

GitHub Desktop enregistre vos identifiants au moyen de l'API Secret Service, qui nécessite un fournisseur actif dans votre session, comme GNOME Keyring ou KDE Wallet (KWallet). Les environnements de bureau en démarrent généralement un automatiquement. Sans fournisseur, vos identifiants ne sont pas conservés d'une session à l'autre.

### Windows et macOS

Ce fork ne fournit que des versions Linux. Sous Windows et macOS, utilisez les [installateurs officiels](https://github.com/desktop/desktop#where-can-i-get-it).

### Versions précédentes

Toutes les versions précédentes sont disponibles sur la page [Releases](https://github.com/NitramO-YT/Github-Desktop/releases).

---

## GitHub Desktop est-il fait pour moi ? Quels sont ses principaux axes ?

[Ce document](https://github.com/desktop/desktop/blob/development/docs/process/what-is-desktop.md) décrit les axes de GitHub Desktop et les personnes à qui le produit est le plus utile.

## J'ai un problème avec GitHub Desktop

Remarque : le [Code de conduite de GitHub Desktop](./CODE_OF_CONDUCT.md) s'applique à toutes les interactions liées au projet GitHub Desktop, ainsi qu'à ce fork.

Commencez par consulter les [problèmes connus sous Linux](docs/known-issues.md#linux) : certains ont des solutions de contournement.

Ensuite, l'endroit où le signaler dépend du problème :

- **Il est propre à Linux ou à cette version** (installation, empaquetage, intégration au bureau, ou tout ce qui fonctionne sous Windows et macOS) : cherchez dans les [issues de ce fork](https://github.com/NitramO-YT/Github-Desktop/issues), et ouvrez une [nouvelle issue](https://github.com/NitramO-YT/Github-Desktop/issues/new) si la vôtre n'y figure pas.
- **Il se produit aussi sous Windows ou macOS** : il vient de l'application elle-même. Cherchez dans les [issues ouvertes](https://github.com/desktop/desktop/issues?q=is%3Aopen) et les [issues fermées](https://github.com/desktop/desktop/issues?q=is%3Aclosed) du projet officiel, et signalez-le là-bas si nécessaire. Les correctifs apportés là-bas arrivent dans ce fork avec la version suivante.

## Le problème que j'ai signalé n'est toujours pas corrigé. Que puis-je faire ?

Ce fork est maintenu par un seul bénévole. Si personne n'a répondu à votre issue au bout de quelques jours, n'hésitez pas à y répondre par une relance amicale. Merci de ne pas y répondre plus d'une deuxième fois si personne n'a répondu.

## Comment puis-je contribuer ?

Les contributions à la prise en charge de Linux (empaquetage, intégration au bureau, correctifs propres à Linux) sont les bienvenues ici : ouvrez une issue ou une pull request sur ce dépôt.

La page du dépôt de paquets peut être traduite dans d'autres langues, avec un seul fichier par langue : [`script/resources/repo/locales/`](./script/resources/repo/locales/) explique comment.

Tout le reste, comme les nouvelles fonctionnalités ou les correctifs qui concernent toutes les plateformes, relève du [projet officiel](https://github.com/desktop/desktop). Son document [CONTRIBUTING.md](./.github/CONTRIBUTING.md) vous aidera à préparer votre environnement et à vous familiariser avec le code source, et le dossier [documentation](docs/) contient d'autres ressources.

## Compiler Desktop

Pour préparer votre environnement de développement afin de compiler Desktop, consultez [`setup.md`](./docs/contributing/setup.md), et [`setup-linux.md`](./docs/contributing/setup-linux.md) pour les dépendances nécessaires sous Linux.

## Plus de ressources

Consultez le [README du projet officiel](https://github.com/desktop/desktop#github-desktop) et [desktop.github.com](https://desktop.github.com) pour plus d'informations orientées produit sur GitHub Desktop.

Consultez la [documentation de prise en main](https://docs.github.com/en/desktop/overview/getting-started-with-github-desktop) officielle pour plus d'informations sur l'installation, l'authentification et la configuration de GitHub Desktop.

---

## Licence

**[MIT](LICENSE)**

La concession de la licence MIT ne porte pas sur les marques de GitHub, qui incluent les créations de logo. GitHub se réserve tous les droits de marque et d'auteur sur l'ensemble des marques de GitHub. Les logos de GitHub comprennent, par exemple, les dessins stylisés de l'Invertocat dont le nom de fichier contient « logo », dans le dossier suivant : [logos](app/static/logos).

GitHub® et ses versions stylisées ainsi que la marque Invertocat sont des marques ou des marques déposées de GitHub. Lorsque vous utilisez les logos de GitHub, veillez à respecter les [règles d'utilisation du logo](https://github.com/logos) de GitHub.
