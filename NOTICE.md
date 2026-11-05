# NOTICE

## What this repository is

PoT Against Humanity, in this repository
(https://github.com/ccomarato/potagainsthumanity), maintained by Webswerve,
is a fork of
MassiveDecks, the upstream project this fork is based on.

MassiveDecks was originally developed and is maintained upstream by
Reread Games and its contributors.
Copyright in the original MassiveDecks code is held by its respective
contributors. This fork does not claim authorship of that code, and
no upstream credit has been removed from it.

## Licence

This project, including the original MassiveDecks code and the
modifications in this fork, is licensed under the GNU Affero General
Public License, version 3 (AGPLv3). See LICENSE for the full text.

In particular:

- You may copy, modify, and distribute this code under AGPLv3.
- If you modify it and convey it, you must carry prominent notices
  stating that you modified it, and keep this licence and all
  copyright / attribution notices intact.
- If you run a modified version over a network for other users,
  you must offer those users the corresponding source code
  (AGPLv3, section 13). This repository is public, so a hosted
  instance satisfies that offer by linking players to this
  repository — the in-app About link points here. A private copy
  of the code that players cannot open would not satisfy it.
- Do not relicence this code under a different licence. A fork
  does not change the licence of the code it is based on.

This file is not legal advice. The repository is public; if the
game is run as a public hosted service or used commercially, get
the licence position checked properly.

## Changes in this fork

Changes made in this fork, as far as can be verified from the files
in this repository (which has no git history in the uploaded copy),
include:

- Rebranding the user-facing name and style components to PoT Against Humanity.
- Adding the PoT Season 1 built-in deck
  (`server/decks/pah-season1-en.deck.json5`).

## Third-party components and decks

- `client/elm-material` is a Git submodule pointing at the
  upstream project's elm-material repository (see `.gitmodules`).
  Its own licence and attribution remain with that project. The
  submodule URL is a dependency pointer, not an endorsement, and
  submodules routinely point at other people's repositories. In
  the planned React client this dependency is removed entirely.
  If you want no upstream URL in the repo at all, fork
  elm-material to your own account and repoint the submodule, or
  vendor the code in with its licence kept.
- The game concept is based on Cards Against Humanity, used under
  a Creative Commons BY-NC-SA 2.0 licence
  (https://creativecommons.org/licenses/by-nc-sa/2.0/).
- Built-in decks in `server/decks/`:
  - `cah-base-en` and `cah-base-ptbr` — Cards Against Humanity
    base decks, CC BY-NC-SA 2.0, as labelled in their headers.
  - `pah-season1-en` — PoT Against Humanity Season 1 deck, also
    labelled CC BY-NC-SA 2.0 in its header.
- External deck sources (ManyDecks, JSON Against Humanity) are
  configured in `server/config.json5` and carry their own licences
  and attributions. Check those sources before relying on them.

## What was deliberately not changed

- The AGPLv3 LICENSE file is unchanged.
- Package `author` fields that already read "Webswerve" have been
  left as they were, so no existing authorship claim is erased.
- Operational links in the client code (About, bug reports,
  translation help, licence) now point at this fork, not at
  upstream. The original project is still credited by name in
  this file and in README.md — credit by name, without a link
  to the upstream author's account, as requested for this fork.
- `.github/FUNDING.yml` must be deleted from this fork. It
  previously pointed at the upstream author, which would send
  any sponsors link to upstream, not to Webswerve. Do not
  replace it with a sponsors link unless Webswerve has one.
