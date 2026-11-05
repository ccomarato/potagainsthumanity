# PoT Against Humanity

[![Current Release Version](https://img.shields.io/github/v/tag/ccomarato/potagainsthumanity?label=release&sort=semver)](https://github.com/ccomarato/potagainsthumanity/releases)
[![Build Status](https://img.shields.io/github/workflow/status/ccomarato/potagainsthumanity/Build)](https://github.com/ccomarato/potagainsthumanity/actions)
[![License](https://img.shields.io/github/license/ccomarato/potagainsthumanity)](LICENSE)

## About this fork

PoT Against Humanity is a fork of MassiveDecks, originally developed
and maintained by Reread Games. MassiveDecks, and therefore this fork,
is licensed under the GNU Affero General Public License v3 — see
[LICENSE](LICENSE) and [NOTICE](NOTICE.md).

This fork is maintained by Webswerve, separately in this repository.
It is not the upstream MassiveDecks project, and it is not maintained
by Reread Games. No link in this fork points at the upstream author's
account. Changes made
in this fork include rebranding to PoT Against Humanity and the addition of
the PoT Season 1 deck (see `server/decks/pah-season1-en.deck.json5`).
If you run a modified version of this game over a network, you must offer
its users the corresponding source code, as required by AGPLv3 section 13.

PoT Against Humanity is a party game based on [Cards against Humanity][cah].
Play with boners and hobos alike!

[cah]: https://cardsagainsthumanity.com/

## Features

- Play together in the same room or online.
- Use any device (Phone, PC, Chromecast, anything with a web browser).
- You can set up a central screen, but you don't need to (no need to stream anything for other players online).
- Custom decks (via ManyDecks deck sources, configured in `server/config.json5`).
- Customise the rules:
  - Custom cards.
  - House rules.
  - AI players.
  - Custom time limits if you want them.
- Spectators.
- Keeps your game private by default, you can also set a game password if needed.
- Community translations.

## About

The game is open source software available under [the AGPLv3 license](LICENSE).

The web client for the game is written in [Elm][elm], while the back-end is written in [Typescript][typescript].

[elm]: https://elm-lang.org/
[typescript]: https://www.typescriptlang.org/

## Deploying

If you would like to run a production instance of PoT Against Humanity, there are a couple of options.

It is suggested you read the [deployment guide on the wiki][deployment-guide].

[deployment-guide]: https://github.com/ccomarato/potagainsthumanity/wiki/Deploying

### Docker

Build the images from this repository — see the Dockerfiles in `server/` and `client/`.
Do not use the upstream MassiveDecks images; they are a different project.

There are example docker deployments in [the deployment folder](deployment).

### Heroku

You can deploy to Heroku with the button below:

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ccomarato/potagainsthumanity)

If you want to customise the deployment further, you can deploy through heroku from your own fork of the project with
modification (note the button above is hard-coded to this repository).

## Contributing

If you have any problems with the game, please [raise an issue][issue]. If you would like to help develop the game,
check [the wiki's contribution guide][contributing] for how to get started.

The game has a system for translation, and if you would like to provide translation to a new language, please see
[the guide on the wiki][translation].

[issue]: https://github.com/ccomarato/potagainsthumanity/issues/new
[contributing]: https://github.com/ccomarato/potagainsthumanity/wiki/Contributing
[translation]: https://github.com/ccomarato/potagainsthumanity/wiki/Translation

## Credits

### Original project

MassiveDecks, by Reread Games and its contributors.
Copyright in the original code is held by its respective contributors.
This fork does not claim authorship of the original MassiveDecks code.
The fork itself is maintained by Webswerve.

### Contributors to this fork

PoT Against Humanity is open source, and would not be possible without the time and work of
[the community members][github-contributors] who have contributed code and localizations,
both to upstream MassiveDecks and to this fork.

[github-contributors]: https://github.com/ccomarato/potagainsthumanity/graphs/contributors

### Maintainers

Reread Games maintains upstream MassiveDecks. This PoT Against Humanity fork is
maintained separately, by Webswerve, in this repository.

### Inspiration

The 'Cards Against Humanity' game concept is used under a [Creative Commons BY-NC-SA 2.0 license][cah-license] granted
by [Cards against Humanity][cah].

[cah-license]: https://creativecommons.org/licenses/by-nc-sa/2.0/

PoT Against Humanity is also inspired by:

- [CardCast][cardcast] - an app that allowed you to play on a Chromecast, now dead.
- [Pretend You're Xyzzy][xyzzy] - another web implementation.

[cardcast]: https://www.cardcastgame.com/
[xyzzy]: http://pretendyoure.xyz/zy/
