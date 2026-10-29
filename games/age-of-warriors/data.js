// Dawn of War — warrior roster, weapons and era data.
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
// Spartan, Samurai, Viking, Yakuza, Green Beret, Spetsnaz, Washington,
// Napoleon); the rest use each warrior's historically documented weapons.
// The roster keeps the best-known fighters of each age, about six to eight.
//
// Weapon tuple: [name, slot, power, options]
//   options: k weapon kind override, r range, cd cooldown (s), ammo thrown uses, pierce 0–1 armor
//   ignored, proj projectile look, fx special effect, n volley size,
//   aoe blast radius.
// Special fx: shield, stun, charge, splash, volley, poison, fire, flurry,
//   rally, fear, snipe, hornets, heal (magic: heals wounded allies nearby),
//   beast (a war animal at heel that pounces; look.beast picks it).
// Magic weapons (staffs, scepters, spirit fire) fire sun bolts or spirit hexes.

window.AOW_DATA = (() => {
  const eras = [
    {
      id: 'stone', name: 'Stone Age', span: 'Before 3000 BC',
      xp: 0, baseHp: 700, hpMul: 0.55, dmgMul: 0.55, costMul: 0.45,
      sky: ['#c8673a', '#f6d29a'], far: '#6a4a3a', near: '#3a2a20', ground: '#7a6a40', dirt: '#4e4228',
      ability: { name: 'Meteor Shower', desc: 'Burning rocks fall from the sky.', proj: 'meteor', n: 12, power: 6, cd: 45, aoe: 44, fire: true },
      turrets: [
        { id: 'slingpost', name: 'Slinger Rock Post', art: 'archers', culture: 'Stone Age hunters', by: ['slinger'], power: 4, cd: 1.0, r: 300, proj: 'stone' },
        { id: 'boulder', name: 'Boulder Hurler', art: 'catapult', culture: 'Cliff-top clans', by: ['neanderthal'], power: 7, cd: 3.4, r: 360, proj: 'stone', aoe: 48 },
        { id: 'spearperch', name: 'Spear Perch', art: 'archers', culture: 'Mammoth hunters', by: ['otzi', 'chieftain'], power: 6, cd: 1.8, r: 320, proj: 'javelin', pierce: 0.4, effect: 'line' },
        { id: 'totem', name: 'Spirit Totem', art: 'totem', culture: 'Clan shamans', by: ['shaman'], power: 3, cd: 2.4, r: 320, proj: 'hex', aoe: 60, effect: 'slow' },
      ],
    },
    {
      id: 'egypt', name: 'Age of the Pharaohs', span: 'Ancient Egypt · 2600 – 1070 BC',
      xp: 300, baseHp: 850, hpMul: 0.75, dmgMul: 0.75, costMul: 0.7,
      sky: ['#4a8ac0', '#f4e2b4'], far: '#d8b67a', near: '#9a7440', ground: '#e2c486', dirt: '#b8955a',
      ability: { name: 'Wrath of Ra', desc: 'Sun fire rains down on the enemy line.', proj: 'sunbolt', n: 16, power: 6, cd: 46, fire: true },
      turrets: [
        { id: 'medjayTower', name: 'Medjay Archer Tower', art: 'archers', culture: 'Medjay and Nubian bowmen', by: ['nubian'], power: 4, cd: 2.2, r: 330, proj: 'arrow', n: 4, effect: 'volley' },
        { id: 'javelinRampart', name: 'Javelin Rampart', art: 'archers', culture: 'New Kingdom infantry', by: ['khopesh', 'chariot'], power: 6, cd: 1.6, r: 320, proj: 'javelin', pierce: 0.5, effect: 'line' },
        { id: 'mirrorRa', name: 'Mirror of Ra', art: 'mirror', culture: 'Sun temple of Heliopolis', by: ['priestRa', 'imhotep'], power: 7, cd: 2.4, r: 380, proj: 'sunbolt', burn: true, target: 'strongest' },
        { id: 'horusObelisk', name: 'Eye of Horus Obelisk', art: 'obelisk', culture: 'Temple guardians', by: ['anubis', 'isis'], power: 5, cd: 2.8, r: 340, proj: 'sunbolt', effect: 'stun' },
      ],
    },
    {
      id: 'ancient', name: 'Ancient Era', span: '500 BC – AD 450',
      xp: 800, baseHp: 1000, hpMul: 1, dmgMul: 1, costMul: 1,
      sky: ['#e9a56a', '#f6d8a6'], far: '#b9805a', near: '#8d5b3d', ground: '#a8794b', dirt: '#7f5734',
      ability: { name: 'Arrow Storm', desc: 'A sky of arrows falls on the enemy line.', proj: 'arrow', n: 26, power: 5, cd: 45 },
      turrets: [
        { id: 'scorpio', name: 'Scorpio Bolt Thrower', art: 'ballista', culture: 'Roman legions', by: ['centurion'], power: 7, cd: 1.6, r: 340, proj: 'bolt', pierce: 0.6, effect: 'line' },
        { id: 'onager', name: 'Onager', art: 'catapult', culture: 'Rome and Carthage', by: ['centurion', 'hannibal'], power: 8, cd: 3.4, r: 380, proj: 'stone', aoe: 50 },
        { id: 'immortalArchers', name: 'Immortal Archer Tower', art: 'archers', culture: 'Achaemenid Persia', by: ['immortal'], power: 4, cd: 2.2, r: 320, proj: 'arrow', n: 4, effect: 'volley' },
        { id: 'zhugenu', name: 'Repeating Crossbow Nest', art: 'ballista', culture: 'Hannibal’s mercenary engineers', by: ['hannibal'], power: 6, cd: 0.55, r: 290, proj: 'bolt' },
      ],
    },
    {
      id: 'medieval', name: 'Age of Steel', span: '500 – 1500',
      xp: 1500, baseHp: 1800, hpMul: 1.9, dmgMul: 1.9, costMul: 2.2,
      sky: ['#5f6f7a', '#b9c2bd'], far: '#6b7470', near: '#4b5450', ground: '#6f7552', dirt: '#4d5236',
      ability: { name: 'Greek Fire', desc: 'Clay pots of liquid fire burst across the field.', proj: 'fire', n: 14, power: 6, cd: 48, fire: true },
      turrets: [
        { id: 'springald', name: 'Springald', art: 'ballista', culture: 'Norman and French castles', by: ['knight'], power: 7, cd: 1.3, r: 350, proj: 'bolt', pierce: 0.5, effect: 'line' },
        { id: 'trebuchet', name: 'Trebuchet', art: 'catapult', culture: 'Siege engineers of Europe', by: ['knight', 'wallace'], power: 9, cd: 3.6, r: 400, proj: 'stone', aoe: 62 },
        { id: 'firearrows', name: 'Fire-Arrow Launcher', art: 'rack', culture: 'Mongol siege engineers', by: ['mongol', 'genghis'], power: 4, cd: 3.2, r: 340, proj: 'rocket', n: 6, effect: 'volley', burn: true },
        { id: 'yagura', name: 'Yagura Archer Tower', art: 'archers', culture: 'Feudal Japan', by: ['samurai', 'ninja'], power: 6, cd: 1.1, r: 400, proj: 'arrow', target: 'strongest' },
      ],
    },
    {
      id: 'sun', name: 'Empires of Sun & Plains', span: '1300 – 1880',
      xp: 3200, baseHp: 3000, hpMul: 3.2, dmgMul: 3.2, costMul: 4.6,
      sky: ['#2f8a7c', '#e9c46a'], far: '#3f6e4a', near: '#2c5236', ground: '#7a6a3a', dirt: '#56492a',
      ability: { name: 'Atlatl Barrage', desc: 'Hundreds of atlatl darts rain down.', proj: 'dart', n: 30, power: 6, cd: 48 },
      turrets: [
        { id: 'slingers', name: 'Huaraca Sling Tower', art: 'archers', culture: 'Inca Empire', by: ['inca'], power: 6, cd: 0.9, r: 330, proj: 'stone' },
        { id: 'hornets', name: 'Hornet-Nest Catapult', art: 'catapult', culture: 'Maya city-states', by: ['holkan'], power: 8, cd: 3.2, r: 380, proj: 'nest', aoe: 60, burn: true },
        { id: 'atlatl', name: 'Atlatl Dart Platform', art: 'archers', culture: 'Aztec Empire', by: ['jaguar', 'eagle', 'cuauhtemoc'], power: 7, cd: 1.5, r: 330, proj: 'dart', pierce: 0.4, effect: 'line' },
        { id: 'firelodge', name: 'Fire-Arrow Lodge', art: 'archers', culture: 'Apache and Comanche', by: ['apache', 'crazyhorse'], power: 5, cd: 1.4, r: 340, proj: 'arrow', burn: true },
      ],
    },
    {
      id: 'powder', name: 'Age of Powder', span: '1500 – 1890',
      xp: 7300, baseHp: 4600, hpMul: 5.2, dmgMul: 5.2, costMul: 9,
      sky: ['#7c6a5a', '#d8c3a0'], far: '#7d6b58', near: '#5a4c3f', ground: '#6e5b45', dirt: '#4c3e30',
      ability: { name: 'Cannon Barrage', desc: 'A battery of field guns shells the enemy.', proj: 'shell', n: 10, power: 9, cd: 50, aoe: 60 },
      turrets: [
        { id: 'swivel', name: 'Swivel Gun', art: 'gun', culture: 'Caribbean pirates', by: ['pirate'], power: 6, cd: 0.9, r: 330, proj: 'bullet' },
        { id: 'cannon', name: 'Field Cannon', art: 'cannon', culture: 'Grande Armée and Continental artillery', by: ['napoleon', 'washington', 'grenadier'], power: 9, cd: 3.2, r: 420, proj: 'shell', aoe: 70 },
        { id: 'longrifle', name: 'Long Rifle Nest', art: 'rifle', culture: 'Continental Army sharpshooters', by: ['washington'], power: 9, cd: 2.6, r: 480, proj: 'bullet', pierce: 0.5, target: 'strongest' },
        { id: 'streltsyGallery', name: 'Musket Volley Gallery', art: 'gun', culture: 'Musketeer and conquistador companies', by: ['musketeer', 'conquistador'], power: 5, cd: 2.8, r: 340, proj: 'bullet', n: 4, effect: 'volley' },
      ],
    },
    {
      id: 'modern', name: 'Modern Warfare', span: '1898 – today',
      xp: 16800, baseHp: 7000, hpMul: 8.2, dmgMul: 8.2, costMul: 17,
      sky: ['#1d2b3a', '#56708a'], far: '#2d3b48', near: '#1f2a34', ground: '#4a4f4a', dirt: '#33372f',
      ability: { name: 'Airstrike', desc: 'Jets drop bombs along the enemy front.', proj: 'bomb', n: 12, power: 10, cd: 55, aoe: 70 },
      turrets: [
        { id: 'm2', name: 'M2 Browning .50', art: 'gun', culture: 'U.S. Army', by: ['greenberet', 'teddy'], power: 5, cd: 0.28, r: 360, proj: 'bullet' },
        { id: 'mortar', name: 'M252 Mortar', art: 'cannon', culture: 'Infantry support', by: ['greenberet', 'gurkha'], power: 9, cd: 3, r: 440, proj: 'shell', aoe: 80 },
        { id: 'sniper', name: 'Sniper Nest', art: 'rifle', culture: 'Navy SEALs and GSG-9', by: ['seal'], power: 10, cd: 3, r: 520, proj: 'bullet', pierce: 0.7, target: 'strongest' },
        { id: 'rpg', name: 'RPG Nest', art: 'rpg', culture: 'Spetsnaz and the Korean People’s Army', by: ['spetsnaz', 'yakuza'], power: 9, cd: 3.2, r: 380, proj: 'rocket', aoe: 70 },
      ],
    },
    {
      id: 'alien', name: 'Alien Invasion', span: 'The future',
      xp: 38800, baseHp: 10500, hpMul: 12.5, dmgMul: 12.5, costMul: 30,
      ability: { name: 'Orbital Lance', desc: 'The mothership burns the field with ion fire.', proj: 'ion', n: 9, power: 11, cd: 55, aoe: 80 },
      turrets: [
        { id: 'plasma', name: 'Plasma Turret', art: 'plasma', culture: 'Invasion infantry', by: ['trooper'], power: 6, cd: 0.55, r: 380, proj: 'plasma' },
        { id: 'ion', name: 'Ion Cannon', art: 'ion', culture: 'The Overmind’s fleet', by: ['overmind'], power: 9, cd: 3, r: 460, proj: 'ion', aoe: 90 },
        { id: 'gravity', name: 'Gravity Well Pylon', art: 'pylon', culture: 'Hive siege caste', by: ['brute', 'queen'], power: 4, cd: 2.4, r: 340, proj: 'ion', aoe: 80, effect: 'slow' },
        { id: 'psispire', name: 'Psionic Spire', art: 'spire', culture: 'Zeta Greys', by: ['grey', 'overmind'], power: 6, cd: 2.8, r: 360, proj: 'plasma', effect: 'stun' },
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

  // ── Stone Age (prehistoric) ─────────────────────────────────────────────
  // As in Age of War, the first age: clubs, slings and beasts. Ötzi the Iceman
  // is real (found in the Alps, 1991); his kit follows the finds: copper axe,
  // flint dagger, yew longbow. Raptor riders are pure Age of War fantasy.
  W('clubman', 'Clubman', 0, 'infantry', 'Paleolithic Europe', 'Added · not on the show',
    L(S.tan, '#8a6a44', S.tan, 'bone', '#3a2416', { skirt: '#6a4a2a', fringe: '#5a3a20', beard: '#3a2416' }),
    [['Flint Knife', 'short', 3], ['War Club', 'mid', 5], ['Throwing Rock', 'long', 4, { proj: 'stone', ammo: 3 }], ['Skull Crack', 'special', 5, { fx: 'stun' }]],
    { uniform: 'Untanned hide tunic and fur loincloth, hair bound with a bone' });
  W('slinger', 'Slinger', 0, 'ranged', 'Neolithic hill tribes', 'Added · not on the show',
    L(S.mid, '#9a7a4a', S.mid, 'headband', '#a8322a', { skirt: '#7a5a34', beads: '#efe4cf' }),
    [['Flint Knife', 'short', 3], ['Stone Hand Axe', 'mid', 4], ['Sling', 'long', 5], ['Rock Hail', 'special', 5, { fx: 'volley', proj: 'stone' }]],
    { uniform: 'Woven grass kilt, shell-bead necklace, red ochre headband' });
  W('neanderthal', 'Neanderthal Brute', 0, 'heavy', 'Ice Age Europe', 'Added · not on the show',
    L(S.tan, '#5a3a24', S.tan, 'none', '#2a1a10', { skirt: '#4a2e1a', fur: '#3a2416', beard: '#2a1a10' }),
    [['Hand Axe', 'short', 5], ['Tusk Maul', 'mid', 7, { k: 'club' }], ['Boulder Throw', 'long', 6, { k: 'throw', proj: 'stone', ammo: 2 }], ['Cave Bear Hide', 'special', 6, { fx: 'shield' }]],
    { hpMul: 1.1, speed: 0.9, uniform: 'Cave-bear hide over the shoulders, heavy brow, a mammoth-tusk maul' });
  W('raptor', 'Raptor Rider', 0, 'infantry', 'Age of War fantasy', 'Added · not on the show',
    L(S.mid, '#7a6a3a', S.mid, 'feather', '#a8322a', { skirt: '#5a4a2a', mounted: '#6a8a3a', mount: 'raptor', paint: '#efe4cf' }),
    [['Bone Dagger', 'short', 4], ['Obsidian Spear', 'mid', 6, { r: 46 }], ['Bola', 'long', 4, { k: 'throw', proj: 'bola', ammo: 2 }], ['Raptor Pounce', 'special', 7, { fx: 'charge' }]],
    { speed: 1.3, uniform: 'Feathered riding harness, white clay war paint, red feather' });
  W('shaman', 'Shaman', 0, 'ranged', 'Clan spirit-caller', 'Added · not on the show',
    L(S.brown, '#4a5a3a', S.brown, 'pelt', '#5a4a3a', { robe: true, beads: '#efe4cf', paint: '#efe4cf', trim: '#a8322a' }),
    [['Bone Dagger', 'short', 3], ['Spirit Fire', 'long', 6], ['Spirit Mending', 'special', 6, { fx: 'heal' }]],
    { uniform: 'Antlered hide robe, bone necklaces, white clay face paint; heals the clan' });
  W('otzi', 'Ötzi the Iceman', 0, 'hero', 'Ötztal Alps · c. 3300 BC', 'Added · not on the show',
    L(S.light, '#6a5034', '#5a4a34', 'fur', '#4a3420', { beard: '#3a2416', cape: '#8a7a5a', fringe: '#3a2a1a', boots: '#4a3420' }),
    [['Flint Dagger', 'short', 4], ['Copper Axe', 'mid', 7], ['Yew Longbow', 'long', 7], ['Arrow Volley', 'special', 6, { fx: 'volley', proj: 'arrow' }]],
    { uniform: 'Bearskin cap, goat-hide coat in striped panels, woven grass cape, as found in 1991' });
  W('chieftain', 'Raptor Chieftain', 0, 'hero', 'Age of War fantasy', 'Added · not on the show',
    L(S.tan, '#8a3a24', S.tan, 'pelt', '#c8a46a', { skirt: '#5a3a20', mounted: '#4a6a8a', mount: 'raptor', cape: '#a8822a', beads: '#efe4cf', paint: '#a8322a' }),
    [['Obsidian Blade', 'short', 7, { k: 'sword' }], ['Great Spear', 'mid', 8, { r: 56 }], ['Javelin', 'long', 6, { ammo: 3 }], ['War Cry', 'special', 7, { fx: 'rally' }]],
    { speed: 1.25, uniform: 'Sabre-tooth pelt, lion-mane cape, rides the pack leader' });

  // ── Age of the Pharaohs (Egypt) ─────────────────────────────────────────
  // New Kingdom army: khopesh infantry, Nubian and Medjay bowmen, chariots
  // with composite bows. The priests' magic is from Egyptian myth, not history.
  W('khopesh', 'Khopesh Infantry', 1, 'infantry', 'New Kingdom Egypt · 1550–1070 BC', 'Added · not on the show',
    L(S.brown, '#efe4cf', S.brown, 'wig', '#1a1a1a', { skirt: '#f4efe4', shield: '#8a5a2a', shieldEmblem: 'spots', ec: '#efe4cf', belt: '#d9b45a' }),
    [['Dagger', 'short', 4], ['Khopesh', 'mid', 7], ['Javelin', 'long', 5, { ammo: 2 }], ['Hide Shield', 'special', 6, { fx: 'shield' }]],
    { uniform: 'Pleated linen shendyt kilt, leather strap corselet, cowhide shield' });
  W('nubian', 'Nubian Archer', 1, 'ranged', 'Ta-Seti, "Land of the Bow"', 'Added · not on the show',
    L(S.dark, '#d9b45a', S.dark, 'feather', '#efe4cf', { skirt: '#a8322a', beads: '#d9b45a', torc: '#d9b45a' }),
    [['Dagger', 'short', 3], ['Mace', 'mid', 5], ['Nubian Longbow', 'long', 7], ['Arrow Storm', 'special', 6, { fx: 'volley' }]],
    { uniform: 'Red sash kilt, gold armlets, an ostrich feather in the hair' });
  W('chariot', 'Chariot Archer', 1, 'ranged', 'Battle of Kadesh · 1274 BC', 'Added · not on the show',
    L(S.mid, '#efe4cf', S.mid, 'wig', '#1a1a1a', { mounted: '#e8e0cc', mount: 'chariot', band: '#d9b45a', pattern: 'lamellar', pc: ['#c9a23a'] }),
    [['Dagger', 'short', 4], ['Javelin', 'mid', 6, { ammo: 3 }], ['Composite Bow', 'long', 8], ['Chariot Charge', 'special', 8, { fx: 'charge' }]],
    { uniform: 'Bronze-scale coat over linen, gold-banded wig, a gilded two-horse car' });
  W('priestRa', 'Priest of Ra', 1, 'ranged', 'Sun temple of Heliopolis', 'Added · not on the show',
    L(S.mid, '#f4efe4', S.mid, 'bald', '#1a1a1a', { robe: true, pattern: 'leopard', pc: ['#d8a23a', '#2a1a0a'], trim: '#d9b45a', neck: '#d9b45a' }),
    [['Dagger', 'short', 3], ['Staff of Ra', 'long', 7], ['Solar Flare', 'special', 7, { fx: 'fire', proj: 'sunbolt' }]],
    { uniform: 'Shaven head, white linen robe under a sem priest’s leopard skin' });
  W('isis', 'Priestess of Isis', 1, 'ranged', 'Temple of Philae', 'Added · not on the show',
    L(S.brown, '#f4efe4', S.brown, 'wig', '#1a1a1a', { robe: true, band: '#d9b45a', trim: '#2a4a9a', beads: '#2a4a9a', neck: '#d9b45a' }),
    [['Dagger', 'short', 3], ['Ankh Scepter', 'long', 6], ['Blessing of Isis', 'special', 7, { fx: 'heal' }]],
    { uniform: 'Sheer linen sheath, lapis broad collar, gold vulture-band on a braided wig' });
  W('anubis', 'Anubis Guardian', 1, 'heavy', 'Valley of the Kings', 'Added · not on the show',
    L(S.dark, '#1a1a1a', S.dark, 'anubis', '#1a1a1a', { skirt: '#d9b45a', neck: '#d9b45a', stripe: '#2a4a9a', shield: '#2a2a2a', shieldEmblem: 'sun', ec: '#d9b45a' }),
    [['Khopesh', 'short', 7], ['Jackal Glaive', 'mid', 7, { k: 'spear', r: 50 }], ['Eye of Anubis', 'long', 6], ['Sandstorm Curse', 'special', 8, { fx: 'fear' }]],
    { armor: 0.35, uniform: 'Black jackal mask of the god of the dead, gold-and-lapis collar' });
  W('ramesses', 'Ramesses II', 1, 'hero', 'Egypt · r. 1279–1213 BC', 'Added · not on the show',
    L(S.mid, '#efe4cf', S.mid, 'khepresh', '#2a4a9a', { mounted: '#c9a26a', mount: 'chariot', beardFalse: true, pattern: 'lamellar', pc: ['#d9b45a'], cape: '#2a4a9a', capeTrim: '#d9b45a', neck: '#d9b45a' }),
    [['Dagger', 'short', 5], ['Khopesh', 'mid', 8], ['Composite Bow', 'long', 9], ['Kadesh Charge', 'special', 9, { fx: 'charge' }]],
    { uniform: 'Blue khepresh war crown, gold scale armor, the chariot he led at Kadesh' });
  W('imhotep', 'High Priest Imhotep', 1, 'hero', 'Egypt · 27th c. BC', 'Added · not on the show',
    L(S.mid, '#f4efe4', S.mid, 'bald', '#1a1a1a', { robe: true, trim: '#d9b45a', neck: '#2a4a9a', cape: '#d9b45a', capeTrim: '#2a4a9a', beads: '#d9b45a' }),
    [['Dagger', 'short', 4], ['Scepter of Thoth', 'long', 8], ['Plague of Locusts', 'special', 9, { fx: 'hornets' }]],
    { uniform: 'Vizier’s white robe and gold collar; the legend made him a god of healing and magic' });

  // ── Ancient Era ─────────────────────────────────────────────────────────
  W('spartan', 'Spartan', 2, 'heavy', 'Sparta, Greece · 5th c. BC', 'S1 · vs Ninja · Won',
    L(S.tan, '#8f2a1f', '#6b3b22', 'crest', '#b8913a', { plume: '#9c1d1d', shield: '#b8862e', cape: '#7a1f1a' }),
    [['Xiphos', 'short', 6], ['Dory', 'mid', 7, { r: 52 }], ['Javelin', 'long', 6, { ammo: 2 }], ['Aspis', 'special', 9, { fx: 'shield' }]]);
  W('centurion', 'Roman Centurion', 2, 'heavy', 'Roman Empire · 1st c.', 'S2 · vs Rajput',
    L(S.tan, '#9b2a24', '#5c3b25', 'crest', '#a7a9a8', { plume: '#c8312b', crossPlume: true, shield: '#9b2a24', cape: '#6f1f1a' }),
    [['Pugio', 'short', 4], ['Gladius', 'mid', 8, { r: 34 }], ['Pilum', 'long', 7, { ammo: 2, pierce: 0.6 }], ['Scutum', 'special', 8, { fx: 'shield' }]]);
  W('gladiator', 'Gladiator', 2, 'infantry', 'Roman arena · 1st c.', 'S1 · vs Apache · Lost',
    L(S.mid, '#c8a25a', '#7b5a3a', 'gladiator', '#9ea3a6', {}),
    [['Cestus', 'short', 5], ['Scissor', 'short', 7], ['Trident & Net', 'mid', 7, { r: 52 }], ['Sling', 'long', 5], ['Sica', 'special', 7, { fx: 'flurry' }]]);
  W('immortal', 'Persian Immortal', 2, 'ranged', 'Achaemenid Persia · 5th c. BC', 'S2 · vs Celt',
    L(S.mid, '#5a3d7a', '#3a2a55', 'tiara', '#e6d6b0', { shield: '#a07b3a' }),
    [['Sagaris', 'short', 6], ['Spear', 'mid', 6], ['Composite Bow', 'long', 7], ['Scythed Chariot', 'special', 7, { fx: 'charge' }]]);
  W('alexander', 'Alexander the Great', 2, 'hero', 'Macedon · 336–323 BC', 'S2 · vs Attila the Hun · Lost',
    L(S.light, '#b8913a', '#6a2a5a', 'crest', '#e0c46a', { plume: '#f2f0e6', cape: '#6a2a5a', mounted: '#3a2a20' }),
    [['Kopis', 'short', 7], ['Sarissa', 'mid', 8, { r: 62 }], ['Gastraphetes', 'long', 6], ['Companion Cavalry', 'special', 9, { fx: 'charge' }]]);
  W('hannibal', 'Hannibal Barca', 2, 'hero', 'Carthage · 247–181 BC', 'S3 · vs Genghis Khan',
    L(S.mid, '#6e2a3a', '#4a2a22', 'crest', '#b8913a', { plume: '#2a2a2a', cape: '#3a2a55' }),
    [['Falcata', 'short', 8], ['Iberian Spear', 'mid', 6], ['Balearic Sling', 'long', 7], ['War Elephant', 'special', 10, { fx: 'charge' }]]);

  // ── Age of Steel ────────────────────────────────────────────────────────
  W('viking', 'Viking', 3, 'heavy', 'Scandinavia · 8th–11th c.', 'S1 · vs Samurai · Lost',
    L(S.light, '#5a6a7a', '#6a4a2a', 'horned', '#8a8f92', { shield: '#a8322a', beard: '#c9883a' }),
    [['Long Sword', 'short', 7], ['Great Axe', 'mid', 8], ['Spear', 'long', 6, { k: 'throw', ammo: 1 }], ['Shield', 'special', 7, { fx: 'shield' }]]);
  W('samurai', 'Samurai', 3, 'infantry', 'Feudal Japan · 12th–16th c.', 'S1 · vs Viking · Won',
    L(S.light, '#9a2b2b', '#2a2a2a', 'kabuto', '#2a2a2a', { plume: '#c9a23a' }),
    [['Katana', 'short', 9], ['Naginata', 'mid', 8, { r: 56 }], ['Yumi', 'long', 7], ['Kanabo', 'special', 7, { fx: 'stun', r: 34 }]]);
  W('knight', 'Knight', 3, 'heavy', 'Western Europe · 14th c.', 'S1 · vs Pirate · Lost',
    L(S.light, '#b9bec2', '#8a8f92', 'greathelm', '#c4c8cb', { plume: '#2f4f8a', shield: '#2f4f8a' }),
    [['Broadsword', 'short', 7], ['Halberd', 'mid', 8, { r: 54 }], ['Crossbow', 'long', 8, { pierce: 0.5 }], ['Morning Star', 'special', 8, { fx: 'stun', r: 34 }]], { armor: 0.4 });
  W('ninja', 'Ninja', 3, 'infantry', 'Feudal Japan · 15th–17th c.', 'S1 · vs Spartan · Lost',
    L(S.light, '#1d1f24', '#1d1f24', 'hood', '#1d1f24', {}),
    [['Ninjato', 'short', 7], ['Kusari-gama', 'mid', 6, { r: 58 }], ['Shuriken', 'long', 4, { r: 140 }], ['Blowgun', 'special', 6, { fx: 'poison' }]], { speed: 1.35, armor: 0 });
  W('mongol', 'Mongol', 3, 'ranged', 'Mongol Empire · 13th c.', 'S2 · vs Comanche',
    L(S.tan, '#3a5a8a', '#5a3a26', 'mongol', '#7a5a3a', { mounted: '#8a6a4a' }),
    [['Ild Sword', 'short', 6], ['Jida Lance', 'mid', 6, { r: 56 }], ['Composite Bow', 'long', 9], ['Horse Archer Volley', 'special', 7, { fx: 'volley' }]], { speed: 1.3 });
  W('wallace', 'William Wallace', 3, 'hero', 'Scotland · 1270–1305', 'S1 · vs Shaka Zulu',
    L(S.light, '#2f5a3a', '#3a5a8a', 'none', '#b8662a', { kilt: true, shield: '#7a5a3a', cape: '#2f4f8a', paint: '#3a6ab0' }),
    [['Targe & Dirk', 'short', 6], ['Claymore', 'mid', 9, { r: 40 }], ['Ball & Chain', 'mid', 7], ['Highland War Cry', 'special', 8, { fx: 'rally' }]]);
  W('genghis', 'Genghis Khan', 3, 'hero', 'Mongol Empire · 1162–1227', 'S3 · vs Hannibal',
    L(S.tan, '#8a2a22', '#3a2a22', 'mongol', '#b8913a', { cape: '#3a2a22', mounted: '#e2d6c0', mustache: true }),
    [['Turko-Mongol Sabre', 'short', 8], ['Lance', 'mid', 7, { r: 56 }], ['Mongol Bow', 'long', 9], ['Mangonel Fire Pots', 'special', 8, { fx: 'splash' }]]);

  // ── Empires of Sun & Plains ─────────────────────────────────────────────
  W('jaguar', 'Aztec Jaguar', 4, 'infantry', 'Aztec Empire · 15th–16th c.', 'S2 · vs Zande Warrior',
    L(S.mid, '#d8a23a', '#d8a23a', 'jaguar', '#d8a23a', { spots: true, shield: '#2f6a8a', beast: 'jaguar' }),
    [['Macuahuitl', 'short', 9], ['Tepoztopilli', 'mid', 7, { r: 52 }], ['Atlatl', 'long', 7], ['War Jaguar', 'special', 8, { fx: 'beast' }]]);
  W('eagle', 'Aztec Eagle Warrior', 4, 'infantry', 'Aztec Empire · 15th–16th c.', 'Added · not on the show',
    L(S.mid, '#e6dccb', '#c9a23a', 'eagle', '#f0e6d0', { shield: '#a8322a', feathers: '#2f8a6a' }),
    [['Tecpatl Knife', 'short', 4], ['Macuahuitl', 'mid', 8, { r: 34 }], ['Tlahuitolli Bow', 'long', 6], ['Chimalli Shield', 'special', 7, { fx: 'shield' }]]);
  W('holkan', 'Maya Holkan', 4, 'infantry', 'Maya city-states · 8th–16th c.', 'Added · not on the show',
    L(S.mid, '#2f8a7c', '#e6dccb', 'maya', '#2f8a7c', { feathers: '#2f8a7c', paint: '#a8322a' }),
    [['Obsidian Knife', 'short', 4], ['Thrusting Spear', 'mid', 7, { r: 54 }], ['Atlatl', 'long', 6], ['Hornet-Nest Bomb', 'special', 6, { fx: 'hornets' }]]);
  W('inca', 'Inca Warrior', 4, 'infantry', 'Inca Empire · 15th–16th c.', 'Added · not on the show',
    L(S.mid, '#c8312b', '#2a2a2a', 'inca', '#e0c46a', { checker: true, shield: '#e0c46a' }),
    [['Tumi', 'short', 4], ['Champi Star Mace', 'mid', 8], ['Huaraca Sling', 'long', 7], ['Liwi Bola', 'special', 6, { fx: 'stun', r: 130 }]]);
  W('apache', 'Apache', 4, 'ranged', 'American Southwest · 19th c.', 'S1 · vs Gladiator · Won',
    L(S.mid, '#c9a26a', '#6a4a2a', 'headband', '#a8322a', { longHair: true }),
    [['Tomahawk', 'short', 7], ['Knife', 'mid', 5], ['Bow & Arrow', 'long', 8], ['War Club', 'special', 6, { fx: 'stun', r: 34 }]], { speed: 1.15 });
  W('crazyhorse', 'Crazy Horse', 4, 'hero', 'Oglala Lakota · c. 1840–1877', 'S3 · vs Pancho Villa',
    L(S.mid, '#c9a26a', '#5a3a26', 'feather', '#f0e6d0', { longHair: true, mounted: '#6a4a3a' }),
    [['Stone War Club', 'short', 7], ['Lance', 'mid', 6, { r: 56 }], ['Winchester 1873', 'long', 8], ['Decoy Charge', 'special', 8, { fx: 'charge' }]]);
  W('cuauhtemoc', 'Cuauhtémoc', 4, 'hero', 'Last Aztec emperor · 1497–1525', 'Added · not on the show',
    L(S.mid, '#c9a23a', '#2f6a8a', 'quetzal', '#e0c46a', { feathers: '#2f9a6a', cape: '#2f6a8a', shield: '#e0c46a' }),
    [['Macuahuitl', 'short', 9], ['Tepoztopilli', 'mid', 7, { r: 52 }], ['Atlatl', 'long', 7], ['Defense of Tenochtitlan', 'special', 8, { fx: 'rally' }]]);

  // ── Age of Powder ───────────────────────────────────────────────────────
  W('pirate', 'Pirate', 5, 'infantry', 'Caribbean · 17th–18th c.', 'S1 · vs Knight · Won',
    L(S.tan, '#e6dccb', '#3a3a5a', 'tricorn', '#1d1f24', { sash: '#a8322a', beard: '#2a1a1a' }),
    [['Cutlass', 'short', 6], ['Blunderbuss', 'mid', 8], ['Flintlock Pistol', 'long', 6, { cd: 2.4 }], ['Grenado', 'special', 7, { fx: 'splash' }]]);
  W('musketeer', 'Musketeer', 5, 'ranged', 'France · 17th c.', 'S2 · vs Ming Warrior',
    L(S.light, '#2f4f8a', '#5a3a26', 'cavalier', '#3a2a22', { plume: '#f0e6d0', cross: true, mustache: true }),
    [['Main Gauche', 'short', 5], ['Rapier', 'mid', 7, { r: 40 }], ['Matchlock Musket', 'long', 8, { cd: 2.6 }], ['Wheellock Pistol', 'special', 7, { fx: 'snipe', r: 160 }]]);
  W('conquistador', 'Conquistador', 5, 'heavy', 'Spain · 16th c. (Cortés’s soldiers)', 'Added · Hernán Cortés’s army',
    L(S.light, '#b9bec2', '#a8322a', 'morion', '#c4c8cb', { plume: '#a8322a', beard: '#2a1a1a' }),
    [['Toledo Sword', 'short', 8], ['Halberd', 'mid', 7, { r: 54 }], ['Arquebus', 'long', 7, { cd: 2.6 }], ['Steel Breastplate', 'special', 7, { fx: 'shield' }]], { armor: 0.35 });
  W('grenadier', 'Old Guard Grenadier', 5, 'heavy', 'French Empire · 1804–1815', 'Added · Napoleon’s army',
    L(S.light, '#2f3f8a', '#e6dccb', 'bearskin', '#1d1f24', { plume: '#a8322a', facing: '#e6dccb' }),
    [['Briquet Sabre', 'short', 6], ['Charleville Bayonet', 'mid', 7, { r: 48 }], ['Charleville Musket', 'long', 7, { cd: 2.4 }], ['Hand Grenade', 'special', 8, { fx: 'splash' }]]);
  W('washington', 'George Washington', 5, 'hero', 'United States · 1732–1799', 'S3 · vs Napoleon · Won',
    L(S.light, '#2f3f6a', '#e6dccb', 'tricorn', '#1d1f24', { facing: '#e0c46a', whiteHair: true, mounted: '#f0e6d0' }),
    [['Colichemarde Sword', 'short', 7], ['Brown Bess Bayonet', 'mid', 7, { r: 48 }], ['Brown Bess Musket', 'long', 7], ['Pennsylvania Long Rifle', 'long', 8, { cd: 2.6 }], ['6-Pound Cannon', 'special', 9, { fx: 'splash' }]]);
  W('napoleon', 'Napoleon Bonaparte', 5, 'hero', 'French Empire · 1769–1821', 'S3 · vs George Washington · Lost',
    L(S.light, '#2f3f8a', '#e6dccb', 'bicorne', '#1d1f24', { facing: '#e0c46a', mounted: '#e2d6c0' }),
    [['Cavalry Saber', 'short', 7], ['Charleville Bayonet', 'mid', 7, { r: 48 }], ['1777 Charleville Musket', 'long', 7], ['8-Pound Cannon', 'special', 9, { fx: 'splash' }]]);

  // ── Modern Warfare ──────────────────────────────────────────────────────
  W('greenberet', 'Green Beret', 6, 'ranged', 'U.S. Army Special Forces', 'S1 · vs Spetsnaz · Lost',
    L(S.light, '#5a6a3a', '#4a5a32', 'beret', '#2f5a3a', { vest: '#3a4228' }),
    [['E-Tool', 'short', 5], ['Beretta M9', 'mid', 6], ['Mossberg 500', 'mid', 8], ['M4A1 Carbine', 'long', 8, { cd: 0.8 }], ['M24 Sniper Rifle', 'long', 9, { cd: 2.2 }], ['M67 Frag Grenade', 'special', 8, { fx: 'splash' }]]);
  W('spetsnaz', 'Spetsnaz', 6, 'ranged', 'Russian special forces', 'S1 · vs Green Beret · Won',
    L(S.light, '#5a6a6a', '#3a4a4a', 'balaclava', '#2a2a2a', { vest: '#2a3232', stripes: true }),
    [['Ballistic Knife', 'short', 6], ['Makarov PM', 'mid', 6], ['Saiga-12', 'mid', 8], ['AK-74', 'long', 8, { cd: 0.8 }], ['Dragunov SVD', 'long', 9, { cd: 2.2 }], ['RGD-5 Grenade', 'special', 8, { fx: 'splash' }]]);
  W('seal', 'Navy SEAL', 6, 'ranged', 'U.S. Navy special warfare', 'S2 · vs Israeli Commando',
    L(S.light, '#3a4a5a', '#2a3440', 'boonie', '#3a4a3a', { vest: '#2a2a2a' }),
    [['Ka-Bar', 'short', 5], ['SIG P226', 'mid', 6], ['Mk 11 Sniper', 'long', 9, { cd: 2.2 }], ['C4 Charge', 'special', 9, { fx: 'splash' }]]);
  W('gurkha', 'Gurkha', 6, 'infantry', 'Nepal · British Army', 'S3 · vs French Foreign Legion',
    L(S.mid, '#5a6a3a', '#4a5a32', 'slouch', '#4a5a32', { vest: '#3a4228' }),
    [['Kukri', 'short', 9], ['L85 Bayonet', 'mid', 6, { r: 46 }], ['L85A2 Rifle', 'long', 7, { cd: 0.85 }], ['Kukri Charge', 'special', 8, { fx: 'flurry' }]], { speed: 1.15 });
  W('yakuza', 'Yakuza', 6, 'ranged', 'Japan · 20th c.', 'S1 · vs Mafia · Lost',
    L(S.light, '#1d1f24', '#1d1f24', 'slick', '#1a1a1a', { tie: '#e6dccb', tattoo: true }),
    [['Nunchaku', 'short', 5], ['Sai', 'short', 5], ['Walther P38', 'mid', 6], ['Sten Gun', 'long', 7, { cd: 0.7, r: 190 }], ['Ceramic Grenade', 'special', 7, { fx: 'splash' }]], { speed: 1.1 });
  W('capone', 'Al Capone', 6, 'hero', 'Chicago · 1899–1947', 'S2 · vs Jesse James',
    L(S.light, '#e6dccb', '#3a3a42', 'fedora', '#e6dccb', { tie: '#2a2a32', coat: '#3a3a42' }),
    [['Brass Knuckles', 'short', 4], ['Sawed-off Shotgun', 'mid', 8], ['Thompson SMG', 'long', 8, { cd: 0.6, r: 190 }], ['Chicago Typewriter', 'special', 9, { fx: 'volley', n: 9, proj: 'bullet' }]]);
  W('teddy', 'Teddy Roosevelt', 6, 'hero', 'Rough Riders · 1898', 'S3 · vs Lawrence of Arabia',
    L(S.light, '#a8925a', '#7a6a4a', 'slouch', '#a8925a', { mustache: true, glasses: true, neck: '#2f4f8a' }),
    [['Bowie Knife', 'short', 6], ['Colt Revolver', 'mid', 6], ['Krag-Jørgensen', 'long', 8], ['Gatling Gun', 'special', 9, { fx: 'volley', n: 8, proj: 'bullet' }]]);

  // ── Alien Invasion (fictional) ─────────────────────────────────────────
  // The final era, as in Age of War 2's future age. look.alien picks a body plan.
  const A = (alien, skin, body, glow, extra = {}) => ({ alien, skin, body, legs: body, helm: 'none', hc: body, glow, ...extra });
  W('grey', 'Zeta Grey', 7, 'ranged', 'Zeta Reticuli scouts', 'Fictional · alien invaders',
    A('grey', '#9fb0a6', '#c4ccd0', '#6ff2c8'),
    [['Psi Probe', 'short', 5, { k: 'knife' }], ['Stun Baton', 'mid', 6, { k: 'club' }], ['Plasma Pistol', 'long', 8, { k: 'pistol', proj: 'plasma', r: 230, cd: 1.1 }], ['Mind Blast', 'special', 8, { fx: 'fear' }]],
    { uniform: 'Silver flight suit, bare grey head, black almond eyes' });
  W('drone', 'Xeno Drone', 7, 'infantry', 'Hive swarm caste', 'Fictional · alien invaders',
    A('drone', '#3a4a2a', '#4f6a2a', '#b6ff4a'),
    [['Mandibles', 'short', 6, { k: 'knife' }], ['Scythe Claws', 'mid', 7, { k: 'sword' }], ['Acid Spit', 'long', 6, { k: 'throw', proj: 'acid', r: 190 }], ['Swarm Frenzy', 'special', 7, { fx: 'flurry' }]],
    { speed: 1.35, armor: 0.05, uniform: 'Green chitin shell, translucent wings, acid glands' });
  W('brute', 'Hive Brute', 7, 'heavy', 'Hive siege caste', 'Fictional · alien invaders',
    A('brute', '#5a3a4a', '#6a3a5a', '#ff5ad2'),
    [['Crusher Fists', 'short', 7, { k: 'club' }], ['Gravity Hammer', 'mid', 9, { k: 'club' }], ['Spike Launcher', 'long', 7, { k: 'throw', proj: 'acid', r: 200 }], ['Bio-Carapace', 'special', 9, { fx: 'shield' }]],
    { armor: 0.4, uniform: 'Plated purple carapace with glowing seams' });
  W('stalker', 'Void Stalker', 7, 'infantry', 'Phase assassins', 'Fictional · alien invaders',
    A('stalker', '#2a2a44', '#3a3a6a', '#8a7aff'),
    [['Energy Blade', 'short', 9, { k: 'sword' }], ['Phase Glaive', 'mid', 8, { k: 'spear', r: 56 }], ['Needle Gun', 'long', 6, { k: 'pistol', proj: 'plasma', r: 200 }], ['Cloak Ambush', 'special', 9, { fx: 'charge' }]],
    { speed: 1.25, uniform: 'Shimmering phase cloak over a black exo-frame' });
  W('trooper', 'Plasma Trooper', 7, 'ranged', 'Invasion infantry', 'Fictional · alien invaders',
    A('trooper', '#4a5a6a', '#2f3e52', '#4ad8ff'),
    [['Arc Knife', 'short', 6, { k: 'knife' }], ['Shock Pike', 'mid', 7, { k: 'spear', r: 52 }], ['Plasma Rifle', 'long', 9, { k: 'rifle', proj: 'plasma', cd: 0.7 }], ['Plasma Grenade', 'special', 9, { fx: 'splash', proj: 'plasma' }]],
    { uniform: 'Blue powered armor, glowing visor, plasma cell backpack' });
  W('sporewalker', 'Spore Walker', 7, 'ranged', 'Bio-war gardeners', 'Fictional · alien invaders',
    A('spore', '#6a5a3a', '#8a6a4a', '#ffb84a'),
    [['Tendril Lash', 'short', 5, { k: 'club' }], ['Thorn Whip', 'mid', 6, { k: 'spear' }], ['Spore Cannon', 'long', 7, { k: 'throw', proj: 'acid', r: 220 }], ['Spore Cloud', 'special', 8, { fx: 'hornets' }]],
    { uniform: 'Fungal hide studded with glowing spore sacs' });
  W('overmind', 'The Overmind', 7, 'hero', 'Psionic hive ruler', 'Fictional · alien invaders',
    A('overmind', '#c48aa8', '#4a2a5a', '#ff7af0'),
    [['Psionic Lash', 'short', 9, { k: 'club' }], ['Gravity Well', 'mid', 9, { k: 'club', r: 60 }], ['Mind Spear', 'long', 9, { k: 'throw', proj: 'ion', r: 260 }], ['Psionic Storm', 'special', 10, { fx: 'fear' }]],
    { uniform: 'Floating brain crowned by a violet psionic halo, robed in living silk' });
  W('queen', 'Hive Queen', 7, 'hero', 'Mother of the swarm', 'Fictional · alien invaders',
    A('queen', '#2a3a1a', '#3a5a2a', '#d4ff4a'),
    [['Royal Mandibles', 'short', 9, { k: 'knife' }], ['Barbed Tail', 'mid', 9, { k: 'spear', r: 60 }], ['Acid Torrent', 'long', 8, { k: 'throw', proj: 'acid', r: 220 }], ['Brood Call', 'special', 9, { fx: 'rally' }]],
    { uniform: 'Crested crown carapace, glowing egg-sac abdomen' });

  // Show matchups left out of the game: Taliban, IRA, Nazi SS, Khmer Rouge,
  // Saddam's Fedayeen, Somali pirates, the Medellín cartel, and the fictional
  // vampires vs. zombies episode.

  // ── Uniforms ────────────────────────────────────────────────────────────
  // Each warrior's dress, from historical sources where they exist. Details
  // checked against published sources: Persian Immortal dyes (yellow, blue,
  // purple robes), samurai clan lacing colors, the Inca checkerboard uncu,
  // Aztec jaguar and eagle suits, Continental Army facings (1779), the Old
  // Guard's bearskin, blue coat and white trousers, the Legion's white kepi,
  // the Zulu isicoco headring and leopard skin, and the Mongol deel worn under
  // lamellar. The rest follow well-known portraits and period dress.
  //
  // Look keys used here: pattern + pc (pattern colors) on the tunic, cuirass,
  // pteruges, tabard + emblem, shieldEmblem, trim, lapels, cuffs, epaulettes,
  // crossbelts, buttons, capeTrim, capeSpots, furCollar, scarf + scarfDots,
  // boots, beads, torc, helmDots, tassels, fringe, robe (to the ankle),
  // kaftan (to the knee), sode, manica, belt.
  const UNIFORMS = {
    spartan: ['Crimson chiton and cloak, bronze muscle cuirass, Corinthian helm, shield painted with the lambda (Λ) of Lacedaemon',
      { body: '#9c1f1a', cuirass: '#c08a36', pteruges: '#6a4a26', cape: '#8e1b16', capeTrim: '#d9b45a', shield: '#c08a36', shieldEmblem: 'lambda', ec: '#8e1b16', boots: '#b08a4a' }],
    centurion: ['Red tunic under a mail shirt hung with silver phalerae, transverse crest, red scutum with gold wings',
      { body: '#a32020', pattern: 'mail', pc: ['#b9bec2'], phalerae: true, pteruges: '#5a3a22', cape: '#7a1414', shield: '#a32020', shieldEmblem: 'wings', ec: '#d9b45a', boots: '#b08a4a' }],
    gladiator: ['Murmillo kit: bare chest, wide bronze balteus belt, linen manica on the sword arm, brimmed grille helmet',
      { body: '#b07a52', belt: '#c9a23a', manica: '#e6dccb', legs: '#e6dccb', boots: '#c9a23a' }],
    immortal: ['Long saffron robe with blue borders, purple trousers and cloth tiara, the costly dyes of the king’s guard',
      { body: '#d9a63a', trim: '#2f4f9a', pattern: 'rosette', pc: ['#2f4f9a'], legs: '#5a2a6a', robe: true, cape: '#5a2a6a', hc: '#e6dccb' }],
    alexander: ['White linothorax edged in gold, royal purple cloak, white-plumed helmet',
      { body: '#efe6d0', trim: '#c9a23a', pteruges: '#efe6d0', cape: '#5a1f5a', capeTrim: '#d9b45a', plume: '#ffffff', boots: '#8a5a2a' }],
    hannibal: ['Bronze breastplate, crimson Carthaginian cloak, black horsehair crest',
      { body: '#6e2a3a', cuirass: '#b8853a', pteruges: '#4a2a22', cape: '#8e1b2e', capeTrim: '#d9b45a', plume: '#1a1a1a' }],

    viking: ['Mail byrnie over a wool tunic with tablet-woven trim, red-and-white painted shield',
      { body: '#4e5f72', pattern: 'mail', pc: ['#9aa3aa'], trim: '#c9a23a', shield: '#a8322a', shieldEmblem: 'quarters', ec: '#efe4cf', legs: '#5a4630', boots: '#3a2a1a' }],
    samurai: ['O-yoroi laced in scarlet (the red of the Sanada), lacquered sode shoulder boards, gold kuwagata horns',
      { body: '#1e1e22', pattern: 'lacing', pc: ['#c22a22'], sode: '#1e1e22', trim: '#d9b45a', legs: '#2a2a2a' }],
    knight: ['Full plate under an azure surcoat with a gold lion rampant',
      { body: '#c4c8cb', tabard: '#2f4f9a', emblem: 'lion', ec: '#e0b84a', shieldEmblem: 'lion', ec2: '#e0b84a', legs: '#b9bec2', boots: '#9ea3a6' }],
    ninja: ['Indigo-black shinobi shozoku, crimson waist sash, split-toe tabi',
      { body: '#1b2030', legs: '#1b2030', sash: '#8a1a1a', boots: '#2a2a32' }],
    mongol: ['Blue deel coat belted in gold silk, iron lamellar, fur-trimmed helmet',
      { body: '#2f4f8a', pattern: 'lamellar', pc: ['#8a8f92'], belt: '#d9b45a', kaftan: true, boots: '#3a2a1a' }],
    wallace: ['Belted plaid (great kilt) in green-and-blue tartan, blue woad across the face',
      { body: '#2f5a3a', pattern: 'tartan', pc: ['#2f4f8a', '#a8322a'], legs: '#d9c9a0', boots: '#5a3a22' }],
    genghis: ['Deel of red silk woven with gold, iron lamellar, fur-trimmed helmet',
      { body: '#8a2a22', pattern: 'brocade', pc: ['#d9b45a'], kaftan: true, furCollar: '#7a5a3a', boots: '#2a1a12' }],

    jaguar: ['Full jaguar-pelt tlahuiztli suit, helmet in the jaguar’s open jaws, feathered chimalli shield',
      { body: '#d8a23a', pattern: 'rosette', pc: ['#3a2410'], legs: '#d8a23a', legsPattern: true, shieldEmblem: 'feathers', ec: '#2f8a6a' }],
    eagle: ['Feathered eagle suit over quilted cotton ichcahuipilli, beaked eagle helmet',
      { body: '#f0e6d0', pattern: 'feathers', pc: ['#b9a888'], legs: '#f0e6d0', legsPattern: true, shieldEmblem: 'feathers', ec: '#a8322a' }],
    holkan: ['Padded cotton jacket dyed red, jade bead collar, quetzal-feather headdress',
      { body: '#a8322a', pattern: 'quilt', pc: ['#7a1a14'], beads: '#3ab48a', legs: '#e6dccb' }],
    inca: ['Black-and-white checkerboard uncu with a red yoke, the uniform of the Inca army',
      { body: '#1a1a1a', pattern: 'checker', pc: ['#efe4cf'], trim: '#c8312b', yoke: '#c8312b', legs: '#5a3a26' }],
    apache: ['Calico trade shirt, long breechcloth, red headband, knee-high moccasins',
      { body: '#c9a26a', pattern: 'calico', pc: ['#a8322a'], legs: '#7a5a3a', boots: '#b8925a' }],
    crazyhorse: ['Plain buckskin, a single hawk feather, painted lightning bolt and hail spots',
      { body: '#c9a26a', fringe: '#b8925a', paintBolt: true, legs: '#8a6a4a', boots: '#b8925a' }],
    cuauhtemoc: ['Turquoise-and-gold regalia, quetzal headdress, royal blue-green cloak',
      { body: '#2f8a9a', pattern: 'feathers', pc: ['#d9b45a'], cape: '#1f6a6a', capeTrim: '#d9b45a', beads: '#d9b45a', shieldEmblem: 'sun', ec: '#d9b45a' }],

    pirate: ['Crimson frock coat with gold buttons, red sash, tricorn, gold earring',
      { body: '#7a1a1a', kaftan: true, buttons: '#d9b45a', sash: '#c8312b', trim: '#d9b45a', legs: '#2a2a3a', boots: '#2a1a12' }],
    musketeer: ['Blue casaque with white crosses, wide plumed hat, bucket-top boots',
      { body: '#2f4f9a', trim: '#e6dccb', legs: '#5a3a26', boots: '#5a3a1a', lapels: null }],
    conquistador: ['Morion helmet, steel peto breastplate over a slashed red doublet',
      { body: '#a8322a', pattern: 'slashed', pc: ['#d9b45a'], cuirass: '#b9bec2', legs: '#3a2a22', boots: '#2a1a12' }],
    grenadier: ['Old Guard grenadier: dark blue coat, white lapels, red epaulettes and cuffs, tall bearskin, white trousers',
      { body: '#1f2e6a', lapels: '#f4efe4', cuffs: '#b0221c', epaulettes: '#c8312b', crossbelts: '#f4efe4', buttons: '#d9b45a', legs: '#f4efe4', boots: '#1a1a1a' }],
    washington: ['Blue general’s coat with buff facings and gold epaulettes, buff waistcoat and breeches',
      { body: '#273a6a', lapels: '#d9c9a0', cuffs: '#d9c9a0', epaulettes: '#d9b45a', buttons: '#d9b45a', legs: '#d9c9a0', boots: '#1a1a1a', sash: '#2f6aa8' }],
    napoleon: ['Grey greatcoat over a green chasseur uniform, bicorne worn side-on',
      { body: '#7c7d78', coat: '#7c7d78', lapels: '#2f5a3a', buttons: '#d9b45a', legs: '#efe4cf', boots: '#1a1a1a' }],

    greenberet: ['Green beret with unit flash, woodland-pattern battle dress',
      { body: '#5a6a3a', pattern: 'woodland', pc: ['#3a4a2a', '#7a6a42', '#1e2418'], legs: '#5a6a3a', legsPattern: true, boots: '#1a1a1a' }],
    spetsnaz: ['Blue-and-white telnyashka under a green digital Flora camo smock, black balaclava',
      { body: '#5a6a5a', pattern: 'digital', pc: ['#3a4a3a', '#7a7a5a'], legs: '#4a5a4a', legsPattern: true, boots: '#1a1a1a' }],
    seal: ['MultiCam fatigues, plate carrier and boonie hat',
      { body: '#8a7f62', pattern: 'multicam', pc: ['#5a6a42', '#a8946a', '#4a3a2a'], legs: '#8a7f62', legsPattern: true, boots: '#6a5a42' }],
    gurkha: ['Terai slouch hat, MTP fatigues, kukri worn at the belt',
      { body: '#7a7a52', pattern: 'multicam', pc: ['#5a6a42', '#9a8a62', '#3a3226'], legs: '#7a7a52', legsPattern: true, boots: '#3a2a1a' }],
    yakuza: ['Black suit open over full-body irezumi tattoos',
      { body: '#16161c', lapels: '#0e0e12', legs: '#16161c', boots: '#111' }],
    capone: ['Cream pinstripe suit, cream fedora with a dark band, overcoat',
      { body: '#e6dccb', pattern: 'pinstripe', pc: ['#a89a82'], coat: '#d8ccb8', lapels: '#c8bca8', legs: '#e6dccb', boots: '#3a2a1a' }],
    teddy: ['Rough Riders kit: dark blue flannel shirt, brown canvas trousers, slouch hat, blue polka-dot neckerchief',
      { body: '#2c3a5a', legs: '#a8925a', scarf: '#2f4f8a', scarfDots: '#efe4cf', boots: '#6a4a2a', belt: '#5a3a1a' }],
  };
  for (const w of warriors) {
    const u = UNIFORMS[w.id];
    if (!u) continue;
    w.uniform = u[0];
    Object.assign(w.look, u[1]);
  }

  return { eras, warriors };
})();
