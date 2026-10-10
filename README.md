# Shamito Pauper Cube — Card Library

A static site that shows all 180 cards in the Shamito Pauper Cube, with color filters, sorting and search. No backend or build step is needed.

## Run locally

Open `index.html` in a browser.

## Deploy to Vercel

Import this repository in Vercel with the framework preset set to **Other**. Leave the build command empty and use the project root as the output directory.

## Changing the card list

1. Edit `data/cube-list.txt`. Each line is `SECTION|Card Name|set code|collector number`, using a printing you own. Valid sections are `WHITE`, `BLUE`, `BLACK`, `RED`, `GREEN`, `MULTICOLOR`, `COLORLESS` and `LANDS`.
2. Run `node scripts/build-cards.mjs` (Node 18+) to refresh `data/cards.js` from Scryfall.
3. Commit and push. Vercel redeploys automatically.

## Credits

Created by Samuelle Celis.

Card images and data come from [Scryfall](https://scryfall.com). This is a fan-made project and is not official. It is not produced, endorsed, or supported by Wizards of the Coast or Scryfall. Magic: The Gathering is © Wizards of the Coast.
