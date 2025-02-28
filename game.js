// Define grid and tile constants
const tileSize = 32;
const gridCols = 15;
const gridRows = 13;

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.gameLevel = 1;
    this.successCnt = 0;
    this.monsterLevel = 1;
    this.monsterMoveDelay = 1000;
    this.playerLives = 4;
  }

  // Added: Reset level variables upon scene restart.
  init() {
    if (this.playerLives <= 1) {
      this.gameLevel = 1;
      this.successCnt = 0;
      this.monsterLevel = 1;
      this.monsterMoveDelay = 1000;
      this.playerLives = 3;
    } else {
      this.playerLives -= 1;
    }
  }

  preload() {
    // No external assets are loaded.
  }

  create() {
    // Updated: Display level and success count at the top of the game.
    this.levelText = this.add.text(10, 10, "Level: " + this.gameLevel + "  Score: " + this.successCnt, { font: '16px Arial', fill: '#ffffff' });
    this.levelText.setDepth(1000);
  
    // --- Create custom textures using Phaser Graphics ---
    // Floor texture (light gray)
    this.make.graphics({ x: 0, y: 0, add: false })
      .fillStyle(0xaaaaaa, 1)
      .fillRect(0, 0, tileSize, tileSize)
      .generateTexture('floor', tileSize, tileSize);
    // Solid wall texture (blue)
    this.make.graphics({ x: 0, y: 0, add: false })
      .fillStyle(0x0000ff, 1)
      .fillRect(0, 0, tileSize, tileSize)
      .generateTexture('solid', tileSize, tileSize);
    // Destructible block texture (orange)
    this.make.graphics({ x: 0, y: 0, add: false })
      .fillStyle(0xffa500, 1)
      .fillRect(0, 0, tileSize, tileSize)
      .generateTexture('destructible', tileSize, tileSize);
    // Player texture (green circle)
    this.make.graphics({ x: 0, y: 0, add: false })
      .fillStyle(0x00ff00, 1)
      .fillCircle(tileSize / 2, tileSize / 2, tileSize / 2)
      .generateTexture('player', tileSize, tileSize);
    // Bomb texture (black circle)
    this.make.graphics({ x: 0, y: 0, add: false })
      .fillStyle(0x000000, 1)
      .fillCircle(tileSize / 2, tileSize / 2, tileSize / 2)
      .generateTexture('bomb', tileSize, tileSize);
    // Explosion texture (red circle)
    this.make.graphics({ x: 0, y: 0, add: false })
      .fillStyle(0xff0000, 1)
      .fillCircle(tileSize / 2, tileSize / 2, tileSize / 2)
      .generateTexture('explosion', tileSize, tileSize);

    // Monster texture (purple square)
    this.make.graphics({ x: 0, y: 0, add: false })
      .fillStyle(0x800080, 1)
      .fillRect(0, 0, tileSize, tileSize)
      .generateTexture('monster', tileSize, tileSize);

    // --- Modified: Create smaller Heart texture for player lives ---
    let heartGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    heartGraphics.fillStyle(0xff0000, 1);
    // Draw two circles for the top of the heart (smaller)
    heartGraphics.fillCircle(4, 4, 4);
    heartGraphics.fillCircle(12, 4, 4);
    // Draw a triangle for the bottom of the heart (smaller)
    heartGraphics.fillTriangle(0, 4, 16, 4, 8, 16);
    heartGraphics.generateTexture('heart', 16, 16);

    // --- Modified: Display player lives as heart icons in the top right corner using smaller heart icons ---
    this.playerHearts = [];
    const marginRight = 10;
    const marginTop = 10;
    const heartSpacing = 5; // Spacing between each heart
    for (let i = 0; i < this.playerLives; i++) {
      // Compute x position so the hearts align from the right edge inward.
      let x = this.cameras.main.width - marginRight - (16 + heartSpacing) * i - 16;
      let y = marginTop;
      let heart = this.add.image(x, y, 'heart');
      heart.setOrigin(0, 0);
      heart.setDepth(1000);
      this.playerHearts.push(heart);
    }

    // --- Create the level grid ---
    // We'll store the grid in a 2D array:
    // 0 = empty, 1 = solid wall, 2 = destructible block
    this.level = [];
    // Create separate groups for floor, solid walls, and destructible blocks
    this.floorGroup = this.add.group();
    this.wallGroup = this.physics.add.staticGroup();
    this.destructibleGroup = this.physics.add.staticGroup();

    for (let row = 0; row < gridRows; row++) {
      this.level[row] = [];
      for (let col = 0; col < gridCols; col++) {
        let x = col * tileSize + tileSize / 2;
        let y = row * tileSize + tileSize / 2;
        // Always create a floor tile
        this.floorGroup.create(x, y, 'floor');
        // Create border walls
        if (row === 0 || row === gridRows - 1 || col === 0 || col === gridCols - 1) {
          this.wallGroup.create(x, y, 'solid');
          this.level[row][col] = 1;
        } else if (row % 2 === 0 && col % 2 === 0) {
          // Place inner solid walls in a checkered pattern
          this.wallGroup.create(x, y, 'solid');
          this.level[row][col] = 1;
        } else {
          // Removed destructible blocks: all cells remain empty.
          this.level[row][col] = 0;
        }
      }
    }

    // --- Create Player ---
    // The player spawns in cell (1,1)
    this.player = this.physics.add.sprite(tileSize + tileSize / 2, tileSize + tileSize / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.moving = false;
    // Reduce the player's physics body size to better match the drawn circle (default body is 32x32)
    this.player.body.setSize(tileSize * 0.8, tileSize * 0.8);
    this.player.body.setOffset(tileSize * 0.1, tileSize * 0.1);

    // Enable collisions between the player and the walls/destructible blocks
    this.physics.add.collider(this.player, this.wallGroup);
    this.physics.add.collider(this.player, this.destructibleGroup);

    // --- Input ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Added: Number keys (1-9) for bomb placement with custom fire range.
    this.numKeys = this.input.keyboard.addKeys({
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
      six: Phaser.Input.Keyboard.KeyCodes.SIX,
      seven: Phaser.Input.Keyboard.KeyCodes.SEVEN,
      eight: Phaser.Input.Keyboard.KeyCodes.EIGHT,
      nine: Phaser.Input.Keyboard.KeyCodes.NINE
    });
    
    this.numberToFireRange = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9
    };

    // Keep track of bombs dropped
    this.bombs = [];
    
    // --- Create Monster ---
    // Replace inline monster creation with a helper method.
    this.spawnMonster();
    
    // Schedule monster movement every 1000ms
    this.monsterTimer = this.time.addEvent({
      delay: this.monsterMoveDelay,
      callback: this.moveMonster,
      callbackScope: this,
      loop: true
    });
  }

  update(time, delta) {
    // --- Grid-based Player Movement ---
    if (!this.player.moving) {
      let direction = null;
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
          direction = { dx: -1, dy: 0 };
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
          direction = { dx: 1, dy: 0 };
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
          direction = { dx: 0, dy: -1 };
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
          direction = { dx: 0, dy: 1 };
      }

      if (direction !== null) {
          let currentCol = Math.floor(this.player.x / tileSize);
          let currentRow = Math.floor(this.player.y / tileSize);
          let newCol = currentCol + direction.dx;
          let newRow = currentRow + direction.dy;

          if (newCol < 0 || newCol >= gridCols || newRow < 0 || newRow >= gridRows) {
              // Invalid move.
          } else if (this.level[newRow][newCol] !== 0) {
              // Blocked move.
          } else if (this.bombs.some(b => b.row === newRow && b.col === newCol)) {
              // Blocked move: There's a bomb in the target cell.
          } else if (this.monster && 
                     Math.floor(this.monster.x / tileSize) === newCol && 
                     Math.floor(this.monster.y / tileSize) === newRow) {
              // Blocked move: Monster is occupying the target cell.
          } else {
              let targetX = newCol * tileSize + tileSize / 2;
              let targetY = newRow * tileSize + tileSize / 2;
              this.player.moving = true;
              this.tweens.add({
                  targets: this.player,
                  x: targetX,
                  y: targetY,
                  duration: 150,
                  onComplete: () => {
                      this.player.moving = false;
                  }
              });
          }
      }
    }

    // --- Bomb Placement via Number Keys ---
    for (let key in this.numKeys) {
      if (Phaser.Input.Keyboard.JustDown(this.numKeys[key])) {
        let fireRange = this.numberToFireRange[key];
        this.placeBomb(fireRange);
        break; // Only process one bomb placement per frame.
      }
    }

    // --- Bomb Placement with Space Key (default fire range = 1) ---
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.placeBomb(); 
    }

    // Update the position of the monster's text to follow the monster sprite.
    if (this.monster && this.monsterText) {
      this.monsterText.setPosition(this.monster.x, this.monster.y);
    }
  }

  placeBomb(range = 1) {
    // Snap the player's position to the grid cell
    let col = Math.floor(this.player.x / tileSize);
    let row = Math.floor(this.player.y / tileSize);
    // Prevent placing multiple bombs in the same cell
    if (this.bombs.some(b => b.row === row && b.col === col)) return;
    let x = col * tileSize + tileSize / 2;
    let y = row * tileSize + tileSize / 2;
    let bomb = this.physics.add.sprite(x, y, 'bomb');
    bomb.row = row;
    bomb.col = col;
    bomb.setImmovable(true);
    
    // Set the bomb's fire range based on the parameter
    bomb.fireRange = range;
    // Create text to display the fire range on top of the bomb.
    let fireRangeText = this.add.text(x, y, bomb.fireRange, { font: '16px Arial', fill: '#ffffff' });
    fireRangeText.setOrigin(0.5);
    this.children.bringToTop(fireRangeText);
    bomb.fireRangeText = fireRangeText;
    
    this.bombs.push(bomb);
    // Updated: Calculate explosion delay based on the formula
    let explodeBombDelay = 3000 + (range - 1) * 100;
    // Store the delayed call ID for explosion
    bomb.delayedCallId = this.time.delayedCall(explodeBombDelay, () => {
      this.explodeBomb(bomb);
    }, [], this);
  }

  explodeBomb(bomb, chainData) {
    // Remove any pending explosion delayed call.
    if (bomb.delayedCallId) {
      bomb.delayedCallId.remove();
    }
    // If bomb already exploded, skip.
    if (!this.bombs.includes(bomb)) return;

    // If no chainData is passed, initialize it with the current bomb's fire range.
    // Otherwise, add the current bomb's fire range to the running total.
    if (!chainData) {
      chainData = { product: bomb.fireRange };
    } else {
      chainData.product = chainData.product * bomb.fireRange;
    }

    // Remove bomb from active bombs.
    this.bombs = this.bombs.filter(b => b !== bomb);

    // --- Create explosion at the bomb's cell with the cumulative chain product ---
    this.createExplosion(bomb.row, bomb.col, chainData.product);

    // Explosion propagates in each direction based on bomb.fireRange
    const directions = [
      { dx: 0, dy: -1 }, // up
      { dx: 0, dy: 1 },  // down
      { dx: -1, dy: 0 }, // left
      { dx: 1, dy: 0 }   // right
    ];

    directions.forEach(dir => {
      for (let i = 1; i <= bomb.fireRange; i++) {
        let r = bomb.row + dir.dy * i;
        let c = bomb.col + dir.dx * i;
        // Check grid boundaries
        if (r < 0 || r >= gridRows || c < 0 || c >= gridCols) break;
        // Stop propagation if a solid wall is encountered
        if (this.level[r][c] === 1) break;
        // Create explosion effect in the cell with the current chain product value.
        this.createExplosion(r, c, chainData.product);
        // Remove destructible block and stop further propagation if hit.
        if (this.level[r][c] === 2) {
          let blocks = this.destructibleGroup.getChildren();
          for (let j = 0; j < blocks.length; j++) {
            let blk = blocks[j];
            let blkRow = Math.floor(blk.y / tileSize);
            let blkCol = Math.floor(blk.x / tileSize);
            if (blkRow === r && blkCol === c) {
              blk.disableBody(true, true);
              break;
            }
          }
          this.level[r][c] = 0;
          break;
        }
        // Trigger chain reaction: if another bomb is found at this cell.
        let bombAtCell = this.bombs.find(b => b.row === r && b.col === c);
        if (bombAtCell) {
          this.explodeBomb(bombAtCell, chainData);
          break;
        }
      }
    });

    if (bomb.fireRangeText) {
      bomb.fireRangeText.destroy();
    }
    bomb.destroy();
  }

  createExplosion(row, col, chainValue) {
    let x = col * tileSize + tileSize / 2;
    let y = row * tileSize + tileSize / 2;
    let explosion = this.add.sprite(x, y, 'explosion');
    // Remove the explosion after a brief moment (500ms)
    this.time.delayedCall(500, () => {
      explosion.destroy();
    }, [], this);

    // Display chainValue on the explosion (if provided)
    if (chainValue !== undefined) {
      let explosionText = this.add.text(x, y, chainValue, { font: '16px Arial', fill: '#ffffff' });
      explosionText.setOrigin(0.5);
      this.time.delayedCall(500, () => {
        explosionText.destroy();
      }, [], this);
    }

    // Check if the explosion hit the player – if so, restart the scene.
    let playerRow = Math.floor(this.player.y / tileSize);
    let playerCol = Math.floor(this.player.x / tileSize);
    if (playerRow === row && playerCol === col) {
      console.log('Player hit by explosion!');
      this.time.delayedCall(500, () => {
        this.scene.restart();
      }, [], this);
    }

    // --- New: Check if the explosion hit the monster ---
    if (this.monster) {
      let monsterRow = Math.floor(this.monster.y / tileSize);
      let monsterCol = Math.floor(this.monster.x / tileSize);
      if (monsterRow === row && monsterCol === col) {
        // Only destroy the monster if the chainValue matches its value.
        if (chainValue === this.monster.value) {
          console.log('Monster hit by explosion with matching value! Destroying monster.');
          if (this.monsterText) {
            this.monsterText.destroy();
          }
          this.monster.destroy();
          this.monster = null;
          // Increment success count since the monster was destroyed.
          this.successCnt += 1;
          // Update the UI text to reflect the new success count.
          this.levelText.setText("Level: " + this.gameLevel + "  Score: " + this.successCnt);
          this.updateToNextLevelIfNeeded();
          // Spawn a new monster one second after destruction.
          this.time.delayedCall(1000, () => {
            this.spawnMonster();
          }, [], this);
        }
      }
    }
  }

  moveMonster() {
    if (!this.monster || this.monster.moving) return;

    let monsterCol = Math.floor(this.monster.x / tileSize);
    let monsterRow = Math.floor(this.monster.y / tileSize);
    let playerCol = Math.floor(this.player.x / tileSize);
    let playerRow = Math.floor(this.player.y / tileSize);

    let diffCol = playerCol - monsterCol;
    let diffRow = playerRow - monsterRow;

    // Determine preferred move order: try the direction with the larger difference first
    let moves = [];
    if (Math.abs(diffCol) >= Math.abs(diffRow)) {
      if (diffCol !== 0) moves.push({ dx: Math.sign(diffCol), dy: 0 });
      if (diffRow !== 0) moves.push({ dx: 0, dy: Math.sign(diffRow) });
    } else {
      if (diffRow !== 0) moves.push({ dx: 0, dy: Math.sign(diffRow) });
      if (diffCol !== 0) moves.push({ dx: Math.sign(diffCol), dy: 0 });
    }
    
    let chosenMove = null;
    for (let move of moves) {
      let newCol = monsterCol + move.dx;
      let newRow = monsterRow + move.dy;
      // Check grid boundaries and that the cell is empty (level cell value 0)
      if (newCol < 0 || newCol >= gridCols || newRow < 0 || newRow >= gridRows) continue;
      if (this.level[newRow][newCol] !== 0) continue;
      if (this.bombs.some(b => b.row === newRow && b.col === newCol)) continue; // New: Skip if bomb is present in target cell.
      chosenMove = move;
      break;
    }

    if (chosenMove) {
      let targetX = (monsterCol + chosenMove.dx) * tileSize + tileSize / 2;
      let targetY = (monsterRow + chosenMove.dy) * tileSize + tileSize / 2;
      this.monster.moving = true;
      this.tweens.add({
        targets: this.monster,
        x: targetX,
        y: targetY,
        duration: 150,
        onComplete: () => {
          if (this.monster) {
            this.monster.moving = false;
            // Check if the monster has reached the player's cell
            let newMonsterCol = Math.floor(this.monster.x / tileSize);
            let newMonsterRow = Math.floor(this.monster.y / tileSize);
            if (newMonsterRow === playerRow && newMonsterCol === playerCol) {
              console.log('Player caught by monster!');
              this.scene.restart();
            }
          }
        }
      });
    }
  }

  // Generates a random non-prime number.
  generateMonsterValue(level) {
    let rnd = Phaser.Math.Between(1, 9);
    return (level === 1) ? rnd : rnd * this.generateMonsterValue(level - 1);
  }

  // --- New: Helper method to spawn a monster ---
  spawnMonster() {
    this.monster = this.physics.add.sprite(
      (gridCols - 2) * tileSize + tileSize / 2,
      (gridRows - 2) * tileSize + tileSize / 2,
      'monster'
    );
    this.monster.setCollideWorldBounds(true);
    this.monster.moving = false;
    this.monster.value = this.generateMonsterValue(this.monsterLevel);
    this.monsterText = this.add.text(this.monster.x, this.monster.y, this.monster.value, { font: '16px Arial', fill: '#ffffff' });
    this.monsterText.setOrigin(0.5);
  }

  getNextGameLevelSuccessCntTarget(currentLevel) {
    return currentLevel * 2;
  }

  // --- New: Helper method to update to the next level if needed ---
  updateToNextLevelIfNeeded() {
    let nextGameLevelSuccessCntTarget = this.getNextGameLevelSuccessCntTarget(this.gameLevel);
    if (this.successCnt >= nextGameLevelSuccessCntTarget) {
      this.gameLevel += 1;
      this.levelText.setText("Level: " + this.gameLevel + "  Score: " + this.successCnt);

      this.monsterMoveDelay -= 80;
      if ((this.gameLevel === 2) || (this.gameLevel === 11) || (this.gameLevel === 21)) {
        this.monsterLevel += 1;
        this.monsterMoveDelay = 1000;
      }

      // Refresh monster timer with the updated move delay
      if (this.monsterTimer) {
        this.monsterTimer.remove();
      }
      this.monsterTimer = this.time.addEvent({
        delay: this.monsterMoveDelay,
        callback: this.moveMonster,
        callbackScope: this,
        loop: true
      });
    }
  }
}

// --- Game Configuration ---
const config = {
  type: Phaser.AUTO,
  width: gridCols * tileSize,
  height: gridRows * tileSize,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: GameScene
};

// Initialize the Phaser game
const game = new Phaser.Game(config); 