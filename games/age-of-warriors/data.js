// Age of Warriors — warrior roster, weapons and era data.
//
// Warriors come from Spike TV's "Deadliest Warrior" (2009–2011) plus added
// Mesoamerican and Andean warriors (Aztec Eagle, Maya, Inca) that never
// appeared on the show. Each warrior keeps the show's four weapon slots:
// short range, mid range, long range and special.
//
// power: 1–10 game rating of how lethal the weapon is. It drives damage in
// the game (see weapon tuning in game.js). These are balance numbers, not the
// show's simulated kill counts.
//
// show: matchup and result. A result appears only where it was confirmed
// against published episode guides; the rest list the opponent alone.
// Weapon lists follow the show where sources confirm them (Apache, Gladiator,
// Spartan, Samurai, Viking, Yakuza, Mafia, Green Beret, Spetsnaz, Washington,
// Napoleon, Joan of Arc, William the Conqueror); the rest use each warrior's
// historically documented weapons.
//
// Weapon tuple: [name, slot, power, options]
//   options: k weapon kind override, r range, cd cooldown (s), ammo thrown uses, pierce 0–1 armor
//   ignored, proj projectile look, fx special effect, n volley size,
//   aoe blast radius.
// Special fx: shield, stun, charge, splash, volley, poison, fire, flurry,
//   rally, fear, snipe, hornets.

