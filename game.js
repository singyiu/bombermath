// Define grid and tile constants
const tileSize = 32;
const gridCols = 15;
const gridRows = 13;

class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // No external assets are loaded.
  }

  create() {
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
          // Reserve a clear spawn area at top-left: cells (1,1), (1,2), (2,1)
          if ((row === 1 && col < 3) || (col === 1 && row < 3)) {
            this.level[row][col] = 0;
          } else {
            // Randomly place destructible blocks
            if (Math.random() < 0.7) {
              this.destructibleGroup.create(x, y, 'destructible');
              this.level[row][col] = 2;
            } else {
              this.level[row][col] = 0;
            }
          }
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
    // Store the delayed call ID for explosion
    bomb.delayedCallId = this.time.delayedCall(2000, () => {
      this.explodeBomb(bomb);
    }, [], this);
  }

  explodeBomb(bomb) {
    if (bomb.delayedCallId) {
      bomb.delayedCallId.remove();
    }
    if (!this.bombs.includes(bomb)) return;
    this.bombs = this.bombs.filter(b => b !== bomb);

    // Create explosion at the bomb's cell
    this.createExplosion(bomb.row, bomb.col);

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
        // Create explosion effect in the cell
        this.createExplosion(r, c);
        // Remove destructible block and stop further propagation if hit
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
        // Trigger nearby bombs for chain reactions
        let bombAtCell = this.bombs.find(b => b.row === r && b.col === c);
        if (bombAtCell) {
          this.explodeBomb(bombAtCell);
        }
      }
    });

    if (bomb.fireRangeText) {
      bomb.fireRangeText.destroy();
    }
    bomb.destroy();
  }

  createExplosion(row, col) {
    let x = col * tileSize + tileSize / 2;
    let y = row * tileSize + tileSize / 2;
    let explosion = this.add.sprite(x, y, 'explosion');
    // Remove the explosion after a brief moment (300ms)
    this.time.delayedCall(300, () => {
      explosion.destroy();
    }, [], this);
    // Check if the explosion hit the player – if so, restart the scene
    let playerRow = Math.floor(this.player.y / tileSize);
    let playerCol = Math.floor(this.player.x / tileSize);
    if (playerRow === row && playerCol === col) {
      console.log('Player hit by explosion!');
      this.scene.restart();
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