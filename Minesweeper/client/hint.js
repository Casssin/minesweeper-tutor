"use strict";

async function trivial_hints(board, options) {

    // find all the tiles which are revealed and have un-revealed / un-flagged adjacent squares
    const allCoveredTiles = [];
    const witnesses = [];
    const witnessed = [];
    const unflaggedMines = [];

    let minesLeft = board.num_bombs;
    let squaresLeft = 0;

    const work = new Set();  // use a map to deduplicate the witnessed tiles

    // showMessage("The solver is thinking...");

    for (let i = 0; i < board.tiles.length; i++) {

        const tile = board.getTile(i);

        tile.clearHint();  // clear any previous hints

        if (tile.isSolverFoundBomb()) {
            minesLeft--;
            tile.setProbability(0);
            if (!tile.isFlagged()) {
                unflaggedMines.push(tile);
            }
            continue;  // if the tile is a mine then nothing to consider
        } else if (tile.isCovered()) {
            squaresLeft++;
            allCoveredTiles.push(tile);
            if (tile.is_start) {
                startTile = tile;
            }
            continue;  // if the tile hasn't been revealed yet then nothing to consider
        }

        const adjTiles = board.getAdjacent(tile);

        let needsWork = false;
        for (let j = 0; j < adjTiles.length; j++) {
            const adjTile = adjTiles[j];
            if (adjTile.isCovered() && !adjTile.isSolverFoundBomb() && !adjTile.isFlagged()) {
                needsWork = true;
                work.add(adjTile.index);
            }
        }

        if (needsWork) {  // the witness still has some unrevealed adjacent tiles
            witnesses.push(tile);
        }

    }

    // generate an array of tiles from the map
    for (let index of work) {
        const tile = board.getTile(index);
        tile.setOnEdge(true);
        witnessed.push(tile);
    }

    board.setHighDensity(squaresLeft, minesLeft);

    console.log("tiles left = " + squaresLeft);
    console.log("mines left = " + minesLeft);
    console.log("Witnesses  = " + witnesses.length);
    console.log("Witnessed  = " + witnessed.length);

    let result = [];

    // if we are in flagged mode then flag any mines currently unflagged
    if (options.playStyle != PLAY_STYLE_EFFICIENCY && options.playStyle != PLAY_STYLE_NOFLAGS_EFFICIENCY) {
        for (let tile of unflaggedMines) {
            result.push(new Action(tile.getX(), tile.getY(), 0, ACTION_FLAG));
        }
    }

    // if there are no mines left to find the everything else is to be cleared
    if (minesLeft == 0) {
        for (let i = 0; i < allCoveredTiles.length; i++) {
            const tile = allCoveredTiles[i];

            tile.setProbability(1);
            result.push(new Action(tile.getX(), tile.getY(), 1, ACTION_CLEAR))
        }
        // showMessage("No mines left to find, all the remaining tiles are safe");
        return new EfficiencyHelper(board, witnesses, witnessed, result, options.playStyle, null, allCoveredTiles).process();
    }

    // there are no safe tiles left to find everything is a mine
    if (minesLeft == squaresLeft) {
        for (let i = 0; i < allCoveredTiles.length; i++) {
            const tile = allCoveredTiles[i];

            tile.setProbability(0);
            result.push(new Action(tile.getX(), tile.getY(), 0, ACTION_FLAG))
        }
        // showMessage("No safe tiles left to find, all the remaining tiles are mines");
        return result;
    }

    result = result.concat(one_trivial_hint(board, witnesses));

    if (result.length == 0) {
        return await solver(board, options);
    }

    return result;
}

function one_trivial_hint(board, witnesses) {
    const result = new Map();

    for (let i = 0; i < witnesses.length; i++) {

        const tile = witnesses[i];

        const adjTiles = board.getAdjacent(tile);

        let flags = 0
        let covered = 0;
        for (let j = 0; j < adjTiles.length; j++) {
            const adjTile = adjTiles[j];
            if (adjTile.isSolverFoundBomb() || adjTile.isFlagged()) {
                flags++;
            } else if (adjTile.isCovered()) {
                covered++;
            }
        }

        // if the tile has the correct number of flags then the other adjacent tiles are clear
        if (flags == tile.getValue() && covered > 0) {
            result.set(tile, new Action(tile.getX(), tile.getY(), 1, ACTION_HINT));
            for (let j = 0; j < adjTiles.length; j++) {
                const adjTile = adjTiles[j];
                if (adjTile.isCovered() && !adjTile.isSolverFoundBomb() && !adjTile.isFlagged()) {
                    adjTile.setProbability(1);  // definite clear
                    result.set(adjTile.index, new Action(adjTile.getX(), adjTile.getY(), 1, ACTION_CLEAR));
                }
            }

            break;
        // if the tile has n remaining covered squares and needs n more flags then all the adjacent files are flags
        } else if (tile.getValue() == flags + covered && covered > 0) {
            result.set(tile, new Action(tile.getX(), tile.getY(), 1, ACTION_HINT));
            for (let j = 0; j < adjTiles.length; j++) {
                const adjTile = adjTiles[j];
                if (adjTile.isCovered() && !adjTile.isSolverFoundBomb() && !adjTile.isFlagged()) { // if covered, not already a known mine and isn't flagged
                    adjTile.setProbability(0);  // definite mine
                    adjTile.setFoundBomb();
                    //if (!adjTile.isFlagged()) {  // if not already flagged then flag it
                    result.set(adjTile.index, new Action(adjTile.getX(), adjTile.getY(), 0, ACTION_FLAG));
                    //}

                }
            }

            break;
        } 

    }

    console.log("Found " + result.size + " moves trivially");

    // send it back as an array
    return Array.from(result.values());

}