window.AOW_DATA = (() => {
  const eras = [
    {
      id: 'ancient', name: 'Ancient Era', span: '500 BC – AD 450',
      xp: 0, baseHp: 1000, hpMul: 1, dmgMul: 1, costMul: 1,
      sky: ['#e9a56a', '#f6d8a6'], far: '#b9805a', near: '#8d5b3d', ground: '#a8794b', dirt: '#7f5734',
      ability: { name: 'Arrow Storm', desc: 'A sky of arrows falls on the enemy line.', proj: 'arrow', n: 26, power: 5, cd: 45 },
      turrets: [
        { id: 'scorpio', name: 'Scorpio Bolt Thrower', power: 7, cd: 1.6, r: 340, proj: 'bolt', pierce: 0.6, cost: 110 },
        { id: 'onager', name: 'Onager', power: 8, cd: 3.4, r: 380, proj: 'stone', aoe: 50, cost: 160 },
      ],
    },
    {
      id: 'medieval', name: 'Age of Steel', span: '500 – 1500',
      xp: 700, baseHp: 1800, hpMul: 1.9, dmgMul: 1.9, costMul: 2.2,
      sky: ['#5f6f7a', '#b9c2bd'], far: '#6b7470', near: '#4b5450', ground: '#6f7552', dirt: '#4d5236',
      ability: { name: 'Greek Fire', desc: 'Clay pots of liquid fire burst across the field.', proj: 'fire', n: 14, power: 6, cd: 48, fire: true },
      turrets: [
        { id: 'springald', name: 'Springald', power: 7, cd: 1.3, r: 350, proj: 'bolt', pierce: 0.5, cost: 240 },
        { id: 'trebuchet', name: 'Trebuchet', power: 9, cd: 3.6, r: 400, proj: 'stone', aoe: 62, cost: 340 },
      ],
    },
    {
      id: 'sun', name: 'Empires of Sun & Plains', span: '1300 – 1880',
      xp: 2400, baseHp: 3000, hpMul: 3.2, dmgMul: 3.2, costMul: 4.6,
      sky: ['#2f8a7c', '#e9c46a'], far: '#3f6e4a', near: '#2c5236', ground: '#7a6a3a', dirt: '#56492a',
      ability: { name: 'Atlatl Barrage', desc: 'Hundreds of atlatl darts rain down.', proj: 'dart', n: 30, power: 6, cd: 48 },
      turrets: [
        { id: 'slingers', name: 'Huaraca Sling Tower', power: 6, cd: 0.9, r: 330, proj: 'stone', cost: 480 },
        { id: 'hornets', name: 'Hornet-Nest Catapult', power: 8, cd: 3.2, r: 380, proj: 'nest', aoe: 60, dot: true, cost: 700 },
      ],
    },
    {
      id: 'powder', name: 'Age of Powder', span: '1500 – 1890',
      xp: 6500, baseHp: 4600, hpMul: 5.2, dmgMul: 5.2, costMul: 9,
      sky: ['#7c6a5a', '#d8c3a0'], far: '#7d6b58', near: '#5a4c3f', ground: '#6e5b45', dirt: '#4c3e30',
      ability: { name: 'Cannon Barrage', desc: 'A battery of field guns shells the enemy.', proj: 'shell', n: 10, power: 9, cd: 50, aoe: 60 },
      turrets: [
        { id: 'swivel', name: 'Swivel Gun', power: 6, cd: 0.9, r: 330, proj: 'bullet', cost: 950 },
        { id: 'cannon', name: 'Field Cannon', power: 9, cd: 3.2, r: 420, proj: 'shell', aoe: 70, cost: 1350 },
      ],
    },
    {
      id: 'modern', name: 'Modern Warfare', span: '1898 – today',
      xp: 16000, baseHp: 7000, hpMul: 8.2, dmgMul: 8.2, costMul: 17,
      sky: ['#1d2b3a', '#56708a'], far: '#2d3b48', near: '#1f2a34', ground: '#4a4f4a', dirt: '#33372f',
      ability: { name: 'Airstrike', desc: 'Jets drop bombs along the enemy front.', proj: 'bomb', n: 12, power: 10, cd: 55, aoe: 70 },
      turrets: [
        { id: 'm2', name: 'M2 Browning .50', power: 5, cd: 0.28, r: 360, proj: 'bullet', cost: 1800 },
        { id: 'mortar', name: 'M252 Mortar', power: 9, cd: 3, r: 440, proj: 'shell', aoe: 80, cost: 2600 },
      ],
    },
  ];

  // look: skin, body (tunic), legs, helm type, hc (helm color), plume,
  // shield color, cape color, mounted.
  const L = (skin, body, legs, helm, hc, extra = {}) => ({ skin, body, legs, helm, hc, ...extra });
  const S = { light: '#e2b48c', tan: '#c99067', mid: '#a86e47', brown: '#7a4b2c', dark: '#5a3620' };

  // W(id, name, era, role, origin, show, look, weapons, extra)
  const warriors = [];
  const W = (id, name, era, role, origin, show, look, weapons, extra = {}) =>
    warriors.push({ id, name, era, role, origin, show, look, weapons, ...extra });

  // ── Ancient Era ─────────────────────────────────────────────────────────
  W('spartan', 'Spartan', 0, 'heavy', 'Sparta, Greece · 5th c. BC', 'S1 · vs Ninja · Won',
    L(S.tan, '#8f2a1f', '#6b3b22', 'crest', '#b8913a', { plume: '#9c1d1d', shield: '#b8862e', cape: '#7a1f1a' }),
    [['Xiphos', 'short', 6], ['Dory', 'mid', 7, { r: 52 }], ['Javelin', 'long', 6, { ammo: 2 }], ['Aspis', 'special', 9, { fx: 'shield' }]]);
  W('centurion', 'Roman Centurion', 0, 'heavy', 'Roman Empire · 1st c.', 'S2 · vs Rajput',
    L(S.tan, '#9b2a24', '#5c3b25', 'crest', '#a7a9a8', { plume: '#c8312b', crossPlume: true, shield: '#9b2a24', cape: '#6f1f1a' }),
    [['Pugio', 'short', 4], ['Gladius', 'mid', 8, { r: 34 }], ['Pilum', 'long', 7, { ammo: 2, pierce: 0.6 }], ['Scutum', 'special', 8, { fx: 'shield' }]]);
  W('gladiator', 'Gladiator', 0, 'infantry', 'Roman arena · 1st c.', 'S1 · vs Apache · Lost',
    L(S.mid, '#c8a25a', '#7b5a3a', 'gladiator', '#9ea3a6', {}),
    [['Cestus', 'short', 5], ['Scissor', 'short', 7], ['Trident & Net', 'mid', 7, { r: 52 }], ['Sling', 'long', 5], ['Sica', 'special', 7, { fx: 'flurry' }]]);
  W('celt', 'Celt', 0, 'infantry', 'Gaul and Britain · 1st c. BC', 'S2 · vs Persian Immortal',
    L(S.light, '#3f6b3a', '#8a6a3c', 'celt', '#c9a23a', { cape: '#5b7e3d', shield: '#3b5a8a' }),
    [['Dagger', 'short', 4], ['Long Sword', 'mid', 8, { r: 36 }], ['Sling', 'long', 6], ['War Chariot', 'special', 8, { fx: 'charge' }]]);
  W('immortal', 'Persian Immortal', 0, 'ranged', 'Achaemenid Persia · 5th c. BC', 'S2 · vs Celt',
    L(S.mid, '#5a3d7a', '#3a2a55', 'tiara', '#e6d6b0', { shield: '#a07b3a' }),
    [['Sagaris', 'short', 6], ['Spear', 'mid', 6], ['Composite Bow', 'long', 7], ['Scythed Chariot', 'special', 7, { fx: 'charge' }]]);
  W('alexander', 'Alexander the Great', 0, 'hero', 'Macedon · 336–323 BC', 'S2 · vs Attila the Hun · Lost',
    L(S.light, '#b8913a', '#6a2a5a', 'crest', '#e0c46a', { plume: '#f2f0e6', cape: '#6a2a5a', mounted: '#3a2a20' }),
    [['Kopis', 'short', 7], ['Sarissa', 'mid', 8, { r: 62 }], ['Gastraphetes', 'long', 6], ['Companion Cavalry', 'special', 9, { fx: 'charge' }]]);
  W('hannibal', 'Hannibal Barca', 0, 'hero', 'Carthage · 247–181 BC', 'S3 · vs Genghis Khan',
    L(S.mid, '#6e2a3a', '#4a2a22', 'crest', '#b8913a', { plume: '#2a2a2a', cape: '#3a2a55' }),
    [['Falcata', 'short', 8], ['Iberian Spear', 'mid', 6], ['Balearic Sling', 'long', 7], ['War Elephant', 'special', 10, { fx: 'charge' }]]);
  W('attila', 'Attila the Hun', 0, 'hero', 'Hunnic Empire · AD 434–453', 'S2 · vs Alexander the Great · Won',
    L(S.tan, '#6b4a2a', '#3e2e22', 'fur', '#7a5a3a', { cape: '#3e2e22', mounted: '#5a3a26' }),
    [['Hunnic Sword', 'short', 7], ['Kontos Lance', 'mid', 7, { r: 56 }], ['Hunnic Bow', 'long', 9], ['Lasso', 'special', 7, { fx: 'stun', r: 96 }]]);
  W('suntzu', 'Sun Tzu', 0, 'hero', 'Zhou China · 5th c. BC', 'S2 · vs Vlad the Impaler',
    L(S.light, '#2f4a6a', '#20324a', 'guan', '#1a1a1a', { cape: '#8a2a22' }),
    [['Jian', 'short', 6], ['Ji', 'mid', 7, { r: 54 }], ['Repeating Crossbow', 'long', 7, { cd: 0.9 }], ['Fire Arrows', 'special', 8, { fx: 'fire' }]]);

  // ── Age of Steel ────────────────────────────────────────────────────────
  W('viking', 'Viking', 1, 'heavy', 'Scandinavia · 8th–11th c.', 'S1 · vs Samurai · Lost',
    L(S.light, '#5a6a7a', '#6a4a2a', 'horned', '#8a8f92', { shield: '#a8322a', beard: '#c9883a' }),
    [['Long Sword', 'short', 7], ['Great Axe', 'mid', 8], ['Spear', 'long', 6, { k: 'throw', ammo: 1 }], ['Shield', 'special', 7, { fx: 'shield' }]]);
  W('samurai', 'Samurai', 1, 'infantry', 'Feudal Japan · 12th–16th c.', 'S1 · vs Viking · Won',
    L(S.light, '#9a2b2b', '#2a2a2a', 'kabuto', '#2a2a2a', { plume: '#c9a23a' }),
    [['Katana', 'short', 9], ['Naginata', 'mid', 8, { r: 56 }], ['Yumi', 'long', 7], ['Kanabo', 'special', 7, { fx: 'stun', r: 34 }]]);
  W('knight', 'Knight', 1, 'heavy', 'Western Europe · 14th c.', 'S1 · vs Pirate · Lost',
    L(S.light, '#b9bec2', '#8a8f92', 'greathelm', '#c4c8cb', { plume: '#2f4f8a', shield: '#2f4f8a' }),
    [['Broadsword', 'short', 7], ['Halberd', 'mid', 8, { r: 54 }], ['Crossbow', 'long', 8, { pierce: 0.5 }], ['Morning Star', 'special', 8, { fx: 'stun', r: 34 }]], { armor: 0.4 });
  W('ninja', 'Ninja', 1, 'infantry', 'Feudal Japan · 15th–17th c.', 'S1 · vs Spartan · Lost',
    L(S.light, '#1d1f24', '#1d1f24', 'hood', '#1d1f24', {}),
    [['Ninjato', 'short', 7], ['Kusari-gama', 'mid', 6, { r: 58 }], ['Shuriken', 'long', 4, { r: 140 }], ['Blowgun', 'special', 6, { fx: 'poison' }]], { speed: 1.35, armor: 0 });
  W('shaolin', 'Shaolin Monk', 1, 'infantry', 'Henan, China · 16th c.', 'S1 · vs Maori',
    L(S.tan, '#d98a2b', '#a85a1a', 'bald', S.tan, {}),
    [['Emei Piercers', 'short', 5], ['Three-Section Staff', 'mid', 6, { r: 50 }], ['Rope Dart', 'long', 5, { r: 120, proj: 'dart' }], ['Twin Hook Swords', 'special', 7, { fx: 'flurry' }]], { speed: 1.15 });
  W('mongol', 'Mongol', 1, 'ranged', 'Mongol Empire · 13th c.', 'S2 · vs Comanche',
    L(S.tan, '#3a5a8a', '#5a3a26', 'mongol', '#7a5a3a', { mounted: '#8a6a4a' }),
    [['Ild Sword', 'short', 6], ['Jida Lance', 'mid', 6, { r: 56 }], ['Composite Bow', 'long', 9], ['Horse Archer Volley', 'special', 7, { fx: 'volley' }]], { speed: 1.3 });
  W('rajput', 'Rajput', 1, 'infantry', 'Rajputana, India · 12th–16th c.', 'S2 · vs Roman Centurion',
    L(S.mid, '#e0b24a', '#a8322a', 'turban', '#d84a2a', { shield: '#6a4a2a' }),
    [['Katar', 'short', 6], ['Khanda', 'mid', 7, { r: 36 }], ['Chakram', 'long', 5, { ammo: 3 }], ['Aara Whip-Sword', 'special', 6, { fx: 'flurry' }]]);
  W('ming', 'Ming Warrior', 1, 'ranged', 'Ming China · 14th–17th c.', 'S2 · vs Musketeer',
    L(S.light, '#a8322a', '#2a2a2a', 'ming', '#2a2a2a', { plume: '#a8322a' }),
    [['Dao', 'short', 6], ['Guan Dao', 'mid', 7, { r: 54 }], ['Rocket Arrows', 'long', 6, { proj: 'rocket' }], ['Fire Lance', 'special', 7, { fx: 'fire', r: 120 }]]);
  W('wallace', 'William Wallace', 1, 'hero', 'Scotland · 1270–1305', 'S1 · vs Shaka Zulu',
    L(S.light, '#2f5a3a', '#3a5a8a', 'none', '#b8662a', { kilt: true, shield: '#7a5a3a', cape: '#2f4f8a', paint: '#3a6ab0' }),
    [['Targe & Dirk', 'short', 6], ['Claymore', 'mid', 9, { r: 40 }], ['Ball & Chain', 'mid', 7], ['Highland War Cry', 'special', 8, { fx: 'rally' }]]);
  W('joan', 'Joan of Arc', 1, 'hero', 'France · 1412–1431', 'S3 · vs William the Conqueror',
    L(S.light, '#c4c8cb', '#8a8f92', 'none', '#5a3a26', { shortHair: true, cape: '#2f4f8a', shield: '#2f4f8a' }),
    [['French Arming Sword', 'short', 7], ['Lance', 'mid', 7, { r: 56 }], ['Iron Crossbow', 'long', 7], ['Siege Cannon', 'special', 9, { fx: 'splash' }]]);
  W('conqueror', 'William the Conqueror', 1, 'hero', 'Normandy · 1028–1087', 'S3 · vs Joan of Arc',
    L(S.light, '#8a8f92', '#5a3a26', 'nasal', '#9ea3a6', { shield: '#a8322a', kite: true, mounted: '#3a2a20' }),
    [['Norman Broadsword', 'short', 8], ['Couched Lance', 'mid', 7, { r: 58 }], ['Composite Crossbow', 'long', 7], ['Torsion Catapult', 'special', 9, { fx: 'splash' }]]);
  W('vlad', 'Vlad the Impaler', 1, 'hero', 'Wallachia · 1428–1477', 'S2 · vs Sun Tzu',
    L(S.light, '#6a1a2a', '#2a1a1a', 'cap', '#6a1a2a', { plume: '#e0c46a', cape: '#2a1a1a', mustache: true }),
    [['Kilij', 'short', 7], ['Halberd', 'mid', 8, { r: 54 }], ['Hand Cannon', 'long', 6, { r: 170, proj: 'bullet' }], ['Impalement Terror', 'special', 8, { fx: 'fear' }]]);
  W('genghis', 'Genghis Khan', 1, 'hero', 'Mongol Empire · 1162–1227', 'S3 · vs Hannibal',
    L(S.tan, '#8a2a22', '#3a2a22', 'mongol', '#b8913a', { cape: '#3a2a22', mounted: '#e2d6c0', mustache: true }),
    [['Turko-Mongol Sabre', 'short', 8], ['Lance', 'mid', 7, { r: 56 }], ['Mongol Bow', 'long', 9], ['Mangonel Fire Pots', 'special', 8, { fx: 'splash' }]]);

  // ── Empires of Sun & Plains ─────────────────────────────────────────────
  W('jaguar', 'Aztec Jaguar', 2, 'infantry', 'Aztec Empire · 15th–16th c.', 'S2 · vs Zande Warrior',
    L(S.mid, '#d8a23a', '#d8a23a', 'jaguar', '#d8a23a', { spots: true, shield: '#2f6a8a' }),
    [['Macuahuitl', 'short', 9], ['Tepoztopilli', 'mid', 7, { r: 52 }], ['Atlatl', 'long', 7], ['Jaguar Pounce', 'special', 7, { fx: 'charge' }]]);
  W('eagle', 'Aztec Eagle Warrior', 2, 'infantry', 'Aztec Empire · 15th–16th c.', 'Added · not on the show',
    L(S.mid, '#e6dccb', '#c9a23a', 'eagle', '#f0e6d0', { shield: '#a8322a', feathers: '#2f8a6a' }),
    [['Tecpatl Knife', 'short', 4], ['Macuahuitl', 'mid', 8, { r: 34 }], ['Tlahuitolli Bow', 'long', 6], ['Chimalli Shield', 'special', 7, { fx: 'shield' }]]);
  W('holkan', 'Maya Holkan', 2, 'infantry', 'Maya city-states · 8th–16th c.', 'Added · not on the show',
    L(S.mid, '#2f8a7c', '#e6dccb', 'maya', '#2f8a7c', { feathers: '#2f8a7c', paint: '#a8322a' }),
    [['Obsidian Knife', 'short', 4], ['Thrusting Spear', 'mid', 7, { r: 54 }], ['Atlatl', 'long', 6], ['Hornet-Nest Bomb', 'special', 6, { fx: 'hornets' }]]);
  W('inca', 'Inca Warrior', 2, 'infantry', 'Inca Empire · 15th–16th c.', 'Added · not on the show',
    L(S.mid, '#c8312b', '#2a2a2a', 'inca', '#e0c46a', { checker: true, shield: '#e0c46a' }),
    [['Tumi', 'short', 4], ['Champi Star Mace', 'mid', 8], ['Huaraca Sling', 'long', 7], ['Liwi Bola', 'special', 6, { fx: 'stun', r: 130 }]]);
  W('maori', 'Maori', 2, 'infantry', 'Aotearoa (New Zealand) · 18th–19th c.', 'S1 · vs Shaolin Monk',
    L(S.mid, '#5a3a26', '#3a2a1a', 'topknot', '#1a1a1a', { moko: true, skirt: true }),
    [['Mere', 'short', 7], ['Taiaha', 'mid', 8, { r: 50 }], ['Stingray Spear', 'long', 5, { ammo: 1 }], ['Haka', 'special', 7, { fx: 'fear' }]]);
  W('zande', 'Zande Warrior', 2, 'infantry', 'Central Africa · 19th c.', 'S2 · vs Aztec Jaguar',
    L(S.dark, '#8a6a3a', '#6a4a2a', 'zande', '#a8322a', { shield: '#c9a24a', skirt: true }),
    [['Makraka', 'short', 6], ['Spear', 'mid', 6, { r: 52 }], ['Kpinga', 'long', 8, { ammo: 3 }], ['Wicker Shield', 'special', 6, { fx: 'shield' }]]);
  W('apache', 'Apache', 2, 'ranged', 'American Southwest · 19th c.', 'S1 · vs Gladiator · Won',
    L(S.mid, '#c9a26a', '#6a4a2a', 'headband', '#a8322a', { longHair: true }),
    [['Tomahawk', 'short', 7], ['Knife', 'mid', 5], ['Bow & Arrow', 'long', 8], ['War Club', 'special', 6, { fx: 'stun', r: 34 }]], { speed: 1.15 });
  W('comanche', 'Comanche', 2, 'ranged', 'Southern Plains · 19th c.', 'S2 · vs Mongol',
    L(S.mid, '#a87a4a', '#6a4a2a', 'feather', '#f0e6d0', { longHair: true, mounted: '#e2d6c0', shield: '#d8c8a0' }),
    [['Steel Knife', 'short', 5], ['Lance', 'mid', 7, { r: 56 }], ['Bow', 'long', 8], ['Horseback Charge', 'special', 8, { fx: 'charge' }]], { speed: 1.3 });
  W('nacom', 'Maya Nacom', 2, 'hero', 'Maya war captain', 'Added · not on the show',
    L(S.mid, '#2f8a7c', '#e0c46a', 'quetzal', '#2f8a7c', { feathers: '#2f9a6a', cape: '#2f8a7c', paint: '#1a1a1a' }),
    [['Obsidian Blade', 'short', 7], ['War Club', 'mid', 8], ['Atlatl', 'long', 7], ['War Drums', 'special', 8, { fx: 'rally' }]]);
  W('shaka', 'Shaka Zulu', 2, 'hero', 'Zulu Kingdom · 1787–1828', 'S1 · vs William Wallace',
    L(S.dark, '#e6dccb', '#3a2a1a', 'zulu', '#1a1a1a', { shield: '#f0e6d0', cowhide: true, skirt: true }),
    [['Iklwa', 'short', 8], ['Iwisa Knobkerrie', 'mid', 6], ['Throwing Assegai', 'long', 6, { ammo: 2 }], ['Bull Horn Formation', 'special', 8, { fx: 'rally' }]]);
  W('crazyhorse', 'Crazy Horse', 2, 'hero', 'Oglala Lakota · c. 1840–1877', 'S3 · vs Pancho Villa',
    L(S.mid, '#c9a26a', '#5a3a26', 'feather', '#f0e6d0', { longHair: true, mounted: '#6a4a3a' }),
    [['Stone War Club', 'short', 7], ['Lance', 'mid', 6, { r: 56 }], ['Winchester 1873', 'long', 8], ['Decoy Charge', 'special', 8, { fx: 'charge' }]]);
  W('cuauhtemoc', 'Cuauhtémoc', 2, 'hero', 'Last Aztec emperor · 1497–1525', 'Added · not on the show',
    L(S.mid, '#c9a23a', '#2f6a8a', 'quetzal', '#e0c46a', { feathers: '#2f9a6a', cape: '#2f6a8a', shield: '#e0c46a' }),
    [['Macuahuitl', 'short', 9], ['Tepoztopilli', 'mid', 7, { r: 52 }], ['Atlatl', 'long', 7], ['Defense of Tenochtitlan', 'special', 8, { fx: 'rally' }]]);
  W('pachacuti', 'Pachacuti', 2, 'hero', 'Sapa Inca · 1438–1471', 'Added · not on the show',
    L(S.mid, '#e0c46a', '#a8322a', 'inca', '#e0c46a', { checker: true, cape: '#a8322a', shield: '#e0c46a' }),
    [['Champi', 'short', 8], ['Chuqui Lance', 'mid', 7, { r: 54 }], ['Huaraca Sling', 'long', 8], ['Pururauca Stones', 'special', 8, { fx: 'volley', proj: 'stone', n: 6 }]]);

  // ── Age of Powder ───────────────────────────────────────────────────────
  W('pirate', 'Pirate', 3, 'infantry', 'Caribbean · 17th–18th c.', 'S1 · vs Knight · Won',
    L(S.tan, '#e6dccb', '#3a3a5a', 'tricorn', '#1d1f24', { sash: '#a8322a', beard: '#2a1a1a' }),
    [['Cutlass', 'short', 6], ['Blunderbuss', 'mid', 8], ['Flintlock Pistol', 'long', 6, { cd: 2.4 }], ['Grenado', 'special', 7, { fx: 'splash' }]]);
  W('musketeer', 'Musketeer', 3, 'ranged', 'France · 17th c.', 'S2 · vs Ming Warrior',
    L(S.light, '#2f4f8a', '#5a3a26', 'cavalier', '#3a2a22', { plume: '#f0e6d0', cross: true, mustache: true }),
    [['Main Gauche', 'short', 5], ['Rapier', 'mid', 7, { r: 40 }], ['Matchlock Musket', 'long', 8, { cd: 2.6 }], ['Wheellock Pistol', 'special', 7, { fx: 'snipe', r: 160 }]]);
  W('conquistador', 'Conquistador', 3, 'heavy', 'Spain · 16th c. (Cortés’s soldiers)', 'Added · Hernán Cortés’s army',
    L(S.light, '#b9bec2', '#a8322a', 'morion', '#c4c8cb', { plume: '#a8322a', beard: '#2a1a1a' }),
    [['Toledo Sword', 'short', 8], ['Halberd', 'mid', 7, { r: 54 }], ['Arquebus', 'long', 7, { cd: 2.6 }], ['Steel Breastplate', 'special', 7, { fx: 'shield' }]], { armor: 0.35 });
  W('streltsy', 'Streltsy', 3, 'ranged', 'Russia · 16th c. (Ivan’s musketeers)', 'Added · Ivan the Terrible’s army',
    L(S.light, '#a8322a', '#e0c46a', 'streltsy', '#a8322a', { fur: '#5a3a26', beard: '#7a5a3a' }),
    [['Sabre', 'short', 6], ['Bardiche', 'mid', 8, { r: 50 }], ['Pishchal', 'long', 7, { cd: 2.4 }], ['Volley Fire', 'special', 7, { fx: 'volley', proj: 'bullet' }]]);
  W('continental', 'Continental Soldier', 3, 'ranged', 'American Revolution · 1775–1783', 'Added · George Washington’s army',
    L(S.light, '#2f3f6a', '#e6dccb', 'tricorn', '#1d1f24', { facing: '#e6dccb' }),
    [['Hanger Sword', 'short', 5], ['Bayonet', 'mid', 7, { r: 48 }], ['Pennsylvania Long Rifle', 'long', 8, { cd: 2.6 }], ['Grapeshot', 'special', 8, { fx: 'splash' }]]);
  W('grenadier', 'Old Guard Grenadier', 3, 'heavy', 'French Empire · 1804–1815', 'Added · Napoleon’s army',
    L(S.light, '#2f3f8a', '#e6dccb', 'bearskin', '#1d1f24', { plume: '#a8322a', facing: '#e6dccb' }),
    [['Briquet Sabre', 'short', 6], ['Charleville Bayonet', 'mid', 7, { r: 48 }], ['Charleville Musket', 'long', 7, { cd: 2.4 }], ['Hand Grenade', 'special', 8, { fx: 'splash' }]]);
  W('cortes', 'Hernán Cortés', 3, 'hero', 'Spain · 1485–1547', 'S3 · vs Ivan the Terrible',
    L(S.light, '#1d1f24', '#a8322a', 'morion', '#e0c46a', { plume: '#f0e6d0', beard: '#2a1a1a', cape: '#a8322a' }),
    [['Toledo Rapier', 'short', 8], ['Halberd', 'mid', 7, { r: 54 }], ['Arquebus', 'long', 7], ['Lombard Cannon', 'special', 9, { fx: 'splash' }]]);
  W('ivan', 'Ivan the Terrible', 3, 'hero', 'Tsardom of Russia · 1530–1584', 'S3 · vs Hernán Cortés',
    L(S.light, '#e0c46a', '#a8322a', 'tsar', '#e0c46a', { fur: '#f0e6d0', beard: '#3a2a1a', cape: '#6a1a2a' }),
    [['Shashka Sabre', 'short', 7], ['Bardiche', 'mid', 8, { r: 50 }], ['Pishchal', 'long', 7], ['Gulyay-Gorod', 'special', 8, { fx: 'shield' }]]);
  W('washington', 'George Washington', 3, 'hero', 'United States · 1732–1799', 'S3 · vs Napoleon · Won',
    L(S.light, '#2f3f6a', '#e6dccb', 'tricorn', '#1d1f24', { facing: '#e0c46a', whiteHair: true, mounted: '#f0e6d0' }),
    [['Colichemarde Sword', 'short', 7], ['Brown Bess Bayonet', 'mid', 7, { r: 48 }], ['Brown Bess Musket', 'long', 7], ['Pennsylvania Long Rifle', 'long', 8, { cd: 2.6 }], ['6-Pound Cannon', 'special', 9, { fx: 'splash' }]]);
  W('napoleon', 'Napoleon Bonaparte', 3, 'hero', 'French Empire · 1769–1821', 'S3 · vs George Washington · Lost',
    L(S.light, '#2f3f8a', '#e6dccb', 'bicorne', '#1d1f24', { facing: '#e0c46a', mounted: '#e2d6c0' }),
    [['Cavalry Saber', 'short', 7], ['Charleville Bayonet', 'mid', 7, { r: 48 }], ['1777 Charleville Musket', 'long', 7], ['8-Pound Cannon', 'special', 9, { fx: 'splash' }]]);
  W('jessejames', 'Jesse James', 3, 'hero', 'American frontier · 1847–1882', 'S2 · vs Al Capone',
    L(S.light, '#7a5a3a', '#3a3a4a', 'cowboy', '#4a3a2a', { duster: '#8a7a5a', mustache: true }),
    [['Bowie Knife', 'short', 6], ['Coach Gun', 'mid', 8], ['Colt Navy Revolver', 'long', 7, { cd: 1.1, r: 160 }], ['Winchester Rapid Fire', 'special', 8, { fx: 'volley', proj: 'bullet' }]]);

  // ── Modern Warfare ──────────────────────────────────────────────────────
  W('greenberet', 'Green Beret', 4, 'ranged', 'U.S. Army Special Forces', 'S1 · vs Spetsnaz · Lost',
    L(S.light, '#5a6a3a', '#4a5a32', 'beret', '#2f5a3a', { vest: '#3a4228' }),
    [['E-Tool', 'short', 5], ['Beretta M9', 'mid', 6], ['Mossberg 500', 'mid', 8], ['M4A1 Carbine', 'long', 8, { cd: 0.8 }], ['M24 Sniper Rifle', 'long', 9, { cd: 2.2 }], ['M67 Frag Grenade', 'special', 8, { fx: 'splash' }]]);
  W('spetsnaz', 'Spetsnaz', 4, 'ranged', 'Russian special forces', 'S1 · vs Green Beret · Won',
    L(S.light, '#5a6a6a', '#3a4a4a', 'balaclava', '#2a2a2a', { vest: '#2a3232', stripes: true }),
    [['Ballistic Knife', 'short', 6], ['Makarov PM', 'mid', 6], ['Saiga-12', 'mid', 8], ['AK-74', 'long', 8, { cd: 0.8 }], ['Dragunov SVD', 'long', 9, { cd: 2.2 }], ['RGD-5 Grenade', 'special', 8, { fx: 'splash' }]]);
  W('seal', 'Navy SEAL', 4, 'ranged', 'U.S. Navy special warfare', 'S2 · vs Israeli Commando',
    L(S.light, '#3a4a5a', '#2a3440', 'boonie', '#3a4a3a', { vest: '#2a2a2a' }),
    [['Ka-Bar', 'short', 5], ['SIG P226', 'mid', 6], ['Mk 11 Sniper', 'long', 9, { cd: 2.2 }], ['C4 Charge', 'special', 9, { fx: 'splash' }]]);
  W('idf', 'Israeli Commando', 4, 'ranged', 'Sayeret Matkal', 'S2 · vs Navy SEAL',
    L(S.tan, '#6a6a4a', '#4a4a32', 'helmet', '#5a5a3a', { vest: '#3a3a2a' }),
    [['Krav Maga', 'short', 6], ['Mini-Uzi', 'mid', 7], ['Tavor TAR-21', 'long', 8, { cd: 0.8 }], ['Negev LMG', 'special', 8, { fx: 'volley', n: 7, proj: 'bullet' }]]);
  W('swat', 'SWAT', 4, 'ranged', 'U.S. police tactical unit', 'S2 · vs GSG-9',
    L(S.light, '#22262c', '#22262c', 'helmet', '#1a1a1a', { vest: '#3a3f46', letters: true }),
    [['Glock 22', 'short', 5], ['Remington 870', 'mid', 8], ['Colt AR-15', 'long', 7, { cd: 0.8 }], ['Flashbang', 'special', 6, { fx: 'stun', r: 160, aoe: 60 }]]);
  W('gsg9', 'GSG-9', 4, 'ranged', 'German federal counter-terrorism', 'S2 · vs SWAT',
    L(S.light, '#2f4a3a', '#2f3a32', 'helmet', '#2a3a2a', { vest: '#22302a' }),
    [['P7 Pistol', 'short', 5], ['MP5', 'mid', 7], ['PSG1 Sniper', 'long', 9, { cd: 2.2 }], ['Breaching Charge', 'special', 8, { fx: 'splash' }]]);
  W('ranger', 'Army Ranger', 4, 'ranged', 'U.S. 75th Ranger Regiment', 'S3 · vs North Korean Special Ops',
    L(S.light, '#7a7458', '#6a6448', 'helmet', '#6a6448', { vest: '#4a4834' }),
    [['Ka-Bar', 'short', 5], ['M1014 Shotgun', 'mid', 8], ['M4A1', 'long', 8, { cd: 0.8 }], ['M249 SAW', 'special', 8, { fx: 'volley', n: 8, proj: 'bullet' }]]);
  W('nkso', 'North Korean Special Ops', 4, 'ranged', 'Korean People’s Army', 'S3 · vs Army Rangers',
    L(S.light, '#5a6a4a', '#4a5a3a', 'cap', '#4a5a3a', { star: true, vest: '#3a4a2a' }),
    [['Bayonet', 'short', 5], ['Type 68 Pistol', 'mid', 5], ['Type 88 Rifle', 'long', 7, { cd: 0.85 }], ['RPG-7', 'special', 9, { fx: 'splash', proj: 'rocket' }]]);
  W('gurkha', 'Gurkha', 4, 'infantry', 'Nepal · British Army', 'S3 · vs French Foreign Legion',
    L(S.mid, '#5a6a3a', '#4a5a32', 'slouch', '#4a5a32', { vest: '#3a4228' }),
    [['Kukri', 'short', 9], ['L85 Bayonet', 'mid', 6, { r: 46 }], ['L85A2 Rifle', 'long', 7, { cd: 0.85 }], ['Kukri Charge', 'special', 8, { fx: 'flurry' }]], { speed: 1.15 });
  W('legion', 'French Foreign Legion', 4, 'ranged', 'France', 'S3 · vs Gurkhas',
    L(S.light, '#8a7a5a', '#6a5a42', 'kepi', '#f0e6d0', { vest: '#4a4232', sash: '#2f4f8a' }),
    [['Combat Knife', 'short', 5], ['FAMAS Bayonet', 'mid', 6, { r: 46 }], ['FAMAS', 'long', 8, { cd: 0.8 }], ['Frag Grenade', 'special', 8, { fx: 'splash' }]]);
  W('vietcong', 'Viet Cong', 4, 'ranged', 'Vietnam · 1955–1975', 'S2 · vs Nazi SS',
    L(S.light, '#1d1f24', '#1d1f24', 'conical', '#c9b07a', {}),
    [['Machete', 'short', 6], ['SKS Bayonet', 'mid', 6, { r: 46 }], ['AK-47', 'long', 8, { cd: 0.85 }], ['Punji Trap', 'special', 7, { fx: 'poison', r: 120, proj: 'stake' }]], { speed: 1.1 });
  W('mafia', 'Mafia', 4, 'ranged', 'Chicago and New York · 1920s', 'S1 · vs Yakuza · Won',
    L(S.light, '#3a3a42', '#2a2a32', 'fedora', '#2a2a32', { tie: '#a8322a' }),
    [['Ice Pick', 'short', 4], ['Baseball Bat', 'short', 5], ['Sawed-off Shotgun', 'mid', 8], ['Thompson SMG', 'long', 8, { cd: 0.6, r: 190 }], ['Molotov Cocktail', 'special', 7, { fx: 'fire' }]]);
  W('yakuza', 'Yakuza', 4, 'ranged', 'Japan · 20th c.', 'S1 · vs Mafia · Lost',
    L(S.light, '#1d1f24', '#1d1f24', 'slick', '#1a1a1a', { tie: '#e6dccb', tattoo: true }),
    [['Nunchaku', 'short', 5], ['Sai', 'short', 5], ['Walther P38', 'mid', 6], ['Sten Gun', 'long', 7, { cd: 0.7, r: 190 }], ['Ceramic Grenade', 'special', 7, { fx: 'splash' }]], { speed: 1.1 });
  W('capone', 'Al Capone', 4, 'hero', 'Chicago · 1899–1947', 'S2 · vs Jesse James',
    L(S.light, '#e6dccb', '#3a3a42', 'fedora', '#e6dccb', { tie: '#2a2a32', coat: '#3a3a42' }),
    [['Brass Knuckles', 'short', 4], ['Sawed-off Shotgun', 'mid', 8], ['Thompson SMG', 'long', 8, { cd: 0.6, r: 190 }], ['Chicago Typewriter', 'special', 9, { fx: 'volley', n: 9, proj: 'bullet' }]]);
  W('pancho', 'Pancho Villa', 4, 'hero', 'Mexico · 1878–1923', 'S3 · vs Crazy Horse',
    L(S.mid, '#c9b07a', '#5a3a26', 'sombrero', '#c9a26a', { bandolier: true, mustache: true, mounted: '#5a3a26' }),
    [['Machete', 'short', 6], ['Colt Revolver', 'mid', 6], ['Mauser Rifle', 'long', 8], ['División del Norte Charge', 'special', 9, { fx: 'charge' }]]);
  W('teddy', 'Teddy Roosevelt', 4, 'hero', 'Rough Riders · 1898', 'S3 · vs Lawrence of Arabia',
    L(S.light, '#a8925a', '#7a6a4a', 'slouch', '#a8925a', { mustache: true, glasses: true, neck: '#2f4f8a' }),
    [['Bowie Knife', 'short', 6], ['Colt Revolver', 'mid', 6], ['Krag-Jørgensen', 'long', 8], ['Gatling Gun', 'special', 9, { fx: 'volley', n: 8, proj: 'bullet' }]]);
  W('lawrence', 'Lawrence of Arabia', 4, 'hero', 'Arab Revolt · 1916–1918', 'S3 · vs Teddy Roosevelt',
    L(S.light, '#f0e6d0', '#e6dccb', 'keffiyeh', '#f0e6d0', { agal: '#2a2a2a', sash: '#c9a23a' }),
    [['Jambiya', 'short', 6], ['Webley Revolver', 'mid', 6], ['Lee-Enfield', 'long', 8], ['Rail Demolition Charge', 'special', 9, { fx: 'splash' }]]);

  // Show matchups left out of the game: Taliban, IRA, Nazi SS, Khmer Rouge,
  // Saddam's Fedayeen, Somali pirates, the Medellín cartel, and the fictional
  // vampires vs. zombies episode.

  return { eras, warriors };
})();
