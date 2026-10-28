// Age of Warriors — engine, AI, rendering and UI.
(() => {
  'use strict';

  const DATA = window.AOW_DATA;
  const ERAS = DATA.eras;

  // ── World ───────────────────────────────────────────────────────────────
  const WORLD_W = 1500, WORLD_H = 350, GROUND = 296;
  const BASE_X = [70, WORLD_W - 70];
  const DIR = [1, -1];
  const BASE_HALF = 44;
  const baseEdge = (team) => BASE_X[team] + DIR[team] * BASE_HALF;
  const spawnX = (team) => BASE_X[team] + DIR[team] * (BASE_HALF + 8);
  const MAX_QUEUE = 5;
  const INCOME = 2.6;           // passive gold per second, scaled by era
  const SLOT_COST = [0, 140, 380, 800];
  const MAX_SLOTS = 4;
  const TOWER_MAX_LV = 3;
  const TEAM_COL = ['#47b3c2', '#d4533a'];

  const ROLE = {
    infantry: { hp: 110, armor: 0.1, speed: 42, cost: 20, train: 1.5, label: 'Infantry' },
    ranged: { hp: 82, armor: 0.05, speed: 40, cost: 26, train: 1.8, label: 'Ranged' },
    heavy: { hp: 175, armor: 0.3, speed: 34, cost: 40, train: 2.6, label: 'Heavy' },
    hero: { hp: 400, armor: 0.25, speed: 40, cost: 115, train: 4.5, label: 'Hero' },
  };
  const DIFF = {
    recruit: { income: 0.62, think: 2.8, xp: 0.75, label: 'Recruit' },
    warrior: { income: 1.0, think: 1.6, xp: 1.0, label: 'Warrior' },
    deadliest: { income: 1.35, think: 1.0, xp: 1.2, label: 'Deadliest' },
  };
  const SLOT_LABEL = { short: 'Short range', mid: 'Mid range', long: 'Long range', special: 'Special' };
  const FX_TEXT = {
    shield: 'Raises a guard: 55% less damage for 4 s',
    stun: 'Hits and stuns the target',
    charge: 'Charges in and knocks the front enemy back',
    splash: 'Explodes and hits every enemy in the blast',
    volley: 'Fires a rapid volley',
    poison: 'Poisons the target for 5 s',
    fire: 'Sets every enemy in the area on fire',
    flurry: 'A rapid flurry of strikes',
    rally: 'Rallies nearby allies: +30% damage and speed',
    fear: 'Terrifies nearby enemies and freezes them in place',
    snipe: 'One precise, armor-piercing shot',
    hornets: 'A hornet nest that stings everyone nearby',
  };

  // ── Weapon building ─────────────────────────────────────────────────────
  // Damage comes from the 1–10 power rating, the slot and the era. Power
  // follows a curve, so a 10 hits about four times harder than a 4, and
  // widely issued weapons (knives, clubs, slings, sidearms, plain spears)
  // hit softer still. Prices climb steeply with power (see priceOf).
  const COMMON_RE = /knife|dagger|dirk|pugio|seax|tanto|bayonet|sling|huaraca|^spear$|iberian spear|thrusting spear|club|knobkerrie|cestus|baseball bat|ice pick|knuckles|pistol|revolver|walther|makarov|beretta|glock|\bp7\b|webley|colt|nambu|machete|sabre|saber|hanger|e-tool|nunchaku|\bsai\b|tumi|tecpatl|makraka|jambiya|bowie|ka-bar|main gauche|krav|^bow$|^lance$/;
  const COMMON_DMG = 0.72;
  const effPower = (p) => 7 * Math.pow(p / 7, 1.5);
  const TIERS = [
    { id: 'common', label: 'Common', min: 0 },
    { id: 'standard', label: 'Standard', min: 5 },
    { id: 'elite', label: 'Elite', min: 8 },
    { id: 'legendary', label: 'Legendary', min: 9 },
  ];
  const tierOf = (p, common) => (common || p < 5 ? TIERS[0] : p >= 9 ? TIERS[3] : p >= 8 ? TIERS[2] : TIERS[1]);
  // Price weight of one weapon: steep in power, discounted when common.
  const priceWeight = (w) => Math.pow(w.power / 7, 2.5) * (w.common ? 0.55 : 1) * (w.slot === 'special' ? 1.5 : 1);
  function priceOf(weapons) {
    const weights = weapons.reduce((s, w) => s + (w.slot === 'special' ? 1.5 : 1), 0);
    const mean = weapons.reduce((s, w) => s + priceWeight(w), 0) / weights;
    const top = Math.max(...weapons.map((w) => Math.pow(w.power / 7, 2.5) * (w.common ? 0.55 : 1)));
    return 0.25 + 0.75 * (0.6 * mean + 0.4 * top);
  }
  const KIND_RULES = [
    ['spear', /bayonet/],
    ['rifle', /musket|arquebus|rifle|carbine|\bm4|ak-|famas|tavor|vintorez|psg|mp5|thompson|smg|shotgun|blunderbuss|remington|lupara|pishchal|brown bess|winchester|krag|lee-enfield|mauser|saiga|uzi|m1014|\bsks|type 88|ar-15|mk 11|coach gun|sawed|hand cannon|sten gun|mossberg|dragunov|\bm24/],
    ['pistol', /pistol|revolver|glock|sig p|\bp7\b|nambu|colt|webley|walther|makarov|beretta/],
    ['bow', /\bbow\b|crossbow|yumi|scorpio|gastraphetes|rocket arrows/],
    ['throw', /javelin|pilum|sling|huaraca|atlatl|shuriken|chakram|kpinga|throwing|stingray|rope dart/],
    ['spear', /spear|dory|sarissa|lance|naginata|halberd|trident|taiaha|tepoztopilli|guan dao|^ji$|bardiche|kontos|jida|kusari|chuqui|iklwa/],
    ['axe', /axe|tomahawk|sagaris|e-tool/],
    ['club', /club|mace|kanabo|knobkerrie|champi|morning star|mere|ball & chain|staff|knuckles|krav|nunchaku|cestus|baseball bat/],
    ['knife', /knife|dirk|tanto|piercer|katar|pugio|kukri|bowie|ka-bar|tecpatl|tumi|ice pick|main gauche|makraka|jambiya|seax|dagger|\bsai\b/],
  ];
  const kindOf = (name) => {
    const n = name.toLowerCase();
    for (const [k, re] of KIND_RULES) if (re.test(n)) return k;
    return 'sword';
  };
  const RANGED = new Set(['bow', 'throw', 'pistol', 'rifle']);
  const LONG_RANGE = { arrow: 230, bolt: 240, javelin: 165, stone: 200, dart: 210, star: 140, bullet: 270, rocket: 250, plasma: 280, acid: 190, ion: 300 };
  const LONG_CD = { arrow: 1.6, bolt: 2.0, javelin: 1.8, stone: 1.5, dart: 1.6, star: 1.0, bullet: 1.5, rocket: 2.2, plasma: 1.2, acid: 1.5, ion: 2.4 };
  const PROJ_SPEED = { bullet: 950, arrow: 430, bolt: 520, javelin: 340, stone: 380, dart: 400, star: 380, rocket: 380, bomb: 300, fire: 320, nest: 300, net: 300, rope: 360, bola: 360, flash: 330, shell: 460, stake: 320, plasma: 640, acid: 360, ion: 520 };

  function projOf(kind, n) {
    if (kind === 'bow') return /crossbow|scorpio|gastraphetes/.test(n) ? 'bolt' : 'arrow';
    if (kind === 'throw') {
      if (/sling|huaraca/.test(n)) return 'stone';
      if (/atlatl|rope dart/.test(n)) return 'dart';
      if (/shuriken|chakram|kpinga/.test(n)) return 'star';
      return 'javelin';
    }
    return 'bullet';
  }

  function buildWeapon(t, era) {
    const [name, slot, power, o = {}] = t;
    const n = name.toLowerCase();
    const kind = o.k || kindOf(name);
    const mul = ERAS[era].dmgMul;
    const w = { name, slot, power, kind, pierce: o.pierce || 0, ammo: o.ammo ?? null };
    w.common = slot !== 'special' && COMMON_RE.test(n);
    w.tier = tierOf(power, w.common);
    if (slot === 'special') return buildSpecial(w, o, mul, era);
    const pe = effPower(power) * (w.common ? COMMON_DMG : 1);
    w.ranged = RANGED.has(kind);
    let cd0, base;
    if (w.ranged) {
      w.proj = o.proj || projOf(kind, n);
      const sniper = /sniper|psg|vintorez|mk 11|long rifle|dragunov|\bm24/.test(n);
      if (slot === 'long') {
        w.range = o.r || (sniper ? 340 : kind === 'pistol' ? 160 : LONG_RANGE[w.proj]);
        cd0 = sniper ? 2.2 : kind === 'pistol' ? 1.2 : LONG_CD[w.proj];
        base = pe * 3.0;
      } else {
        w.range = o.r || (slot === 'mid' ? 95 : 70);
        cd0 = 1.2;
        base = pe * 3.4;
      }
      if (w.proj === 'bullet' && !w.pierce) w.pierce = 0.3;
    } else {
      w.range = o.r || (slot === 'short' ? 24 : 42);
      cd0 = slot === 'short' ? 0.75 : 1.05;
      base = pe * (slot === 'short' ? 2.6 : 3.6);
    }
    w.cd = o.cd || cd0;
    w.dmg = base * Math.pow(w.cd / cd0, 0.75) * mul;
    return w;
  }

  function buildSpecial(w, o, mul, era) {
    const p = effPower(w.power);
    const fx = o.fx;
    const S = {
      shield: { cd: 9, r: 80 },
      stun: { cd: 7, r: 34, dmg: p * 2.2, stun: 1.4 },
      charge: { cd: 10, r: 150, dmg: p * 5 },
      splash: { cd: 9, r: 190, dmg: p * 4.2, aoe: 56, proj: 'bomb' },
      volley: { cd: 8, r: 230, dmg: p * 2.0, n: 4 },
      poison: { cd: 8, r: 170, dmg: p * 0.8, dot: p * 1.3, dotT: 5, proj: 'dart' },
      fire: { cd: 9, r: 200, dmg: p * 2.4, aoe: 46, dot: p * 1.1, dotT: 3, proj: 'fire' },
      flurry: { cd: 7, r: 32, dmg: p * 1.8, n: 4 },
      rally: { cd: 14, r: 260, aura: 170 },
      fear: { cd: 12, r: 90, aoe: 100, dmg: p * 1.5, stun: 1.4 },
      snipe: { cd: 9, r: 340, dmg: p * 7, proj: 'bullet', pierce: 0.6 },
      hornets: { cd: 10, r: 180, dmg: p * 1, aoe: 62, dot: p * 1.6, dotT: 4, proj: 'nest' },
    }[fx];
    Object.assign(w, { fx, ranged: false, dmg: 0, dot: 0 }, S);
    if (o.r) w.r = o.r;
    if (o.n) w.n = o.n;
    if (o.aoe) w.aoe = o.aoe;
    if (o.proj) w.proj = o.proj;
    const n = w.name.toLowerCase();
    if (fx === 'volley' && !w.proj) w.proj = era >= 3 ? 'bullet' : 'arrow';
    if (fx === 'fire' && /molotov/.test(n)) { w.r = 150; }
    if (fx === 'stun' && w.r > 50 && !w.proj) {
      w.proj = /net/.test(n) ? 'net' : /lasso/.test(n) ? 'rope' : /bola/.test(n) ? 'bola' : /flash/.test(n) ? 'flash' : 'stone';
    }
    if (fx === 'splash' && /cannon|pounder|pound cannon|grapeshot|mangonel|catapult/.test(n)) w.proj = /catapult|mangonel/.test(n) ? 'stone' : 'shell';
    if (fx === 'splash' && /rpg/.test(n)) w.proj = 'rocket';
    w.dmg *= mul;
    w.dot *= mul;
    w.range = w.r;
    return w;
  }

  // ── Warrior definitions ─────────────────────────────────────────────────
  // duel: equal base health for every warrior, so weapons, armor and speed decide.
  function makeDef(raw, statEra = raw.era, duel = false) {
    const role = ROLE[raw.role];
    const era = ERAS[statEra];
    const weapons = raw.weapons.map((t) => buildWeapon(t, statEra));
    const normal = weapons.filter((w) => w.slot !== 'special');
    const special = weapons.find((w) => w.slot === 'special') || null;
    const price = priceOf(weapons);
    const best = weapons.reduce((a, w) => (TIERS.indexOf(w.tier) > TIERS.indexOf(a.tier) ? w : a), weapons[0]);
    const mounted = !!raw.look.mounted;
    const melee = normal.filter((w) => !w.ranged);
    return {
      ...raw,
      raw,
      roleInfo: role,
      weapons, normal, special,
      hero: raw.role === 'hero',
      mounted,
      hp: Math.round((duel ? 95 : role.hp) * era.hpMul * (raw.hpMul || 1) * (mounted ? 1.15 : 1)),
      armor: duel ? Math.min(0.2, (raw.armor ?? role.armor) * 0.5) : raw.armor ?? role.armor,
      speed: role.speed * (raw.speed || 1) * (mounted && raw.role === 'hero' ? 1.15 : 1),
      cost: Math.round(role.cost * price * era.costMul * (mounted ? 1.1 : 1)),
      tier: best.tier,
      train: role.train,
      reach: melee.length ? Math.max(...melee.map((w) => w.range)) : 26,
    };
  }
  const DEFS = DATA.warriors.map((raw) => makeDef(raw));
  // Turrets: priced like weapons, damage scaled so fast guns hit lighter.
  const TURRET_BASE = [110, 240, 480, 950, 1800, 3400];
  // Towers are priced on their damage output and what their effect adds.
  ERAS.forEach((era, i) => era.turrets.forEach((t) => {
    t.dmg0 = effPower(t.power) * 3.2 * Math.pow(t.cd / 1.6, 0.75);
    const value = (t.dmg0 * (t.n || 1) / t.cd) * (t.aoe ? 1.8 : 1) * (t.effect === 'line' ? 1.6 : 1)
      * (t.effect === 'slow' || t.effect === 'stun' ? 1.3 : 1) * (t.burn ? 1.25 : 1) * (t.target === 'strongest' ? 1.1 : 1);
    t.cost = Math.round((TURRET_BASE[i] * Math.pow(value / 22, 1.1)) / 5) * 5;
    t.tier = tierOf(t.power, false);
    t.era = i;
  }));
  const DEF_BY_ID = Object.fromEntries(DEFS.map((d) => [d.id, d]));
  ERAS.forEach((era) => era.turrets.forEach((t) => { t.byNames = (t.by || []).map((id) => DEF_BY_ID[id].name); }));
  const TOWER_EFFECT = (t) => [
    t.effect === 'line' ? 'Pierces up to three enemies' : null,
    t.effect === 'volley' ? `Volleys of ${t.n}` : null,
    t.aoe ? 'Blast damage' : null,
    t.effect === 'slow' ? 'Slows enemies' : null,
    t.effect === 'stun' ? 'Stuns enemies' : null,
    t.burn ? 'Sets enemies burning' : null,
    t.target === 'strongest' ? 'Targets the strongest enemy' : null,
  ].filter(Boolean).join(' · ') || 'Single target';
  const BY_ERA = ERAS.map((_, i) => DEFS.filter((d) => d.era === i));

  // ── Sound ───────────────────────────────────────────────────────────────
  const Sound = {
    on: false, ac: null, last: {},
    init() {
      if (this.ac) return;
      try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ac = null; }
    },
    play(type) {
      if (!this.on || !this.ac) return;
      const now = this.ac.currentTime;
      if (this.last[type] && now - this.last[type] < 0.06) return;
      this.last[type] = now;
      const ac = this.ac;
      const g = ac.createGain();
      g.connect(ac.destination);
      const noise = (dur, freq, q, vol) => {
        const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = ac.createBufferSource();
        src.buffer = buf;
        const f = ac.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        src.connect(f); f.connect(g);
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.start(now);
      };
      const tone = (f0, f1, dur, vol, wave = 'square') => {
        const o = ac.createOscillator();
        o.type = wave;
        o.frequency.setValueAtTime(f0, now);
        o.frequency.exponentialRampToValueAtTime(f1, now + dur);
        o.connect(g);
        g.gain.setValueAtTime(vol, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        o.start(now); o.stop(now + dur);
      };
      switch (type) {
        case 'melee': noise(0.08, 2400, 1.2, 0.12); break;
        case 'shot': noise(0.12, 900, 0.7, 0.18); break;
        case 'bow': tone(700, 260, 0.09, 0.05, 'triangle'); break;
        case 'boom': noise(0.5, 160, 0.6, 0.4); break;
        case 'die': tone(220, 70, 0.25, 0.06, 'sawtooth'); break;
        case 'coin': tone(980, 1500, 0.08, 0.04, 'triangle'); break;
        case 'evolve': tone(330, 990, 0.6, 0.08, 'triangle'); break;
        case 'ui': tone(520, 640, 0.05, 0.04, 'triangle'); break;
        case 'base': noise(0.2, 400, 0.8, 0.18); break;
      }
    },
  };

  // ── Game state ──────────────────────────────────────────────────────────
  let S = null;
  let difficulty = 'warrior';
  let variant = 'skirmish';

  // Armory research: bought with gold during a battle, five levels each.
  const UPGRADES = [
    { id: 'blades', name: 'Forged Weapons', desc: '+10% damage for every warrior', per: 0.1, base: 120 },
    { id: 'armor', name: 'Hardened Armor', desc: '+10% health for warriors you train', per: 0.1, base: 120 },
    { id: 'drill', name: 'Drill Masters', desc: 'Train warriors 12% faster', per: 0.12, base: 90 },
    { id: 'tribute', name: 'Tribute', desc: '+20% gold over time', per: 0.2, base: 150 },
    { id: 'walls', name: 'Fortify', desc: '+12% stronghold health', per: 0.12, base: 140 },
    { id: 'engineers', name: 'Engineers', desc: '+12% turret damage, +6% range', per: 0.12, base: 130 },
  ];
  const UP_MAX = 5;
  const UP_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
  const upMul = (sd, id) => 1 + sd.up[id] * UP_BY_ID[id].per;
  const upCost = (sd, up) => Math.round(up.base * Math.pow(1 + sd.up[up.id], 1.4) * Math.pow(ERAS[sd.era].costMul, 0.85));

  // Veterancy: kills needed for Veteran, Elite and Legend.
  const RANKS = [2, 5, 9];
  const RANK_NAMES = ['Recruit', 'Veteran', 'Elite', 'Legend'];
  const HOLD_DIST = 470;

  // Records and achievements live in this browser only.
  const ACH = [
    { id: 'firstblood', name: 'First Blood', desc: 'Slay your first enemy' },
    { id: 'steel', name: 'Forged in Steel', desc: 'Reach the Age of Steel' },
    { id: 'modern', name: 'Modern Warfare', desc: 'Reach Modern Warfare' },
    { id: 'alien', name: 'First Contact', desc: 'Evolve into the Alien Invasion' },
    { id: 'victory', name: 'Victory', desc: 'Win a skirmish' },
    { id: 'deadliest', name: 'Deadliest Warrior', desc: 'Win a skirmish on Deadliest' },
    { id: 'fortress', name: 'Untouchable', desc: 'Win with your stronghold above 90% health' },
    { id: 'legend', name: 'Living Legend', desc: 'Raise a warrior to Legend rank' },
    { id: 'armorer', name: 'Master Armorer', desc: 'Max out an armory upgrade' },
    { id: 'engineer', name: 'Siege Engineer', desc: 'Man all four tower slots' },
    { id: 'heroes', name: 'Hall of Heroes', desc: 'Field five heroes in one battle' },
    { id: 'wave10', name: 'Hold the Line', desc: 'Survive 10 waves' },
    { id: 'wave20', name: 'Last Stand', desc: 'Survive 20 waves' },
    { id: 'analyst', name: 'Battle Analyst', desc: 'Run 10 simulations' },
    { id: 'nightowl', name: 'Night Raider', desc: 'Slay 50 enemies at night in one battle' },
  ];
  const REC = (() => {
    const base = { ach: {}, wins: { recruit: 0, warrior: 0, deadliest: 0 }, losses: 0, bestWave: 0, kills: 0, sims: 0 };
    try { const v = JSON.parse(localStorage.getItem('aow-records') || 'null'); if (v) return { ...base, ...v, wins: { ...base.wins, ...(v.wins || {}) } }; } catch (e) { /* storage blocked */ }
    return base;
  })();
  function saveRec() { try { localStorage.setItem('aow-records', JSON.stringify(REC)); } catch (e) { /* storage blocked */ } }
  function unlock(id) {
    if (REC.ach[id]) return;
    REC.ach[id] = Date.now();
    saveRec();
    const a = ACH.find((x) => x.id === id);
    if (a && typeof toast === 'function') toast(`Achievement unlocked: ${a.name}`);
    Sound.play('evolve');
  }
  const playing = () => S && S.mode === 'play' && !S.sim;

  function newBase(team) {
    return { isBase: true, team, x: BASE_X[team], hp: ERAS[0].baseHp, maxHp: ERAS[0].baseHp, slots: 1, turrets: [null, null, null, null], flash: 0 };
  }
  function newSide(team, ai) {
    return {
      team, ai, gold: 180, xp: 0, era: 0, queue: [], trainT: 0, abilityCd: 12, base: newBase(team), kills: 0, lost: 0, trained: 0, aiT: 1.5, dmgDealt: 0,
      up: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])), stance: 'advance', heroesTrained: 0,
    };
  }
  function newGame(mode) {
    S = {
      mode, t: 0, over: false, winner: -1, paused: false, speed: 1,
      sides: [newSide(0, mode === 'attract'), newSide(1, true)],
      units: [], projs: [], fx: [], texts: [], teams: [[], []], parts: [], decals: [], shake: 0, heroes: [[], []],
      cam: mode === 'attract' ? WORLD_W / 2 : 0, endT: 0, uid: 0, tod: mode === 'attract' ? Math.random() : 0.3,
      variant: mode === 'play' ? variant : mode, nightKills: 0, killLog: [], sim: mode === 'sim',
    };
    if (mode === 'sim' || mode === 'duel') {
      for (const sd of S.sides) { sd.ai = false; sd.base.hp = sd.base.maxHp = Infinity; }
    }
    if (S.variant === 'survival') {
      const e = S.sides[1];
      e.ai = false;
      e.base.hp = e.base.maxHp = Infinity;
      S.wave = { n: 0, t: 8, queue: [], spawnT: 0 };
    }
    if (mode === 'attract') { S.sides[0].gold = 400; S.sides[1].gold = 400; }
  }

  const sideOf = (team) => S.sides[team];
  const diffOf = () => DIFF[difficulty];
  const heroActive = (sd) => S.units.some((u) => !u.dead && u.team === sd.team && u.def.hero) || sd.queue.some((d) => d.hero);
  const slotCost = (sd) => Math.round(SLOT_COST[sd.base.slots] * ERAS[sd.era].costMul);

  function spawnUnit(def, team, x = spawnX(team), hpMul = 1) {
    const hp = def.hp * hpMul * upMul(sideOf(team), 'armor');
    const u = {
      id: ++S.uid, def, team, x, hp, maxHp: hp, armor: def.armor, kills: 0, rank: 0,
      cd: 0.2, specCd: 1 + Math.random() * 2, ammo: def.normal.map((w) => w.ammo ?? Infinity),
      stunT: 0, shieldT: 0, rallyT: 0, pauseT: 0, chargeT: 0, flash: 0, dots: [],
      walk: Math.random() * 6, swing: 0, swingW: null, weapon: def.normal[0], dead: false, deathT: 0, burst: null,
    };
    S.units.push(u);
    const sd = sideOf(team);
    sd.trained++;
    if (def.hero) {
      sd.heroesTrained++;
      if (team === 0 && playing() && sd.heroesTrained >= 5) unlock('heroes');
    }
    return u;
  }

  function buyUpgrade(sd, up) {
    if (S.over) return null;
    if (sd.up[up.id] >= UP_MAX) return `${up.name} is fully researched`;
    const c = upCost(sd, up);
    if (sd.gold < c) return `Not enough gold: ${up.name} costs ${c}`;
    sd.gold -= c;
    sd.up[up.id]++;
    if (up.id === 'walls') {
      const add = ERAS[sd.era].baseHp * up.per;
      sd.base.maxHp += add;
      sd.base.hp += add;
    }
    if (sd.team === 0 && playing() && sd.up[up.id] >= UP_MAX) unlock('armorer');
    return null;
  }

  function setStance(sd, st) {
    sd.stance = st;
  }

  function recruit(sd, def) {
    if (S.over) return null;
    if (def.era !== sd.era) return 'That warrior belongs to another era';
    if (sd.queue.length >= MAX_QUEUE) return 'Training queue is full (5 max)';
    if (def.hero && heroActive(sd)) return 'Only one hero can take the field at a time';
    if (sd.gold < def.cost) return `Not enough gold: ${def.name} costs ${def.cost}`;
    sd.gold -= def.cost;
    sd.queue.push(def);
    return null;
  }

  function evolve(sd) {
    if (S.over) return null;
    if (sd.era >= ERAS.length - 1) return 'You have reached the final era';
    const next = ERAS[sd.era + 1];
    if (sd.xp < next.xp) return `Need ${Math.ceil(next.xp - sd.xp)} more experience`;
    sd.era++;
    const b = sd.base;
    const ratio = b.hp / b.maxHp;
    if (isFinite(b.maxHp)) {
      b.maxHp = next.baseHp * upMul(sd, 'walls');
      b.hp = Math.min(b.maxHp, ratio * b.maxHp + 0.2 * b.maxHp);
    }
    if (sd.team === 0 && playing()) { if (sd.era >= 1) unlock('steel'); if (sd.era >= 4) unlock('modern'); if (sd.era >= 5) unlock('alien'); }
    if (sd.team === 0 && S.mode === 'play') {
      showBanner(next.name, next.span);
      Sound.play('evolve');
      buildCards();
    }
    return null;
  }

  function buyTurret(sd, tdef, at = -1) {
    if (S.over) return null;
    const b = sd.base;
    let slot = at;
    if (slot < 0) for (let i = 0; i < b.slots; i++) if (!b.turrets[i]) { slot = i; break; }
    if (slot < 0 || slot >= b.slots || b.turrets[slot]) return b.slots < MAX_SLOTS ? 'No empty slot. Build another tower slot first' : 'All four tower slots are full. Sell a tower first';
    if (sd.gold < tdef.cost) return `Not enough gold: ${tdef.name} costs ${tdef.cost}`;
    sd.gold -= tdef.cost;
    b.turrets[slot] = { def: tdef, era: sd.era, cd: 0.5, angle: 0, dmg: tdef.dmg0 * ERAS[sd.era].dmgMul, flashT: 0, level: 1, spent: tdef.cost, odT: 0, odCd: 0, syn: false };
    if (sd.team === 0 && playing() && b.turrets.every(Boolean)) unlock('engineer');
    return null;
  }
  const upgradeCost = (t) => Math.round((t.def.cost * 0.6 * t.level) / 5) * 5;
  function upgradeTurret(sd, i) {
    if (S.over) return null;
    const t = sd.base.turrets[i];
    if (!t) return 'No tower in that slot';
    if (t.level >= TOWER_MAX_LV) return `${t.def.name} is fully upgraded`;
    const c = upgradeCost(t);
    if (sd.gold < c) return `Not enough gold: the upgrade costs ${c}`;
    sd.gold -= c;
    t.spent += c;
    t.level++;
    return null;
  }
  // Overdrive: the tower fires 2.5× faster and hits 25% harder for 6 s.
  const OD_TIME = 6, OD_COOLDOWN = 30;
  function overdrive(sd, i) {
    if (S.over) return null;
    const t = sd.base.turrets[i];
    if (!t) return 'No tower in that slot';
    if (t.odCd > 0) return `${t.def.name} can overdrive again in ${Math.ceil(t.odCd)} s`;
    t.odT = OD_TIME;
    t.odCd = OD_COOLDOWN;
    if (sd.team === 0 && S.mode === 'play') {
      const p = turretPos(sd.team, i);
      S.fx.push({ type: 'ring', x: p.x, y: GROUND - 20, r: 40, t: 0, dur: 0.5, col: '#ff9a4a' });
      Sound.play('evolve');
    }
    return null;
  }
  function buySlot(sd) {
    const b = sd.base;
    if (b.slots >= MAX_SLOTS) return 'The stronghold already has four tower slots';
    const c = slotCost(sd);
    if (sd.gold < c) return `Not enough gold: a new slot costs ${c}`;
    sd.gold -= c;
    b.slots++;
    return null;
  }
  function sellTurret(sd, at = -1) {
    const b = sd.base;
    let i = at;
    if (i < 0) for (let k = MAX_SLOTS - 1; k >= 0; k--) if (b.turrets[k]) { i = k; break; }
    if (i < 0 || !b.turrets[i]) return 'No tower to sell';
    sd.gold += Math.round(b.turrets[i].spent * 0.5);
    b.turrets[i] = null;
    return null;
  }

  function useAbility(sd) {
    if (S.over) return null;
    if (S.paused) return 'Resume the game to use the era attack';
    if (sd.abilityCd > 0) return `${ERAS[sd.era].ability.name} is ready in ${Math.ceil(sd.abilityCd)} s`;
    const era = ERAS[sd.era];
    const ab = era.ability;
    sd.abilityCd = ab.cd;
    const dir = DIR[sd.team];
    const foes = S.teams[1 - sd.team];
    let x0, x1;
    if (foes.length) {
      const xs = foes.map((u) => u.x);
      x0 = Math.min(...xs) - 30; x1 = Math.max(...xs) + 30;
    } else {
      x0 = WORLD_W / 2; x1 = baseEdge(1 - sd.team);
      if (x0 > x1) [x0, x1] = [x1, x0];
    }
    if (x1 - x0 < 160) { const m = (x0 + x1) / 2; x0 = m - 80; x1 = m + 80; }
    for (let i = 0; i < ab.n; i++) {
      const tx = x0 + Math.random() * (x1 - x0);
      S.projs.push({
        team: sd.team, kind: ab.proj, sx: tx - dir * (90 + Math.random() * 80), sy: -40 - Math.random() * 40,
        tx, ty: GROUND - 4, target: null, t: -(i * 0.06 + Math.random() * 0.25), dur: 0.75 + Math.random() * 0.2,
        arc: 0, dmg: ab.power * 3 * era.dmgMul, aoe: ab.aoe || (ab.fire ? 40 : 0), pierce: 0.2,
        dot: ab.fire ? ab.power * 1.2 * era.dmgMul : 0, dotT: ab.fire ? 3 : 0, x: 0, y: 0, px: 0, py: 0,
      });
    }
    if (ab.proj === 'bomb') S.fx.push({ type: 'jet', t: 0, dur: 1.6, team: sd.team });
    if (S.mode === 'play') showBanner(ab.name, sd.team === 0 ? 'Your era attack' : 'Enemy era attack');
    return null;
  }

  // ── Particles ───────────────────────────────────────────────────────────
  const REDUCED = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const MAX_PARTS = 700;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function part(o) { if (!S.sim && S.parts.length < MAX_PARTS) { o.max = o.life; S.parts.push(o); } }
  function shake(a) { if (!REDUCED) S.shake = Math.min(7, Math.max(S.shake, a)); }
  function emitSparks(x, y, n, col = '#ffd98a', spd = 130) {
    for (let i = 0; i < n; i++) part({ type: 'spark', x, y, vx: rnd(-1, 1) * spd, vy: rnd(-1.3, 0.2) * spd, g: 380, drag: 0.98, life: rnd(0.12, 0.32), col });
  }
  function emitDust(x, y, n, size = 4, col = '170,148,116') {
    for (let i = 0; i < n; i++) part({ type: 'dust', x: x + rnd(-6, 6), y: y + rnd(-2, 2), vx: rnd(-22, 22), vy: rnd(-16, -2), g: 0, drag: 0.94, life: rnd(0.4, 0.8), size: size * rnd(0.6, 1.2), col });
  }
  function emitSmoke(x, y, n, size = 6, col = '70,64,58', alpha = 0.45) {
    for (let i = 0; i < n; i++) part({ type: 'smoke', x: x + rnd(-size, size), y: y + rnd(-size, size) * 0.5, vx: rnd(-8, 8), vy: rnd(-26, -8), g: 0, drag: 0.99, life: rnd(1.1, 2.4), size: size * rnd(0.6, 1.1), col, alpha });
  }
  function emitDebris(x, y, n, col = '#6a5a44', spd = 150) {
    for (let i = 0; i < n; i++) part({ type: 'debris', x, y, vx: rnd(-1, 1) * spd, vy: rnd(-1.6, -0.4) * spd, g: 520, drag: 0.99, life: rnd(0.6, 1.2), size: rnd(1.4, 3.2), rot: rnd(0, 6), vr: rnd(-12, 12), col, bounce: true });
  }
  function emitEmbers(x, y, n) {
    for (let i = 0; i < n; i++) part({ type: 'ember', x: x + rnd(-6, 6), y, vx: rnd(-14, 14), vy: rnd(-50, -15), g: 0, drag: 0.97, life: rnd(0.5, 1.2), size: rnd(0.8, 1.6) });
  }
  function emitExplosion(x, y, r, fire) {
    emitSparks(x, y - 6, 16, '#ffcf6a', 230);
    emitDebris(x, GROUND - 2, 10, shade(ART[S.sides[0].era].ground[1], -0.1));
    emitSmoke(x, y - 10, 9, Math.max(6, r * 0.32), fire ? '55,40,30' : '78,72,66', 0.55);
    if (fire) emitEmbers(x, y - 8, 10);
    shake(Math.min(6, r / 12));
    S.decals.push({ x, r: r * 0.7, t: 0 });
    if (S.decals.length > 40) S.decals.shift();
  }
  const EDGED = new Set(['sword', 'knife', 'axe', 'spear']);
  function hitFx(target, w, team) {
    if (target.isBase) { emitDebris(baseEdge(target.team), GROUND - 40 - Math.random() * 40, 4, ART[sideOf(target.team).era].stone, 90); return; }
    const y = GROUND - (target.def.mounted ? 44 : 30);
    if (EDGED.has(w.kind)) {
      emitSparks(target.x, y, 5);
      S.fx.push({ type: 'slash', x: target.x - DIR[team] * 4, y, dir: DIR[team], t: 0, dur: 0.16 });
    } else emitDust(target.x, y, 3, 3, '200,180,150');
  }

  function updateParts(dt) {
    for (const p of S.parts) {
      p.life -= dt;
      p.vy += (p.g || 0) * dt;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.type === 'firefly' || p.type === 'spore') { p.vx += Math.sin(S.t * 2 + p.seed) * 6 * dt; p.vy += Math.cos(S.t * 1.7 + p.seed) * 6 * dt; }
      if (p.bounce && p.y > GROUND + 3) { p.y = GROUND + 3; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
      if ((p.type === 'leaf' || p.type === 'rain' || p.type === 'ash') && p.y > GROUND + 2) p.life = Math.min(p.life, 0.05);
    }
    S.parts = S.parts.filter((p) => p.life > 0);
    for (const d of S.decals) d.t += dt;
    S.decals = S.decals.filter((d) => d.t < 25);
    S.shake = Math.max(0, S.shake - dt * 14);
    // Weather for the player's era.
    if (S.sim || typeof viewW !== 'number' || !viewW) return;
    const A = ART[S.sides[0].era];
    const x0 = S.cam - 40, x1 = S.cam + viewW + 40;
    const spawn = (rate, fn) => { let n = rate * dt; while (n > 0) { if (Math.random() < n) fn(); n -= 1; } };
    if (A.weather !== 'rain') {
      spawn(4 + 6 * LIGHT.dayK, () => part({ type: 'mote', x: rnd(x0, x1), y: rnd(60, GROUND), vx: rnd(4, 12), vy: rnd(-4, 4), life: rnd(3, 6) }));
      if (LIGHT.nightK > 0.3) spawn(3 * LIGHT.nightK, () => part({ type: 'firefly', x: rnd(x0, x1), y: rnd(GROUND - 90, GROUND - 6), vx: rnd(-6, 6), vy: rnd(-4, 4), drag: 0.99, life: rnd(3, 6), size: rnd(0.8, 1.4), seed: rnd(0, 9) }));
    }
    switch (A.weather) {
      case 'spores': spawn(5 + 4 * LIGHT.nightK, () => part({ type: 'spore', x: rnd(x0, x1), y: rnd(GROUND - 30, GROUND + 10), vx: rnd(-4, 4), vy: rnd(-14, -5), drag: 0.995, life: rnd(4, 8), size: rnd(0.7, 1.3), seed: rnd(0, 9) })); break;
      case 'leaves': spawn(3, () => part({ type: 'leaf', x: rnd(x0, x1), y: -6, vx: rnd(10, 30), vy: rnd(14, 26), life: 14, rot: rnd(0, 6), vr: rnd(-3, 3), col: ['#8a7a3a', '#a8622a', '#6a7a3a'][Math.floor(rnd(0, 3))] })); break;
      case 'ash': spawn(6, () => part({ type: 'ash', x: rnd(x0, x1), y: rnd(-10, 120), vx: rnd(6, 16), vy: rnd(6, 14), life: rnd(5, 9) })); break;
      case 'rain': spawn(70, () => part({ type: 'rain', x: rnd(x0, x1 + 60), y: rnd(-20, 40), vx: -60, vy: 520, life: 1 })); break;
    }
    // Burning strongholds.
    for (const sd of S.sides) {
      const b = sd.base;
      const k = b.hp / b.maxHp;
      if (k < 0.5 && b.top) spawn(k < 0.25 ? 9 : 4, () => emitSmoke(b.x + rnd(-30, 30), b.top + 20, 1, 7, '50,44,40', 0.5));
      if (k < 0.25 && b.top) spawn(10, () => emitEmbers(b.x + rnd(-30, 30), b.top + 26, 1));
    }
    // Status effects on warriors.
    for (const u of S.units) {
      if (u.dead || !u.dots.length) continue;
      const fire = u.dots.some((d) => d.kind === 'fire' || d.kind === 'shell' || d.kind === 'bomb');
      if (Math.random() < dt * 6) {
        if (fire) emitEmbers(u.x, GROUND - 20, 1);
        else part({ type: 'bubble', x: u.x + rnd(-5, 5), y: GROUND - 30, vx: 0, vy: -14, life: 0.8, size: rnd(0.8, 1.6) });
      }
    }
  }

  // ── Combat ──────────────────────────────────────────────────────────────
  function frontTarget(u) {
    const dir = DIR[u.team];
    const base = sideOf(1 - u.team).base;
    let target = base;
    let dist = Math.max(0, (baseEdge(1 - u.team) - u.x) * dir);
    const foe = S.teams[1 - u.team][0];
    if (foe) {
      const d = Math.abs(foe.x - u.x);
      if (d < dist) { target = foe; dist = d; }
    }
    return { target, dist };
  }

  function buffMul(u) {
    let m = (u.rallyT > 0 ? 1.3 : 1) * upMul(sideOf(u.team), 'blades') * (1 + 0.12 * (u.rank || 0));
    if (!u.def.hero && S.heroes[u.team].some((h) => Math.abs(h.x - u.x) < 130)) m *= 1.15;
    return m;
  }

  function damage(target, amount, team, pierce = 0, src = null, wname = '') {
    if (!target || amount <= 0) return;
    if (target.isBase) {
      target.hp -= amount;
      target.flash = 0.12;
      const sd = sideOf(team);
      if (isFinite(target.maxHp)) sd.xp += amount * 0.05 * (sd.ai ? diffOf().xp : 1);
      sd.dmgDealt += amount;
      Sound.play('base');
      if (target.hp <= 0 && !S.over && isFinite(target.maxHp)) endGame(team);
      return;
    }
    if (target.dead) return;
    // Battle luck: nimble warriors sometimes slip a blow; every hit varies ±20%.
    if (pierce < 1 && Math.random() < 0.05 + Math.max(0, target.def.speed - 40) / 250) return;
    amount *= 0.8 + Math.random() * 0.4;
    // In one-on-one duels a well-placed blow can end it (the show's "kill shot").
    if (S.mode !== 'play' && S.mode !== 'attract' && Math.random() < 0.1) amount *= 2.6;
    let d = amount * (1 - target.armor * (1 - pierce));
    if (target.shieldT > 0) d *= 0.45;
    target.hp -= d;
    target.flash = 0.1;
    if (target.hp <= 0) kill(target, team, src, wname);
  }

  function promote(src) {
    if (!src || src.dead || src.isBase || src.rank >= 3) return;
    src.kills++;
    if (src.kills < RANKS[src.rank]) return;
    src.rank++;
    const add = src.maxHp * 0.12;
    src.maxHp += add;
    src.hp = Math.min(src.maxHp, src.hp + add * 1.5);
    if (S.sim) return;
    S.texts.push({ x: src.x, y: GROUND - 70, text: RANK_NAMES[src.rank], t: 0, col: '#f2d27a' });
    S.fx.push({ type: 'ring', x: src.x, y: GROUND - 20, r: 40, t: 0, dur: 0.6, col: '#e6b84e' });
    if (src.team === 0 && playing() && src.rank >= 3) unlock('legend');
  }

  function kill(u, killerTeam, src = null, wname = '') {
    u.dead = true;
    u.deathT = 0;
    promote(src);
    if (S.sim) { u.hp = 0; S.killLog.push({ team: killerTeam, w: wname }); return; }
    emitDust(u.x, GROUND - 3, 6, 5);
    u.hp = 0;
    const sd = sideOf(killerTeam);
    const gold = Math.round(u.def.cost * 0.95);
    sd.gold += gold;
    sd.xp += u.def.cost * 2 * (sd.ai ? diffOf().xp : 1);
    sd.kills++;
    sideOf(u.team).lost++;
    if (killerTeam === 0 && S.mode === 'play') {
      S.texts.push({ x: u.x, y: GROUND - 58, text: `+${gold}`, t: 0, col: '#d9a944' });
      Sound.play('coin');
      REC.kills++;
      unlock('firstblood');
      if (LIGHT.nightK > 0.6 && ++S.nightKills >= 50) unlock('nightowl');
    }
    Sound.play('die');
  }

  function stun(u, t) {
    if (u.isBase || u.dead) return;
    u.stunT = Math.max(u.stunT, t);
    u.chargeT = 0;
    u.burst = null;
  }

  const targetY = (tg) => (tg.isBase ? GROUND - 40 - Math.random() * 40 : GROUND - (tg.def.mounted ? 44 : 30));
  const targetX = (tg) => (tg.isBase ? baseEdge(tg.team) + DIR[tg.team] * -6 + (Math.random() - 0.5) * 20 : tg.x);

  function spawnProj(u, target, o) {
    const dir = DIR[u.team];
    const sx = u.x + dir * 10;
    const sy = GROUND - (u.def.mounted ? 52 : 34);
    const tx = targetX(target);
    const ty = targetY(target);
    const dist = Math.abs(tx - sx);
    const kind = o.kind;
    const arcK = kind === 'bullet' ? 0 : kind === 'rocket' ? 0.04 : kind === 'bomb' || kind === 'shell' || kind === 'nest' || kind === 'fire' ? 0.3 : kind === 'stone' ? 0.22 : 0.16;
    S.projs.push({
      team: u.team, kind, sx, sy, tx, ty, target, t: 0, dur: Math.max(0.08, dist / (PROJ_SPEED[kind] || 400)),
      arc: dist * arcK, dmg: o.dmg, pierce: o.pierce || 0, aoe: o.aoe || 0, dot: o.dot || 0, dotT: o.dotT || 0, stun: o.stun || 0,
      x: sx, y: sy, px: sx, py: sy, src: u, wname: o.wname || '',
    });
    Sound.play(kind === 'bullet' ? 'shot' : kind === 'arrow' || kind === 'bolt' ? 'bow' : 'melee');
  }

  function attack(u, w, i, target) {
    if (w.ammo != null) u.ammo[i]--;
    u.swing = 1;
    u.swingW = w;
    const m = buffMul(u);
    if (w.ranged) {
      spawnProj(u, target, { kind: w.proj, dmg: w.dmg * m, pierce: w.pierce, wname: w.name });
      if (w.proj === 'bullet') {
        const mx = u.x + DIR[u.team] * 22, my = GROUND - (u.def.mounted ? 52 : 33);
        S.fx.push({ type: 'muzzle', x: mx, y: my, t: 0, dur: 0.08 });
        emitSmoke(mx, my, 1, 3, '200,196,186', 0.35);
        if (u.def.era >= 4) part({ type: 'casing', x: u.x, y: my, vx: -DIR[u.team] * rnd(20, 50), vy: rnd(-70, -40), g: 420, life: 0.7, rot: 0, vr: 20, bounce: true });
      }
    } else {
      damage(target, w.dmg * m, u.team, w.pierce, u, w.name);
      if (!S.sim) hitFx(target, w, u.team);
      Sound.play('melee');
    }
  }

  function trySpecial(u, sp, target, dist) {
    const m = buffMul(u);
    const foeIsUnit = !target.isBase;
    switch (sp.fx) {
      case 'shield':
        if (dist > sp.r) return false;
        u.shieldT = 4;
        return true;
      case 'stun':
        if (dist > sp.r) return false;
        if (sp.proj) spawnProj(u, target, { kind: sp.proj, dmg: sp.dmg * m, stun: sp.stun, aoe: sp.aoe || 0, wname: sp.name });
        else { damage(target, sp.dmg * m, u.team, 0.3, u, sp.name); stun(target, sp.stun); }
        u.swing = 1; u.swingW = sp;
        return true;
      case 'charge':
        if (dist > sp.r || dist < 34) return false;
        u.chargeT = 0.5; u.chargeDmg = sp.dmg * m; u.chargeName = sp.name;
        return true;
      case 'splash': case 'fire': case 'hornets': case 'poison': case 'snipe':
        if (dist > sp.r || (sp.aoe && dist < 26)) return false;
        spawnProj(u, target, { kind: sp.proj, dmg: sp.dmg * m, aoe: sp.aoe || 0, dot: sp.dot || 0, dotT: sp.dotT || 0, pierce: sp.pierce || 0, wname: sp.name });
        u.swing = 1; u.swingW = sp;
        return true;
      case 'volley':
        if (dist > sp.r) return false;
        u.burst = { n: sp.n, t: 0, sp, melee: false };
        return true;
      case 'flurry':
        if (dist > sp.r) return false;
        u.burst = { n: sp.n, t: 0, sp, melee: true };
        return true;
      case 'rally':
        if (dist > sp.r) return false;
        for (const a of S.teams[u.team]) if (Math.abs(a.x - u.x) < sp.aura) a.rallyT = 6;
        S.fx.push({ type: 'ring', x: u.x, y: GROUND - 20, r: sp.aura, t: 0, dur: 0.7, col: '#d9a944' });
        return true;
      case 'fear':
        if (dist > sp.r || !foeIsUnit) return false;
        for (const e of S.teams[1 - u.team]) {
          if (Math.abs(e.x - u.x) < sp.aoe) { damage(e, sp.dmg * m, u.team, 0.3, u, sp.name); stun(e, sp.stun); }
        }
        S.fx.push({ type: 'ring', x: u.x, y: GROUND - 20, r: sp.aoe, t: 0, dur: 0.6, col: '#c4432f' });
        return true;
    }
    return false;
  }

  function updateUnit(u, dt) {
    if (u.dead) { u.deathT += dt; return; }
    u.flash = Math.max(0, u.flash - dt);
    u.shieldT = Math.max(0, u.shieldT - dt);
    u.rallyT = Math.max(0, u.rallyT - dt);
    u.slowT = Math.max(0, (u.slowT || 0) - dt);
    u.swing = Math.max(0, u.swing - dt * 3.2);
    if (u.dots.length) {
      for (const d of u.dots) { d.t -= dt; damage(u, d.dps * dt, d.team, 1, d.src, d.wname); }
      u.dots = u.dots.filter((d) => d.t > 0);
      if (u.dead) return;
    }
    if (u.stunT > 0) { u.stunT -= dt; return; }
    u.cd -= dt;
    u.specCd -= dt;
    u.pauseT = Math.max(0, u.pauseT - dt);
    const dir = DIR[u.team];
    const def = u.def;
    let { target, dist } = frontTarget(u);

    if (u.chargeT > 0) {
      u.chargeT -= dt;
      const step = def.speed * 5 * dt;
      const reach = 22;
      if (dist - step <= reach || u.chargeT <= 0) {
        u.x += dir * Math.max(0, dist - reach);
        damage(target, u.chargeDmg, u.team, 0.4, u, u.chargeName);
        if (!target.isBase && !target.dead) {
          target.x += dir * 26;
          target.x = Math.max(spawnX(0), Math.min(spawnX(1), target.x));
          stun(target, 0.6);
        }
        emitDust(u.x + dir * 14, GROUND - 4, 8, 6);
        if (!target.isBase) emitSparks(target.x, GROUND - 30, 6);
        shake(2.5);
        Sound.play('melee');
        u.chargeT = 0;
      } else {
        u.x += dir * step;
        u.walk += dt * 14;
      }
      return;
    }

    if (u.burst) {
      const b = u.burst;
      b.t -= dt;
      if (b.t <= 0) {
        const m = buffMul(u);
        if (b.melee) {
          if (dist <= b.sp.r + 6) { damage(target, b.sp.dmg * m, u.team, 0.2, u, b.sp.name); if (!S.sim) hitFx(target, { kind: 'sword' }, u.team); Sound.play('melee'); }
          b.t = 0.15;
        } else {
          spawnProj(u, target, { kind: b.sp.proj, dmg: b.sp.dmg * m, pierce: 0.3, wname: b.sp.name });
          b.t = b.sp.proj === 'bullet' ? 0.1 : 0.16;
        }
        u.swing = 1; u.swingW = b.sp;
        b.n--;
        if (b.n <= 0) u.burst = null;
      }
      return;
    }

    if (def.special && u.specCd <= 0 && trySpecial(u, def.special, target, dist)) u.specCd = def.special.cd;

    let best = null, bi = -1, bestDps = 0;
    for (let i = 0; i < def.normal.length; i++) {
      const w = def.normal[i];
      if (w.range < dist || u.ammo[i] <= 0) continue;
      const dps = w.dmg / w.cd;
      if (dps > bestDps) { best = w; bi = i; bestDps = dps; }
    }

    let hold = def.reach;
    if (def.role === 'ranged') {
      for (let i = 0; i < def.normal.length; i++) {
        const w = def.normal[i];
        if (w.ranged && u.ammo[i] > 0 && w.range > hold) hold = w.range;
      }
    }
    const gap = u.ahead ? Math.abs(u.ahead.x - u.x) : Infinity;
    const space = (def.mounted ? 20 : 11) + (u.ahead && u.ahead.def.mounted ? 20 : 11);
    const wantMove = dist > hold && u.pauseT <= 0;
    // Battle orders: hold a line in the field, or fall back to the stronghold.
    const stance = sideOf(u.team).stance;
    let room = Infinity;
    if (stance !== 'advance') {
      const lineX = stance === 'hold' ? BASE_X[u.team] + dir * HOLD_DIST : spawnX(u.team) + dir * 24;
      const over = (u.x - lineX) * dir;
      room = Math.max(0, -over);
      if (over > 2 && dist > def.reach + 4) {
        u.x -= dir * Math.min(def.speed * dt, over);
        u.walk -= dt * def.speed * 0.2;
      }
    }
    if (wantMove && gap > space && room > 0) {
      const sp = def.speed * (u.rallyT > 0 ? 1.3 : 1) * (u.slowT > 0 ? 0.45 : 1) * dt;
      u.x += dir * Math.min(sp, Math.max(0, dist - hold), gap - space, room);
      u.walk += dt * def.speed * 0.2;
    }
    if (best) {
      u.weapon = best;
      if (u.cd <= 0) {
        attack(u, best, bi, target);
        u.cd = best.cd;
        if (best.ranged && wantMove) u.pauseT = 0.35;
      }
    } else if (def.role === 'ranged') {
      u.weapon = def.normal.reduce((a, w) => (w.ranged && w.range > (a.ranged ? a.range : 0) ? w : a), def.normal[0]);
    } else {
      const melee = def.normal.find((w) => !w.ranged);
      if (melee) u.weapon = melee;
    }
  }

  function updateTraining(sd, dt) {
    if (!sd.queue.length) { sd.trainT = 0; return; }
    const def = sd.queue[0];
    const trainTime = def.train / upMul(sd, 'drill');
    sd.trainT = Math.min(trainTime, sd.trainT + dt);
    if (sd.trainT >= trainTime) {
      const sx = spawnX(sd.team);
      const blocked = S.units.some((u) => !u.dead && u.team === sd.team && Math.abs(u.x - sx) < (def.mounted || u.def.mounted ? 34 : 22));
      if (!blocked) { spawnUnit(def, sd.team); sd.queue.shift(); sd.trainT = 0; }
    }
  }

  const turretPos = (team, i) => ({ x: BASE_X[team] + DIR[team] * 26, y: GROUND - 118 + i * 24 });

  // A tower's live stats: level, engineers research, overdrive, and a +25%
  // bonus while one of the warriors it belongs to is on the field.
  function towerStats(sd, t) {
    const lv = t.level - 1;
    const od = t.odT > 0;
    const syn = !!(t.def.by && S.teams[sd.team].some((u) => t.def.by.includes(u.def.id)));
    return {
      dmg: t.dmg * upMul(sd, 'engineers') * (1 + 0.3 * lv) * (syn ? 1.25 : 1) * (od ? 1.25 : 1),
      range: t.def.r * (1 + sd.up.engineers * 0.06) * (1 + 0.1 * lv),
      cd: t.def.cd * (1 - 0.1 * lv) * (od ? 0.4 : 1),
      syn, od,
    };
  }

  function updateTurrets(sd, dt) {
    const b = sd.base;
    const foes = S.teams[1 - sd.team];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const t = b.turrets[i];
      if (!t) continue;
      t.cd -= dt;
      t.flashT = Math.max(0, t.flashT - dt);
      t.odT = Math.max(0, t.odT - dt);
      t.odCd = Math.max(0, t.odCd - dt);
      const st = towerStats(sd, t);
      t.syn = st.syn;
      const p = turretPos(sd.team, i);
      const inRange = foes.filter((e) => Math.abs(e.x - p.x) < st.range).sort((a, c) => Math.abs(a.x - p.x) - Math.abs(c.x - p.x));
      if (!inRange.length) continue;
      const tgt = t.def.target === 'strongest'
        ? inRange.reduce((a, e) => ((e.def.hero ? 1e9 : 0) + e.hp > (a.def.hero ? 1e9 : 0) + a.hp ? e : a), inRange[0])
        : inRange[0];
      t.angle = Math.atan2(GROUND - 30 - p.y, (tgt.x - p.x) * DIR[sd.team]);
      if (t.cd > 0) continue;
      t.cd = st.cd;
      t.flashT = 0.1;
      const def = t.def;
      const kind = def.proj;
      const n = def.n || 1;
      for (let k = 0; k < n; k++) {
        const e = n > 1 ? inRange[k % inRange.length] : tgt;
        const dist = Math.abs(e.x - p.x);
        S.projs.push({
          team: sd.team, kind, sx: p.x, sy: p.y, tx: e.x, ty: GROUND - 30, target: e, t: -k * 0.07,
          dur: Math.max(0.1, dist / (PROJ_SPEED[kind] || 400)), arc: kind === 'bullet' || kind === 'plasma' ? 0 : dist * (def.aoe ? 0.2 : 0.08),
          dmg: st.dmg, pierce: def.pierce || 0, aoe: def.aoe || 0, dot: def.burn ? st.dmg * 0.4 : 0, dotT: def.burn ? 3 : 0,
          stun: def.effect === 'stun' ? 1.2 : 0, slow: def.effect === 'slow' ? 2.5 : 0, line: def.effect === 'line', burn: !!def.burn,
          x: p.x, y: p.y, px: p.x, py: p.y, src: null, wname: def.name,
        });
      }
      Sound.play(kind === 'bullet' ? 'shot' : 'bow');
    }
  }

  function impact(p) {
    const foes = S.teams[1 - p.team];
    const foeBase = sideOf(1 - p.team).base;
    const hitUnit = (e, scale = 1) => {
      damage(e, p.dmg * scale, p.team, p.pierce, p.src, p.wname);
      if (p.dot && !e.dead) e.dots.push({ dps: p.dot, t: p.dotT, team: p.team, kind: p.burn ? 'fire' : p.kind, src: p.src, wname: p.wname });
      if (p.slow && !e.dead) e.slowT = Math.max(e.slowT || 0, p.slow);
      if (p.stun && !e.dead) stun(e, p.stun);
    };
    if (p.aoe) {
      for (const e of foes) if (Math.abs(e.x - p.tx) < p.aoe) hitUnit(e);
      if (Math.abs(baseEdge(foeBase.team) - p.tx) < p.aoe + 10) damage(foeBase, p.dmg * 0.6, p.team);
      const fire = p.kind === 'fire';
      const hornets = p.kind === 'nest';
      S.fx.push({ type: hornets ? 'swarm' : 'boom', x: p.tx, y: GROUND - 8, r: p.aoe, t: 0, dur: hornets ? 1.4 : 0.6, fire });
      if (!hornets) emitExplosion(p.tx, GROUND - 8, p.aoe, fire);
      if (!hornets) Sound.play('boom');
      return;
    }
    let tgt = p.target;
    if (tgt && !tgt.isBase && tgt.dead) tgt = null;
    if (!tgt) {
      let best = 24;
      for (const e of foes) {
        const d = Math.abs(e.x - p.tx);
        if (d < best) { best = d; tgt = e; }
      }
      if (!tgt && Math.abs(baseEdge(foeBase.team) - p.tx) < 30 && p.ty > GROUND - 140) tgt = foeBase;
    }
    if (!tgt) { emitDust(p.tx, GROUND - 2, 3, 3); return; }
    if (tgt.isBase) { damage(tgt, p.dmg, p.team, p.pierce); hitFx(tgt, {}, p.team); }
    else {
      hitUnit(tgt);
      if (p.line) {
        // The bolt carries on through the next two enemies in line.
        const dir = DIR[p.team];
        foes.filter((e) => e !== tgt && (e.x - tgt.x) * dir > 0 && (e.x - tgt.x) * dir < 70)
          .sort((a, c) => (a.x - c.x) * dir).slice(0, 2).forEach((e) => hitUnit(e, 0.7));
      }
      if (p.kind === 'bullet') emitSparks(tgt.x, GROUND - 30, 2, '#ffe9b0', 90);
      else emitDust(tgt.x, GROUND - 28, 2, 2.5, '200,180,150');
    }
    if (p.kind === 'flash') S.fx.push({ type: 'flash', x: p.tx, y: p.ty, t: 0, dur: 0.3 });
    if (p.aoe === 0 && p.stun && p.kind === 'flash') {
      for (const e of foes) if (Math.abs(e.x - p.tx) < 60) stun(e, p.stun);
    }
  }

  function updateProjs(dt) {
    for (const p of S.projs) {
      p.t += dt / p.dur;
      if (p.t < 0) continue;
      if (p.target && !p.target.isBase && !p.target.dead) {
        p.tx = p.target.x;
      }
      const t = Math.min(1, p.t);
      p.px = p.x; p.py = p.y;
      p.x = p.sx + (p.tx - p.sx) * t;
      p.y = p.sy + (p.ty - p.sy) * t - p.arc * 4 * t * (1 - t);
      if (p.kind === 'rocket' || p.kind === 'shell' || p.kind === 'bomb') { if (Math.random() < 0.7) emitSmoke(p.x, p.y, 1, p.kind === 'rocket' ? 3 : 2.2, '150,146,140', 0.35); }
      else if (p.kind === 'fire' && Math.random() < 0.6) emitEmbers(p.x, p.y, 1);
      if (p.t >= 1) { impact(p); p.done = true; }
    }
    S.projs = S.projs.filter((p) => !p.done);
  }

  // ── AI ──────────────────────────────────────────────────────────────────
  function aiThink(sd, dt) {
    sd.aiT -= dt;
    if (sd.aiT > 0) return;
    const df = S.mode === 'attract' ? DIFF.warrior : diffOf();
    sd.aiT = df.think * (0.6 + Math.random() * 0.8);
    if (sd.era < ERAS.length - 1 && sd.xp >= ERAS[sd.era + 1].xp) { evolve(sd); return; }
    const foes = S.teams[1 - sd.team];
    const threat = foes.filter((u) => Math.abs(u.x - BASE_X[sd.team]) < 420).length;
    if (sd.abilityCd <= 0 && (foes.length >= 4 || threat >= 2)) useAbility(sd);

    const b = sd.base;
    const era = ERAS[sd.era];
    const emptySlot = b.turrets.slice(0, b.slots).some((t) => !t);
    b.turrets.forEach((t, i) => {
      if (t && t.odCd <= 0 && foes.filter((u) => Math.abs(u.x - BASE_X[sd.team]) < t.def.r).length >= 3) overdrive(sd, i);
    });
    const towersBuilt = b.turrets.filter(Boolean).length;
    if (Math.random() < (towersBuilt ? 0.35 : 0.6)) {
      if (emptySlot) {
        const t = era.turrets[Math.floor(Math.random() * era.turrets.length)];
        if (sd.gold > t.cost * (towersBuilt ? 1.5 : 1.15)) { buyTurret(sd, t); return; }
      } else if (b.slots < MAX_SLOTS && sd.gold > slotCost(sd) * 3) { buySlot(sd); return; }
      else {
        const old = b.turrets.findIndex((t) => t && t.era < sd.era);
        const pick = era.turrets[Math.floor(Math.random() * era.turrets.length)];
        if (old >= 0 && sd.gold + b.turrets[old].spent * 0.5 > pick.cost * 1.3) { sellTurret(sd, old); buyTurret(sd, pick, old); return; }
        const up = b.turrets.findIndex((t) => t && t.level < TOWER_MAX_LV);
        if (up >= 0 && sd.gold > upgradeCost(b.turrets[up]) * 2.5) { upgradeTurret(sd, up); return; }
      }
    }

    if (Math.random() < 0.18) {
      const open = UPGRADES.filter((u) => sd.up[u.id] < UP_MAX);
      const up = open[Math.floor(Math.random() * open.length)];
      if (up && sd.gold > upCost(sd, up) * 2.2) { buyUpgrade(sd, up); return; }
    }
    // Hold the line when outmatched, push when ahead.
    const mine = S.teams[sd.team].reduce((a, u) => a + u.hp, 0);
    const theirs = foes.reduce((a, u) => a + u.hp, 0);
    sd.stance = theirs > 0 && mine < theirs * 0.55 ? 'hold' : 'advance';

    if (sd.queue.length >= 3) return;
    const roster = BY_ERA[sd.era];
    const heroOk = !heroActive(sd);
    const hero = roster.filter((d) => d.hero);
    if (heroOk && hero.length && Math.random() < 0.35) {
      const h = hero[Math.floor(Math.random() * hero.length)];
      if (sd.gold >= h.cost) { recruit(sd, h); return; }
      if (threat < 2 && Math.random() < 0.6) return; // saving up for a hero
    }
    const options = roster.filter((d) => !d.hero && d.cost <= sd.gold);
    if (!options.length) return;
    const pick = options[Math.floor(Math.random() * options.length)];
    recruit(sd, pick);
  }

  // ── Main update ─────────────────────────────────────────────────────────
  function update(dt) {
    if (!S || S.paused) return;
    if (S.over) {
      S.endT += dt;
      for (const u of S.units) if (u.dead) u.deathT += dt;
      updateFx(dt);
      if (S.mode === 'attract' && S.endT > 4) newGame('attract');
      return;
    }
    S.t += dt;
    S.tod = (S.tod + dt / DAY_LEN) % 1;
    const teams = [[], []];
    for (const u of S.units) if (!u.dead) teams[u.team].push(u);
    teams[0].sort((a, b) => b.x - a.x);
    teams[1].sort((a, b) => a.x - b.x);
    S.teams = teams;
    for (let t = 0; t < 2; t++) teams[t].forEach((u, i) => { u.ahead = i > 0 ? teams[t][i - 1] : null; });
    S.heroes = [teams[0].filter((u) => u.def.hero), teams[1].filter((u) => u.def.hero)];

    for (const sd of S.sides) {
      const era = ERAS[sd.era];
      const mult = sd.team === 1 && S.mode === 'play' ? diffOf().income : 1;
      sd.gold += INCOME * era.costMul * dt * mult * upMul(sd, 'tribute');
      sd.abilityCd = Math.max(0, sd.abilityCd - dt);
      sd.base.flash = Math.max(0, sd.base.flash - dt);
      updateTraining(sd, dt);
      updateTurrets(sd, dt);
      if (sd.ai) aiThink(sd, dt);
    }
    if (S.variant === 'survival') updateWaves(dt);
    for (const u of S.units) updateUnit(u, dt);
    S.units = S.units.filter((u) => !(u.dead && u.deathT > 1.6));
    if (S.mode === 'duel' && !S.duelDone) {
      const alive = S.units.filter((u) => !u.dead);
      if (alive.length < 2 || S.t > 60) {
        S.duelDone = true;
        const w = alive.length === 1 ? alive[0] : null;
        showBanner(w ? `${w.def.name} wins` : 'Both warriors stand', w ? 'Duel result' : 'Draw after 60 s');
        const game = S;
        setTimeout(() => { if (S === game) openSim(true); }, 2800);
      }
    }
    updateProjs(dt);
    updateFx(dt);
  }

  // Survival: endless waves that grow and advance through the eras.
  function updateWaves(dt) {
    const W = S.wave;
    const e = S.sides[1];
    W.t -= dt;
    if (W.t <= 0 && !W.queue.length) {
      W.n++;
      const era = Math.min(ERAS.length - 1, Math.floor((W.n - 1) / 4));
      e.era = era;
      const sizeK = { recruit: 0.8, warrior: 1, deadliest: 1.25 }[difficulty];
      const count = Math.round((3 + W.n * 1.3) * sizeK);
      const roster = BY_ERA[era].filter((d) => !d.hero);
      for (let i = 0; i < count; i++) W.queue.push(roster[Math.floor(Math.random() * roster.length)]);
      if (W.n % 5 === 0) { const heroes = BY_ERA[era].filter((d) => d.hero); W.queue.push(heroes[Math.floor(Math.random() * heroes.length)]); }
      W.hpMul = 1 + 0.08 * ((W.n - 1) % 4) + 0.06 * Math.max(0, W.n - 16);
      W.t = 24 + Math.min(16, W.n);
      showBanner(`Wave ${W.n}`, `${count + (W.n % 5 === 0 ? 1 : 0)} warriors of the ${ERAS[era].name}`);
      if (W.n - 1 >= 10) unlock('wave10');
      if (W.n - 1 >= 20) unlock('wave20');
      if (W.n - 1 > REC.bestWave) { REC.bestWave = W.n - 1; saveRec(); }
    }
    W.spawnT -= dt;
    if (W.queue.length && W.spawnT <= 0) {
      const sx = spawnX(1);
      if (!S.units.some((u) => !u.dead && u.team === 1 && Math.abs(u.x - sx) < 24)) {
        spawnUnit(W.queue.shift(), 1, sx, W.hpMul);
        W.spawnT = 0.65;
      }
    }
  }

  function updateFx(dt) {
    updateParts(dt);
    for (const f of S.fx) f.t += dt;
    S.fx = S.fx.filter((f) => f.t < f.dur);
    for (const x of S.texts) { x.t += dt; x.y -= dt * 22; }
    S.texts = S.texts.filter((x) => x.t < 1.1);
  }

  function endGame(winnerTeam) {
    S.over = true;
    S.winner = winnerTeam;
    S.endT = 0;
    const loser = sideOf(1 - winnerTeam).base;
    S.fx.push({ type: 'boom', x: loser.x, y: GROUND - 50, r: 110, t: 0, dur: 1.2 });
    for (let i = 0; i < 4; i++) emitExplosion(loser.x + rnd(-40, 40), GROUND - rnd(10, 90), 70, true);
    Sound.play('boom');
    const game = S;
    if (S.mode === 'play') {
      if (S.variant === 'skirmish') {
        if (winnerTeam === 0) {
          REC.wins[difficulty] = (REC.wins[difficulty] || 0) + 1;
          unlock('victory');
          if (difficulty === 'deadliest') unlock('deadliest');
          const b = S.sides[0].base;
          if (b.hp / b.maxHp >= 0.9) unlock('fortress');
        } else REC.losses++;
      }
      saveRec();
      setTimeout(() => { if (S === game) showEnd(); }, 1400);
    }
  }

  // ── Deadliest Warrior simulator ─────────────────────────────────────────
  // Runs one-on-one duels with the real combat engine, both warriors built at
  // the same era strength, and tallies kills by weapon like the show.
  const SIM_ERA = 2;
  function simulate(rawA, rawB, n, onDone) {
    const A = makeDef(rawA.raw || rawA, SIM_ERA, true), B = makeDef(rawB.raw || rawB, SIM_ERA, true);
    const res = { a: rawA, b: rawB, wins: [0, 0], draws: 0, weapons: [{}, {}], n };
    let i = 0;
    const chunk = () => {
      const saved = S, snd = Sound.on;
      Sound.on = false;
      try {
        for (let k = 0; k < 50 && i < n; k++, i++) {
          newGame('sim');
          const gapX = 160 + Math.random() * 120;
          const ua = spawnUnit(A, 0, 750 - gapX / 2);
          const ub = spawnUnit(B, 1, 750 + gapX / 2);
          for (const u of [ua, ub]) { u.cd = Math.random() * 0.6; u.specCd = Math.random() * 3; }
          let t = 0;
          while (t < 60 && !ua.dead && !ub.dead) { update(1 / 20); t += 1 / 20; }
          if (ua.dead === ub.dead) { res.draws++; continue; }
          const winner = ua.dead ? 1 : 0;
          res.wins[winner]++;
          const log = S.killLog.find((l) => l.team === winner);
          const wn = (log && log.w) || 'Other';
          res.weapons[winner][wn] = (res.weapons[winner][wn] || 0) + 1;
        }
      } finally {
        S = saved;
        Sound.on = snd;
      }
      if (i < n) { onDone(null, i / n); setTimeout(chunk, 0); } else onDone(res, 1);
    };
    chunk();
  }

  // ── Rendering ───────────────────────────────────────────────────────────
  // The world is drawn into three layers: background (sky, terrain), actors
  // (strongholds, warriors, projectiles) and emissive light (fire, flashes,
  // glowing particles). A WebGL2 pass relights and composites them; when
  // WebGL2 is missing or effects are off, the layers are stacked in 2D.
  const cv = document.getElementById('cv');
  const sctx = cv.getContext('2d');
  const glCanvas = document.getElementById('gl');
  const mkCanvas = () => document.createElement('canvas');
  const bgC = mkCanvas(), fgC = mkCanvas(), emC = mkCanvas();
  const bgCtx = bgC.getContext('2d'), fgCtx = fgC.getContext('2d'), emCtx = emC.getContext('2d');
  let ctx = fgCtx, ectx = emCtx;
  let cssW = 0, cssH = 0, dpr = 1, res = 1, scale = 1, viewW = 0;

  function resize() {
    const r = cv.getBoundingClientRect();
    cssW = Math.max(1, r.width);
    cssH = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    res = Math.min(dpr, cssW * cssH > 900000 ? 1.25 : 1.5);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    for (const k of [bgC, fgC, emC, glCanvas]) { k.width = Math.round(cssW * res); k.height = Math.round(cssH * res); }
    scale = cssH / WORLD_H;
    if (cssW / scale > WORLD_W) scale = cssW / WORLD_W;
    viewW = cssW / scale;
  }

  const clampCam = () => {
    S.cam = Math.max(0, Math.min(WORLD_W - viewW, S.cam));
  };

  // ── GPU pipeline ────────────────────────────────────────────────────────
  const GFX = {
    ok: false, on: true, gl: null, prog: null, tex: [], loc: {},
    init() {
      try { const v = localStorage.getItem('aow-effects'); if (v === 'off') this.on = false; } catch (e) { /* storage blocked */ }
      const gl = glCanvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) return;
      const vs = `#version 300 es
in vec2 p; out vec2 v_uv;
void main(){ v_uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
      const fs = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 outColor;
uniform sampler2D u_bg, u_fg, u_emit;
uniform vec2 u_res, u_ldir;
uniform float u_ground, u_time, u_camx, u_scale, u_shx;
uniform vec3 u_light, u_rim, u_fog, u_tint;
uniform float u_rimK, u_fogK, u_wet, u_rain, u_bloom, u_night;

float hash(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

// Background is pre-lit; actors are multiplied by the scene light.
vec3 scene(vec2 st, float lod){
  vec3 bg = textureLod(u_bg, st, lod).rgb;
  vec4 fg = textureLod(u_fg, st, lod);
  return bg * (1.0 - fg.a) + fg.rgb * u_light;
}

void main(){
  vec2 st = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 px = 1.0 / u_res;
  vec3 col = scene(st, 0.0);
  float worldX = u_camx + (st.x * u_res.x - u_shx) / u_scale;

  // Silhouettes: rim light on edges that face the light, soft dark outline elsewhere.
  vec4 fg = texture(u_fg, st);
  if (fg.a > 0.02) {
    float toward = texture(u_fg, st + u_ldir * px * 2.5).a;
    float rim = fg.a * clamp(1.0 - toward, 0.0, 1.0);
    float a4 = min(min(texture(u_fg, st + vec2(px.x * 1.6, 0.0)).a, texture(u_fg, st - vec2(px.x * 1.6, 0.0)).a),
                   min(texture(u_fg, st + vec2(0.0, px.y * 1.6)).a, texture(u_fg, st - vec2(0.0, px.y * 1.6)).a));
    float edge = fg.a * (1.0 - a4);
    col *= 1.0 - 0.35 * edge * (1.0 - rim);
    col += u_rim * rim * u_rimK;
  }

  // Screen-space reflections on the ground: wet sheen with puddles.
  float below = st.y - u_ground;
  if (below > 0.0) {
    float wy = below * u_res.y / u_scale;
    float n = noise(vec2(worldX * 0.045, wy * 0.22)) * 0.65 + noise(vec2(worldX * 0.13, wy * 0.6)) * 0.35;
    float puddle = smoothstep(0.48, 0.7, n);
    float amount = u_wet * mix(0.2, 1.0, puddle) * exp(-wy / 30.0);
    float ripple = u_rain * puddle * sin(wy * 1.9 + u_time * 9.0 + worldX * 0.35) * 0.0016;
    vec2 rs = vec2(st.x + ripple, u_ground - below * 0.9);
    if (rs.y > 0.0) {
      float lod = mix(3.2, 0.6, puddle);
      vec3 rc = scene(rs, lod) + textureLod(u_emit, rs, lod).rgb * 1.3;
      float fres = 0.3 + 0.7 * pow(1.0 - clamp(wy / 45.0, 0.0, 1.0), 2.0);
      col = mix(col, rc, clamp(amount * fres, 0.0, 0.8));
    }
  }

  // Emissive light and bloom.
  vec3 e = texture(u_emit, st).rgb;
  vec3 bloom = textureLod(u_emit, st, 2.0).rgb * 0.55 + textureLod(u_emit, st, 3.5).rgb * 0.55 + textureLod(u_emit, st, 5.0).rgb * 0.45;
  col += e + bloom * u_bloom;

  // Atmospheric ground mist that drifts across the field.
  float gy = (st.y - u_ground) * u_res.y / u_scale;
  float drift = noise(vec2(worldX * 0.018 + u_time * 0.06, gy * 0.05 + u_time * 0.02));
  float mist = exp(-pow((gy + 7.0) / 16.0, 2.0)) * (0.35 + 0.65 * drift);
  col = mix(col, u_fog, clamp(mist * u_fogK, 0.0, 0.6));

  // Grade: era tint, gentle filmic curve, vignette, grain.
  col += u_tint * 0.6;
  col = mix(col, aces(col * 1.08), 0.45);
  vec2 vq = (st - 0.5) * vec2(1.0, 0.9);
  col *= 1.0 - (0.30 + 0.18 * u_night) * pow(length(vq) * 1.3, 2.2);
  col += (hash(st * u_res + fract(u_time) * 91.0) - 0.5) * 0.022;
  outColor = vec4(col, 1.0);
}`;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      try {
        const prog = gl.createProgram();
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const ap = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(ap);
        gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
        this.tex = ['u_bg', 'u_fg', 'u_emit'].map((name, i) => {
          const t = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.uniform1i(gl.getUniformLocation(prog, name), i);
          return t;
        });
        for (const u of ['u_res', 'u_ldir', 'u_ground', 'u_time', 'u_camx', 'u_scale', 'u_shx', 'u_light', 'u_rim', 'u_fog', 'u_tint', 'u_rimK', 'u_fogK', 'u_wet', 'u_rain', 'u_bloom', 'u_night']) this.loc[u] = gl.getUniformLocation(prog, u);
        this.gl = gl; this.prog = prog; this.ok = true;
        glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; });
      } catch (err) {
        console.warn('Effects pipeline unavailable:', err.message);
        this.ok = false;
      }
    },
    draw(u) {
      const gl = this.gl;
      gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      [bgC, fgC, emC].forEach((src, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, i > 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.generateMipmap(gl.TEXTURE_2D);
      });
      const L = this.loc;
      gl.uniform2f(L.u_res, glCanvas.width, glCanvas.height);
      gl.uniform2f(L.u_ldir, u.ldir[0], u.ldir[1]);
      gl.uniform1f(L.u_ground, u.ground);
      gl.uniform1f(L.u_time, u.time);
      gl.uniform1f(L.u_camx, u.camx);
      gl.uniform1f(L.u_scale, u.scale);
      gl.uniform1f(L.u_shx, u.shx);
      gl.uniform3fv(L.u_light, u.light);
      gl.uniform3fv(L.u_rim, u.rim);
      gl.uniform3fv(L.u_fog, u.fog);
      gl.uniform3fv(L.u_tint, u.tint);
      gl.uniform1f(L.u_rimK, u.rimK);
      gl.uniform1f(L.u_fogK, u.fogK);
      gl.uniform1f(L.u_wet, u.wet);
      gl.uniform1f(L.u_rain, u.rain);
      gl.uniform1f(L.u_bloom, u.bloom);
      gl.uniform1f(L.u_night, u.night);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
  GFX.init();

  function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); c.fill(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); }
  function dome(c, col, X, Y, r = 6.6, cut = 0.2) { c.fillStyle = col; c.beginPath(); c.arc(X, Y, r, Math.PI + cut, -cut); c.closePath(); c.fill(); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2); c.fill(); }

  const rgbCache = {};
  function rgbOf(hex) {
    if (rgbCache[hex]) return rgbCache[hex];
    const n = parseInt(hex.slice(1), 16);
    return (rgbCache[hex] = [n >> 16, (n >> 8) & 255, n & 255]);
  }
  function shade(hex, amt) {
    const [r, g, b] = rgbOf(hex);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rgba(hex, a) { const [r, g, b] = rgbOf(hex); return `rgba(${r},${g},${b},${a})`; }
  // Terrain colors under the current scene light.
  function litK(hex, k = 0) { const c = hex3(hex), t = LIGHT.terrain, m = 1 + k; return css3([c[0] * t[0] * m, c[1] * t[1] * m, c[2] * t[2] * m]); }
  function litA(hex, a) { const c = hex3(hex), t = LIGHT.terrain; return css3([c[0] * t[0], c[1] * t[1], c[2] * t[2]], a); }

  // Seeded value noise for terrain.
  const hillY = (x, seed, freq) => Math.sin(x * freq + seed) * 0.5 + Math.sin(x * freq * 2.3 + seed * 1.7) * 0.3 + Math.sin(x * freq * 5.1 + seed * 0.3) * 0.2;
  const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // Per-era art direction: daylight sky, terrain, flora and weather.
  const ART = [
    { sky: ['#e59a62', '#f2c58c', '#f9e2b8'], haze: '#f3cf9c', far: '#c79a74', mid: '#a9734d', near: '#7c4f33',
      ground: ['#dcb87e', '#a8824c'], lane: '#efd6a4', grass: '#b8a060', trees: 'cypress', weather: 'motes', tint: [0.05, 0.02, -0.01], stone: '#d8c39a' },
    { sky: ['#5d6f7d', '#9fb0b2', '#d9ddd0'], haze: '#c9d0c6', far: '#7f8a86', mid: '#5d6863', near: '#3d4842',
      ground: ['#6f7650', '#474c31'], lane: '#88805c', grass: '#5d7040', trees: 'pine', weather: 'leaves', tint: [-0.01, 0.0, 0.02], stone: '#9a9c93' },
    { sky: ['#1f6d6c', '#6fae92', '#f1d27c'], haze: '#bfd9a0', far: '#4f8a63', mid: '#2f6544', near: '#1e4630',
      ground: ['#7c6a38', '#4f4224'], lane: '#9a8650', grass: '#4f7a34', trees: 'palm', weather: 'spores', tint: [-0.01, 0.03, 0.01], stone: '#c4b48a' },
    { sky: ['#6d5a4c', '#b49778', '#e6cfa6'], haze: '#d6bf9b', far: '#8a7562', mid: '#655446', near: '#45382e',
      ground: ['#6f5b43', '#463829'], lane: '#8a7457', grass: '#6a6a3a', trees: 'oak', weather: 'ash', tint: [0.03, 0.01, -0.01], stone: '#9c8a74' },
    { sky: ['#47586a', '#7c8fa0', '#b4bec6'], haze: '#9aa8b4', far: '#4f5e6c', mid: '#3a4654', near: '#26303a',
      ground: ['#4a504c', '#2a2e30'], lane: '#5a605c', grass: '#3a463a', trees: 'pole', weather: 'rain', tint: [-0.02, 0.0, 0.03], stone: '#7a8086' },
    { sky: ['#2a1450', '#7a3a8a', '#e88ab0'], nightSky: ['#0a0418', '#1e0c34', '#3a1a4a'], haze: '#b08ac8', far: '#4a3a6a', mid: '#3a2a5a', near: '#2a2238',
      ground: ['#5a4a6a', '#2e2438'], lane: '#7a6a8a', grass: '#6aa898', trees: 'crystal', weather: 'spores', tint: [0.03, -0.01, 0.05], stone: '#8a7aa8' },
  ];
  const artOf = () => ART[S.sides[0].era];

  // ── Light model: day/night cycle ────────────────────────────────────────
  const DAY_LEN = 240; // seconds for one full day
  const NIGHT_SKY = ['#04070f', '#0b1626', '#1b2c43'];
  const DUSK_SKY = ['#2a2442', '#b0526b', '#f4a45c'];
  const SUN_COL = [1, 0.95, 0.86], DUSK_COL = [1, 0.6, 0.36], MOON_COL = [0.6, 0.72, 0.92];
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hex3 = (hex) => rgbOf(hex).map((v) => v / 255);
  const css3 = (c, a = 1) => `rgba(${Math.round(clamp01(c[0]) * 255)},${Math.round(clamp01(c[1]) * 255)},${Math.round(clamp01(c[2]) * 255)},${a})`;
  const PORTRAIT_LIGHT = { lx: -0.6, ly: -0.8, spec: 1, specRGB: '255,246,226', env: 'rgba(170,195,220,.55)' };
  const LIGHT = { tod: 0.4, dayK: 1, nightK: 0, duskK: 0, sky: ['#000', '#000', '#000'], light: [1, 1, 1], terrain: [1, 1, 1], rim: [1, 1, 1], rimK: 0.6,
    fog: [1, 1, 1], fogK: 0.3, wet: 0.1, lx: -0.6, ly: -0.8, sunX: 0, sunY: 0, moonX: 0, moonY: 0, horizon: GROUND - 70, label: 'Day', dirs: [PORTRAIT_LIGHT, PORTRAIT_LIGHT] };

  function computeLight(A) {
    const tod = S.tod;
    const sunH = -Math.cos(tod * Math.PI * 2);
    const dayK = smooth(-0.1, 0.3, sunH);
    const nightK = 1 - smooth(-0.35, 0.02, sunH);
    const duskK = clamp01(1 - Math.abs(sunH) / 0.33);
    const HZ = GROUND - 70;
    const arc = (t) => {
      const p = (t - 0.25) / 0.5;
      return [S.cam + viewW * (0.06 + 0.88 * p), HZ - Math.sin(Math.PI * Math.max(-0.2, Math.min(1.2, p))) * (HZ - 36)];
    };
    const [sunX, sunY] = arc(tod);
    const [moonX, moonY] = arc((tod + 0.5) % 1);
    const ns = A.nightSky || NIGHT_SKY;
    const sky = [0, 1, 2].map((i) => css3(mix3(mix3(hex3(ns[i]), hex3(A.sky[i]), dayK), hex3(DUSK_SKY[i]), duskK * (A.nightSky ? 0.3 : 0.7))));
    const sunCol = mix3(SUN_COL, DUSK_COL, duskK);
    const amb = mix3(mix3([0.28, 0.33, 0.5], [0.66, 0.66, 0.64], dayK), [0.6, 0.45, 0.45], duskK * 0.4);
    const direct = mix3(mix3([0, 0, 0], sunCol.map((v) => v * 0.42), dayK), MOON_COL.map((v) => v * 0.1), nightK);
    const light = [amb[0] + direct[0], amb[1] + direct[1], amb[2] + direct[2]];
    const useSun = dayK > 0.2 || duskK > 0.5;
    const srcX = useSun ? sunX : moonX, srcY = useSun ? sunY : moonY;
    let lx = (srcX - (S.cam + viewW / 2)) / (viewW / 2);
    let ly = -Math.max(0.12, (HZ - srcY) / (HZ - 36));
    const len = Math.hypot(lx, ly) || 1; lx /= len; ly /= len;
    const rimCol = useSun ? sunCol : MOON_COL;
    const lowSun = 1 - Math.min(1, Math.abs(ly));
    const fog = mix3(mix3(hex3('#1a2538'), hex3(A.haze), dayK), [0.85, 0.55, 0.45], duskK * 0.45);
    const rain = A.weather === 'rain';
    const specCol = useSun ? sunCol : MOON_COL;
    const spec = useSun ? 0.45 + 0.55 * dayK : 0.35;
    const env = css3(mix3(hex3(A.sky[1]), [0.1, 0.14, 0.24], nightK), 0.55);
    Object.assign(LIGHT, {
      tod, dayK, nightK, duskK, sky, light, terrain: light.map((v) => Math.min(1.08, v)), rim: rimCol, rimK: 0.35 + 0.55 * lowSun + 0.2 * nightK,
      fog, fogK: 0.15 + 0.4 * duskK + 0.3 * nightK + (rain ? 0.15 : 0), wet: rain ? 0.7 : 0.08 + 0.22 * nightK + 0.08 * duskK,
      lx, ly, sunX, sunY, moonX, moonY, horizon: HZ,
      label: dayK > 0.75 ? 'Day' : nightK > 0.75 ? 'Night' : tod < 0.5 ? 'Dawn' : 'Dusk',
    });
    const specRGB = specCol.map((v) => Math.round(v * 255)).join(',');
    LIGHT.dirs = [
      { lx, ly, spec, specRGB, env },
      { lx: -lx, ly, spec, specRGB, env },
    ];
  }
  // Terrain is lit on the CPU; actors are lit in the GPU pass.
  function lit(hex, extra = 0) {
    const c = hex3(hex);
    const t = LIGHT.terrain;
    return css3([c[0] * t[0] + extra, c[1] * t[1] + extra, c[2] * t[2] + extra]);
  }

  function drawSky() {
    const c = ctx;
    const left = S.cam - 20, right = S.cam + viewW + 20;
    const g = c.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, LIGHT.sky[0]); g.addColorStop(0.55, LIGHT.sky[1]); g.addColorStop(1, LIGHT.sky[2]);
    c.fillStyle = g;
    c.fillRect(left, 0, right - left, GROUND + 2);

    if (LIGHT.nightK > 0.02) {
      for (let i = 0; i < 90; i++) {
        const x = left + hash(i) * (right - left), y = hash(i + 99) * 200;
        c.fillStyle = `rgba(255,255,255,${LIGHT.nightK * (0.25 + 0.55 * Math.abs(Math.sin(S.t * (0.6 + hash(i + 7)) + i)))})`;
        c.fillRect(x, y, 1.3, 1.3);
      }
      // Moon
      const mx = LIGHT.moonX, my = LIGHT.moonY;
      if (my < LIGHT.horizon + 10) {
        const mg = c.createRadialGradient(mx, my, 0, mx, my, 90);
        mg.addColorStop(0, `rgba(160,185,220,${0.3 * LIGHT.nightK})`); mg.addColorStop(1, 'rgba(160,185,220,0)');
        c.fillStyle = mg; c.fillRect(mx - 90, my - 90, 180, 180);
        c.fillStyle = `rgba(236,241,248,${0.4 + 0.6 * LIGHT.nightK})`;
        circle(c, mx, my, 12);
        c.fillStyle = `rgba(150,165,185,${0.35 * LIGHT.nightK})`;
        circle(c, mx - 4, my - 3, 3); circle(c, mx + 4, my + 4, 2.2); circle(c, mx + 5, my - 5, 1.4);
        ectx.fillStyle = `rgba(150,170,210,${0.25 * LIGHT.nightK})`; circle(ectx, mx, my, 10);
      }
    }
    const sx = LIGHT.sunX, sy = LIGHT.sunY;
    if (sy < LIGHT.horizon + 30 && LIGHT.nightK < 0.98) {
      const vis = (1 - LIGHT.nightK) * (artOf().weather === 'rain' ? 0.3 : 1);
      const glowR = 230 + 90 * LIGHT.duskK;
      const glow = c.createRadialGradient(sx, sy, 0, sx, sy, glowR);
      glow.addColorStop(0, css3(mix3(SUN_COL, DUSK_COL, LIGHT.duskK), 0.7 * vis));
      glow.addColorStop(1, css3(mix3(SUN_COL, DUSK_COL, LIGHT.duskK), 0));
      c.fillStyle = glow;
      c.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
      // Light shafts
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const a = 0.9 + i * 0.3 + Math.sin(S.t * 0.15 + i) * 0.04;
        c.fillStyle = `rgba(255,226,170,${0.035 * vis})`;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + Math.cos(a - 0.05) * 460, sy + Math.sin(a - 0.05) * 460);
        c.lineTo(sx + Math.cos(a + 0.05) * 460, sy + Math.sin(a + 0.05) * 460);
        c.closePath(); c.fill();
      }
      c.restore();
      c.fillStyle = css3(mix3([1, 0.97, 0.86], [1, 0.75, 0.5], LIGHT.duskK), vis);
      circle(c, sx, sy, 20);
      ectx.fillStyle = css3(mix3([1, 0.9, 0.7], [1, 0.6, 0.35], LIGHT.duskK), 0.55 * vis);
      circle(ectx, sx, sy, 18);
    }
  }

  function drawClouds() {
    const c = ctx;
    const dayTop = mix3([1, 1, 1], [1, 0.78, 0.7], LIGHT.duskK);
    const top = css3(mix3(dayTop, [0.32, 0.38, 0.5], LIGHT.nightK), 0.7 - 0.35 * LIGHT.nightK);
    const bot = css3(mix3(mix3([0.75, 0.7, 0.72], [0.55, 0.35, 0.45], LIGHT.duskK), [0.1, 0.14, 0.22], LIGHT.nightK), 0.4);
    const heavy = artOf().weather === 'rain';
    for (let i = 0; i < (heavy ? 11 : 8); i++) {
      const span = WORLD_W + 600;
      const cx = ((i * 263 + S.t * (4 + i)) % span) - 300;
      const x = cx * 0.75 + S.cam * 0.25;
      const y = 34 + (i % 4) * 20 + hash(i) * 10;
      const s = (0.7 + hash(i + 3) * 0.7) * (heavy ? 1.4 : 1);
      const g = ctx.createLinearGradient(0, y - 14 * s, 0, y + 8 * s);
      g.addColorStop(0, top); g.addColorStop(1, bot);
      c.fillStyle = g;
      ell(c, x, y, 34 * s, 9 * s);
      ell(c, x - 18 * s, y + 2, 20 * s, 7 * s);
      ell(c, x + 14 * s, y - 6 * s, 22 * s, 10 * s);
      ell(c, x + 34 * s, y + 1, 18 * s, 6 * s);
    }
  }

  function ridgeY(wx, par, base, amp, freq, seed) { return base - amp * hillY(wx, seed, freq); }
  function ridge(par, base, amp, freq, seed, col, haze, hazeA) {
    const c = ctx;
    const left = S.cam - 20, right = S.cam + viewW + 20;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(left, GROUND + 2);
    for (let x = left; x <= right + 8; x += 6) c.lineTo(x, ridgeY(x - S.cam * par, par, base, amp, freq, seed));
    c.lineTo(right + 8, GROUND + 2);
    c.closePath();
    c.fill();
    if (haze) {
      const g = c.createLinearGradient(0, base - amp, 0, GROUND);
      g.addColorStop(0, css3(LIGHT.fog, 0));
      g.addColorStop(1, css3(LIGHT.fog, Math.min(0.85, hazeA * (0.7 + LIGHT.fogK))));
      c.fillStyle = g;
      c.fill();
    }
  }

  function drawTree(c, type, x, y, h, col, i) {
    const sway = Math.sin(S.t * 0.9 + i) * 1.2;
    c.fillStyle = col;
    c.strokeStyle = col;
    switch (type) {
      case 'cypress':
        c.fillRect(x - 1, y - 6, 2, 6);
        ell(c, x + sway * 0.3, y - h * 0.55, h * 0.13, h * 0.5);
        break;
      case 'pine':
        c.fillRect(x - 1, y - 6, 2, 6);
        for (let k = 0; k < 3; k++) poly(c, [[x - h * (0.28 - k * 0.06), y - 4 - k * h * 0.26], [x + sway * 0.2, y - h * (0.45 + k * 0.26)], [x + h * (0.28 - k * 0.06), y - 4 - k * h * 0.26]]);
        break;
      case 'palm': {
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 4, y - h * 0.5, x + 2 + sway, y - h); c.stroke();
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 + (k - 2.5) * 0.55;
          ell(c, x + 2 + sway + Math.cos(a) * h * 0.22, y - h + Math.sin(a) * h * 0.12 + 3, h * 0.24, 2, a);
        }
        break;
      }
      case 'oak':
        c.fillRect(x - 1.5, y - h * 0.4, 3, h * 0.4);
        circle(c, x + sway * 0.3, y - h * 0.6, h * 0.24);
        circle(c, x - h * 0.17, y - h * 0.48, h * 0.18);
        circle(c, x + h * 0.18, y - h * 0.5, h * 0.19);
        break;
      case 'pole':
        c.fillRect(x - 1, y - h, 2, h);
        c.fillRect(x - 6, y - h + 4, 12, 1.5);
        break;
    }
  }

  // ── Battlefields ────────────────────────────────────────────────────────
  // Each era fights somewhere of its own: the Colosseum, a castle siege,
  // Tenochtitlan on its lake, a harbor under the guns, a ruined city, and
  // an alien world. Scenes are built from parallax layers; layer(par) maps a
  // world x on that layer to the screen-space world x.
  const layerX = (wx, par) => wx + S.cam * par;
  const onScreen = (x, pad = 120) => x > S.cam - pad && x < S.cam + viewW + pad;
  function eachRepeat(par, step, fn, offset = 0) {
    const first = Math.floor((S.cam - S.cam * par - 200 - offset) / step);
    const last = Math.ceil((S.cam + viewW - S.cam * par + 200 - offset) / step);
    for (let i = first; i <= last; i++) fn(layerX(i * step + offset, par), i);
  }
  const night = () => LIGHT.nightK;
  const windowGlow = (a = 1) => `rgba(255,200,120,${(0.08 + 0.85 * night()) * a})`;
  function glowDot(x, y, r, rgb, a) {
    ectx.save(); ectx.globalCompositeOperation = 'lighter';
    const g = ectx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ectx.fillStyle = g; circle(ectx, x, y, r);
    ectx.restore();
  }

  // 0 · The Colosseum: three tiers of arches, a roaring crowd, the velarium.
  function sceneColosseum(A) {
    const c = ctx;
    const par = 0.3, top = GROUND - 196;
    const stone = litK('#dcc49a'), stoneD = litK('#b89a6c'), dark = litK('#4a3622', -0.2);
    c.fillStyle = stone;
    c.fillRect(S.cam - 20, top, viewW + 40, GROUND - top);
    // Crowd in the stands
    eachRepeat(par, 6, (x, i) => {
      for (let r = 0; r < 4; r++) {
        const hue = ['#a8322a', '#e6dccb', '#2f4f8a', '#c9a23a', '#6a4a2a', '#efe4cf'][Math.floor(hash(i * 7 + r) * 6)];
        const cheer = Math.sin(S.t * 6 + i * 1.7 + r) > 0.6 ? -1.4 : 0;
        c.fillStyle = litK(hue, -0.1);
        rr(c, x + (r % 2) * 3, top + 8 + r * 7 + cheer, 4, 5, 1.5);
        c.fillStyle = litK('#c99067', -0.1);
        circle(c, x + 2 + (r % 2) * 3, top + 7 + r * 7 + cheer, 1.6);
      }
    });
    c.fillStyle = stoneD; c.fillRect(S.cam - 20, top + 36, viewW + 40, 4);
    // Three tiers of arches
    for (let tier = 0; tier < 3; tier++) {
      const y0 = top + 42 + tier * 40;
      c.fillStyle = stoneD; c.fillRect(S.cam - 20, y0 + 34, viewW + 40, 4);
      eachRepeat(par, 30, (x) => {
        c.fillStyle = dark;
        c.beginPath(); c.moveTo(x + 6, y0 + 34); c.lineTo(x + 6, y0 + 12); c.arc(x + 15, y0 + 12, 9, Math.PI, 0); c.lineTo(x + 24, y0 + 34); c.closePath(); c.fill();
        if (night() > 0.3 && tier === 2) { c.fillStyle = windowGlow(0.6); c.fillRect(x + 9, y0 + 18, 12, 14); }
        c.fillStyle = stone; c.fillRect(x + 1, y0 + 4, 4, 30);
        c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 1, y0 + 4, 1.4, 30);
      });
    }
    // Velarium awning poles and canvas
    eachRepeat(par, 150, (x, i) => {
      c.strokeStyle = litK('#5a3a22'); c.lineWidth = 2; line(c, x, top + 6, x, top - 30);
      c.fillStyle = litK(i % 2 ? '#a8322a' : '#e6dccb', -0.05);
      poly(c, [[x, top - 28], [x + 150, top - 22], [x + 150, top - 12], [x, top - 18]]);
    });
    // Imperial banners
    eachRepeat(par, 300, (x) => { c.fillStyle = litK('#8e1b16'); poly(c, [[x + 140, top + 42], [x + 156, top + 42], [x + 156, top + 74], [x + 148, top + 68], [x + 140, top + 74]]); c.fillStyle = litK('#d9b45a'); c.fillRect(x + 143, top + 50, 10, 2); }, 70);
    // Podium wall around the arena floor
    const pPar = 0.62;
    c.fillStyle = litK('#e8dcc4'); c.fillRect(S.cam - 20, GROUND - 46, viewW + 40, 26);
    c.fillStyle = litK('#8e1b16'); c.fillRect(S.cam - 20, GROUND - 40, viewW + 40, 4);
    c.fillStyle = litK('#b8a888'); c.fillRect(S.cam - 20, GROUND - 22, viewW + 40, 4);
    eachRepeat(pPar, 220, (x, i) => {
      // Gate of life with a portcullis
      if (i % 3 === 0) {
        c.fillStyle = litK('#2a1e14');
        c.beginPath(); c.moveTo(x - 14, GROUND - 20); c.lineTo(x - 14, GROUND - 40); c.arc(x, GROUND - 40, 14, Math.PI, 0); c.lineTo(x + 14, GROUND - 20); c.fill();
        c.strokeStyle = litK('#5a5a5a'); c.lineWidth = 1; for (let k = -10; k <= 10; k += 5) line(c, x + k, GROUND - 50, x + k, GROUND - 20);
      } else {
        // Statue on a plinth
        c.fillStyle = litK('#e8dcc4', 0.05); c.fillRect(x - 6, GROUND - 58, 12, 12);
        c.fillStyle = litK('#d0c4ac'); circle(c, x, GROUND - 75, 3.4); c.fillRect(x - 3.5, GROUND - 72, 7, 14); line(c, x + 3, GROUND - 70, x + 9, GROUND - 80);
      }
      if (night() > 0.2) { c.fillStyle = litK('#3a2a1a'); c.fillRect(x + 60, GROUND - 56, 4, 10); flameOn(ectx, x + 62, GROUND - 56, 0.8); }
    });
  }

  // 1 · Castle siege: curtain walls, towers, siege camp and trebuchets.
  function sceneCastle(A) {
    const c = ctx;
    ridge(0.35, GROUND - 78, 20, 0.007, 4, litK(A.mid), A.haze, 0.5);
    const par = 0.35, wallTop = GROUND - 128;
    const stone = litK('#8c8f88'), stoneD = litK('#6a6d66'), stoneL = litK('#a8aba2');
    c.fillStyle = stone; c.fillRect(S.cam - 20, wallTop, viewW + 40, 70);
    c.fillStyle = stoneD;
    eachRepeat(par, 14, (x) => c.fillRect(x, wallTop - 8, 8, 8));
    eachRepeat(par, 260, (x, i) => {
      c.fillStyle = stoneL; c.fillRect(x - 18, wallTop - 46, 36, 116);
      c.fillStyle = stoneD; for (let k = 0; k < 4; k++) c.fillRect(x - 18 + k * 10, wallTop - 54, 6, 8);
      c.fillStyle = litK('#5a2f22'); poly(c, [[x - 21, wallTop - 54], [x, wallTop - 84], [x + 21, wallTop - 54]]);
      c.fillStyle = night() > 0.3 ? windowGlow() : litK('#1e1610'); c.fillRect(x - 2, wallTop - 30, 4, 10); c.fillRect(x - 2, wallTop - 6, 4, 10);
      const col = ['#2f4f9a', '#a8322a', '#e0b84a', '#2f6a3a'][i & 3];
      c.fillStyle = litK(col); poly(c, [[x + 24, wallTop + 4], [x + 38, wallTop + 4], [x + 38, wallTop + 36], [x + 31, wallTop + 30], [x + 24, wallTop + 36]]);
      if (i % 2 === 0) { c.fillStyle = litK('#1e1610'); c.beginPath(); c.moveTo(x + 112, wallTop + 70); c.lineTo(x + 112, wallTop + 40); c.arc(x + 126, wallTop + 40, 14, Math.PI, 0); c.lineTo(x + 140, wallTop + 70); c.fill(); }
    });
    c.strokeStyle = litK('#6a6d66', -0.1); c.lineWidth = 0.5;
    for (let y = wallTop + 10; y < wallTop + 70; y += 9) line(c, S.cam - 20, y, S.cam + viewW + 20, y);
    // Siege camp
    const nPar = 0.6;
    ridge(nPar, GROUND - 30, 10, 0.012, 9, litK(A.near), A.haze, 0.2);
    eachRepeat(nPar, 170, (x, i) => {
      const cols = ['#e6dccb', '#a8322a', '#2f4f9a'];
      const m3 = ((i % 3) + 3) % 3;
      const tc = litK(cols[m3]), ts = litK(cols[m3], -0.25);
      c.fillStyle = tc; poly(c, [[x - 18, GROUND - 22], [x, GROUND - 52], [x + 18, GROUND - 22]]);
      c.fillStyle = ts; poly(c, [[x, GROUND - 52], [x + 18, GROUND - 22], [x + 4, GROUND - 22]]);
      c.strokeStyle = litK('#3a2a1a'); c.lineWidth = 1; line(c, x, GROUND - 52, x, GROUND - 62);
      c.fillStyle = litK(cols[(m3 + 1) % 3]); poly(c, [[x, GROUND - 62], [x + 9, GROUND - 59], [x, GROUND - 56]]);
      if (i % 3 === 1) {
        // Trebuchet
        const bx = x + 80;
        c.strokeStyle = litK('#4a321e'); c.lineWidth = 2.2;
        line(c, bx - 14, GROUND - 22, bx, GROUND - 56); line(c, bx + 14, GROUND - 22, bx, GROUND - 56);
        const a = -0.9 + Math.sin(S.t * 0.5 + i) * 0.25;
        line(c, bx - Math.cos(a) * 26, GROUND - 56 - Math.sin(a) * 26, bx + Math.cos(a) * 14, GROUND - 56 + Math.sin(a) * 14);
        c.fillStyle = litK('#4a321e'); c.fillRect(bx + Math.cos(a) * 14 - 4, GROUND - 56 + Math.sin(a) * 14, 8, 8);
      }
      if (night() > 0.2 && i % 2) { c.fillStyle = litK('#3a2a1a'); c.fillRect(x + 40, GROUND - 26, 6, 3); flameOn(ectx, x + 43, GROUND - 26, 1.1); }
    });
    // Palisade
    c.fillStyle = litK('#5a3a20');
    eachRepeat(0.75, 9, (x, i) => { if (hash(i) < 0.75) poly(c, [[x, GROUND - 2], [x + 3, GROUND - 20 - hash(i + 1) * 5], [x + 6, GROUND - 2]]); });
  }

  // 2 · Tenochtitlan: volcanoes, Lake Texcoco, the Templo Mayor.
  function sceneTenochtitlan(A) {
    const c = ctx;
    // Volcanoes on the far rim
    eachRepeat(0.12, 700, (x, i) => {
      c.fillStyle = litK('#5f8a7a', -0.05);
      poly(c, [[x - 160, GROUND - 60], [x - 18, GROUND - 190 - hash(i) * 20], [x + 18, GROUND - 190 - hash(i) * 20], [x + 160, GROUND - 60]]);
      c.fillStyle = litK('#efe4cf', -0.05); poly(c, [[x - 30, GROUND - 168], [x - 18, GROUND - 190 - hash(i) * 20], [x + 18, GROUND - 190 - hash(i) * 20], [x + 30, GROUND - 168]]);
      c.fillStyle = 'rgba(200,200,200,.25)';
      for (let k = 0; k < 4; k++) ell(c, x + Math.sin(S.t * 0.2 + k) * 6 + k * 8, GROUND - 205 - hash(i) * 20 - k * 12, 10 + k * 4, 6 + k * 2);
    }, 200);
    // The lake
    const lakeTop = GROUND - 66, lakeBot = GROUND - 30;
    const lg = c.createLinearGradient(0, lakeTop, 0, lakeBot);
    lg.addColorStop(0, css3(mix3(hex3('#5fa8a0'), LIGHT.fog, 0.3), 1)); lg.addColorStop(1, litK('#2f6a6a'));
    c.fillStyle = lg; c.fillRect(S.cam - 20, lakeTop, viewW + 40, lakeBot - lakeTop);
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 0.6;
    for (let k = 0; k < 40; k++) {
      const x = S.cam + ((hash(k) * 1600 + S.t * 6) % (viewW + 40)) - 20, y = lakeTop + 4 + hash(k + 9) * 30;
      line(c, x, y, x + 8 + hash(k) * 10, y);
    }
    // City on the island
    const par = 0.35;
    eachRepeat(par, 520, (x, i) => {
      const base = lakeTop + 4;
      // Great pyramid with twin shrines
      for (let s = 0; s < 5; s++) { c.fillStyle = litK(s % 2 ? '#d8cfb8' : '#cfc4aa'); c.fillRect(x - 60 + s * 9, base - (s + 1) * 13, 120 - s * 18, 13); }
      c.fillStyle = litK('#b8ad94'); c.fillRect(x - 14, base - 65, 9, 65); c.fillRect(x + 5, base - 65, 9, 65);
      c.fillStyle = litK('#a8322a'); c.fillRect(x - 24, base - 86, 18, 21);
      c.fillStyle = litK('#2f6aa8'); c.fillRect(x + 6, base - 86, 18, 21);
      c.fillStyle = litK('#efe4cf'); c.fillRect(x - 24, base - 90, 18, 4); c.fillRect(x + 6, base - 90, 18, 4);
      if (night() > 0.2) { flameOn(ectx, x - 15, base - 90, 1); flameOn(ectx, x + 15, base - 90, 1); }
      // White city blocks
      for (let k = 0; k < 7; k++) {
        const bx = x + 80 + k * 30, h = 12 + hash(i * 9 + k) * 14;
        c.fillStyle = litK('#e6dccb', -0.05); c.fillRect(bx, base - h, 24, h);
        c.fillStyle = night() > 0.3 ? windowGlow(0.8) : litK('#5a4a3a'); c.fillRect(bx + 9, base - 8, 6, 8);
        c.fillStyle = litK('#2f6a3a'); c.fillRect(bx, base - h - 2, 24, 2);
      }
    });
    // Causeway across the water
    c.fillStyle = litK('#b8a888'); c.fillRect(S.cam - 20, lakeBot - 6, viewW + 40, 4);
    // Chinampas reeds and palms in the foreground
    const nPar = 0.6;
    ridge(nPar, GROUND - 26, 8, 0.012, 13, litK(A.near), A.haze, 0.15);
    eachRepeat(nPar, 46, (x, i) => { if (hash(i + 3) > 0.45) drawTree(c, 'palm', x, GROUND - 22 + hash(i) * 4, 26 + hash(i + 5) * 20, litK(A.near, -0.2), i); });
  }

  // 3 · Harbor battle: tall ships under sail, a star fort, gun smoke.
  function sceneHarbor(A) {
    const c = ctx;
    const seaTop = GROUND - 92, seaBot = GROUND - 40;
    const sg = c.createLinearGradient(0, seaTop, 0, seaBot);
    sg.addColorStop(0, css3(mix3(hex3('#7a8a96'), LIGHT.fog, 0.4))); sg.addColorStop(1, litK('#3a5060'));
    c.fillStyle = sg; c.fillRect(S.cam - 20, seaTop, viewW + 40, seaBot - seaTop);
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.6;
    for (let k = 0; k < 50; k++) { const x = S.cam + ((hash(k) * 1800 + S.t * 4) % (viewW + 40)) - 20, y = seaTop + 3 + hash(k + 5) * 46; line(c, x, y, x + 6 + hash(k) * 10, y); }
    // Tall ships
    eachRepeat(0.22, 360, (x, i) => {
      const y = seaTop + 26 + hash(i) * 10, bob = Math.sin(S.t * 0.8 + i) * 1.2, s = 0.8 + hash(i + 2) * 0.4;
      c.save(); c.translate(x, y + bob); c.scale(s * (i % 2 ? 1 : -1), s);
      c.fillStyle = litK('#3a2a1e'); poly(c, [[-40, 0], [40, 0], [32, 10], [-34, 10]]);
      c.fillStyle = litK('#c9a23a', -0.2); c.fillRect(-36, 2, 70, 1.5);
      c.fillStyle = litK('#1e1610'); for (let k = -28; k < 30; k += 9) c.fillRect(k, 4, 3, 3);
      c.strokeStyle = litK('#3a2a1e'); c.lineWidth = 1.5;
      for (const mx of [-20, 0, 20]) {
        line(c, mx, 0, mx, -58);
        c.fillStyle = litK('#efe4cf', -0.08);
        for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(mx - 11, -54 + k * 17); c.quadraticCurveTo(mx + 3, -47 + k * 17, mx - 11, -40 + k * 17); c.lineTo(mx + 11, -40 + k * 17); c.quadraticCurveTo(mx + 15, -47 + k * 17, mx + 11, -54 + k * 17); c.closePath(); c.fill(); }
      }
      c.fillStyle = litK(i % 2 ? '#a8322a' : '#2f4f9a'); poly(c, [[0, -58], [12, -55], [0, -52]]);
      c.restore();
      if ((S.t * 0.4 + i) % 5 < 0.4) emitSmokeAt(x + (i % 2 ? 30 : -30), y + 4);
    }, 120);
    // Star fort on the headland
    const par = 0.38;
    eachRepeat(par, 640, (x) => {
      c.fillStyle = litK('#8a7562');
      poly(c, [[x - 90, seaBot], [x - 70, seaBot - 38], [x - 30, seaBot - 30], [x, seaBot - 52], [x + 30, seaBot - 30], [x + 70, seaBot - 38], [x + 90, seaBot]]);
      c.fillStyle = litK('#6a5644'); c.fillRect(x - 70, seaBot - 6, 140, 6);
      c.strokeStyle = litK('#2a2016'); c.lineWidth = 1; line(c, x, seaBot - 52, x, seaBot - 80);
      c.fillStyle = litK('#efe4cf'); poly(c, [[x, seaBot - 80], [x + 14, seaBot - 76 + Math.sin(S.t * 3)], [x, seaBot - 72]]);
      if (night() > 0.3) { c.fillStyle = windowGlow(); c.fillRect(x - 40, seaBot - 26, 3, 4); c.fillRect(x + 36, seaBot - 26, 3, 4); }
    }, 300);
    // Earthworks, gabions and guns
    const nPar = 0.6;
    ridge(nPar, GROUND - 28, 9, 0.012, 21, litK(A.near), A.haze, 0.15);
    eachRepeat(nPar, 140, (x, i) => {
      c.fillStyle = litK('#6a5a3a');
      for (let k = 0; k < 4; k++) { rr(c, x + k * 9, GROUND - 38, 8, 16, 3); }
      c.strokeStyle = litK('#4a3a22'); c.lineWidth = 0.6; for (let k = 0; k < 4; k++) for (let y = GROUND - 35; y < GROUND - 22; y += 3) line(c, x + k * 9, y, x + k * 9 + 8, y);
      if (i % 2) {
        c.fillStyle = litK('#2a2a2a'); rr(c, x + 44, GROUND - 34, 20, 5, 2);
        c.fillStyle = litK('#5a3a20'); circle(c, x + 48, GROUND - 28, 4);
      }
      if (i % 3 === 0) drawTree(c, 'oak', x + 90, GROUND - 22, 40, litK(A.near, -0.2), i);
    });
  }
  function emitSmokeAt(x, y) { if (!S.paused && Math.random() < 0.08) emitSmoke(x, y, 1, 6, '200,196,190', 0.3); }

  // 4 · Ruined city: shattered towers, fires, rubble and wire.
  function sceneRuins(A) {
    const c = ctx;
    const par = 0.3;
    eachRepeat(par, 46, (x, i) => {
      const h = 60 + hash(i) * 110, w = 34 + hash(i + 3) * 10;
      const top = GROUND - 40 - h;
      c.fillStyle = litK(i % 2 ? '#4a5664' : '#3a4450');
      c.beginPath();
      c.moveTo(x, GROUND - 40); c.lineTo(x, top + 8);
      // Jagged broken roofline
      for (let k = 0; k <= 4; k++) c.lineTo(x + (w * k) / 4, top + (hash(i * 5 + k) * 18) * (hash(i + 8) < 0.6 ? 1 : 0.1));
      c.lineTo(x + w, GROUND - 40); c.closePath(); c.fill();
      // Floors and windows; some blown out
      for (let y = top + 16; y < GROUND - 46; y += 9) for (let k = 0; k < 4; k++) {
        const v = hash(i * 31 + y + k);
        if (v < 0.15) { c.fillStyle = litK('#1a1f26'); c.fillRect(x + 3 + k * 8, y, 7, 7); }
        else if (v < 0.4) { c.fillStyle = night() > 0.3 ? windowGlow(0.5) : litK('#2a323c'); c.fillRect(x + 4 + k * 8, y + 1, 4, 5); }
      }
      if (hash(i + 2) < 0.18) {
        const fx = x + w / 2, fy = top + 20;
        flameOn(ectx, fx, fy, 1.4);
        c.fillStyle = 'rgba(40,36,34,.35)';
        for (let k = 0; k < 6; k++) ell(c, fx + Math.sin(S.t * 0.3 + k + i) * 6 + k * 6, fy - 10 - k * 16, 8 + k * 4, 6 + k * 2.5);
      }
    });
    // Rubble, wrecks and wire in the foreground
    const nPar = 0.6;
    ridge(nPar, GROUND - 28, 10, 0.014, 31, litK('#3a3a36'), A.haze, 0.2);
    eachRepeat(nPar, 120, (x, i) => {
      c.fillStyle = litK('#4a4a44');
      for (let k = 0; k < 6; k++) poly(c, [[x + k * 7, GROUND - 22], [x + k * 7 + 4, GROUND - 30 - hash(i + k) * 10], [x + k * 7 + 10, GROUND - 22]]);
      if (i % 3 === 0) {
        // Burnt-out car
        c.fillStyle = litK('#2a2622'); rr(c, x + 60, GROUND - 34, 34, 10, 3); rr(c, x + 66, GROUND - 42, 20, 9, 3);
        c.fillStyle = litK('#111'); circle(c, x + 68, GROUND - 23, 4); circle(c, x + 86, GROUND - 23, 4);
      } else {
        c.strokeStyle = litK('#5a5a52'); c.lineWidth = 1.2; line(c, x + 60, GROUND - 20, x + 60, GROUND - 38); line(c, x + 110, GROUND - 20, x + 110, GROUND - 38);
        c.strokeStyle = litK('#7a7a72'); c.lineWidth = 0.6;
        c.beginPath(); for (let k = 0; k <= 50; k += 2) c.lineTo(x + 60 + k, GROUND - 34 + Math.sin(k * 0.9) * 2.4); c.stroke();
        c.beginPath(); for (let k = 0; k <= 50; k += 2) c.lineTo(x + 60 + k, GROUND - 27 + Math.cos(k * 0.9) * 2.4); c.stroke();
      }
    });
  }

  // 5 · Alien world: ringed planet, crystal spires, hive citadel, mothership.
  function sceneAlien(A) {
    const c = ctx;
    // Ringed planet and moons, fixed to the view
    const px = S.cam + viewW * 0.22, py = 92;
    const pg = c.createRadialGradient(px - 20, py - 20, 6, px, py, 62);
    pg.addColorStop(0, '#f2a2e0'); pg.addColorStop(0.6, '#8a4ab0'); pg.addColorStop(1, '#2a1a4a');
    c.fillStyle = pg; circle(c, px, py, 58);
    c.strokeStyle = 'rgba(240,200,255,.55)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(px, py, 96, 16, -0.25, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#d8f2ff'; circle(c, S.cam + viewW * 0.55, 46, 7);
    c.fillStyle = '#ffd8a8'; circle(c, S.cam + viewW * 0.62, 70, 4);
    // Crystal mountains
    eachRepeat(0.15, 90, (x, i) => {
      const h = 70 + hash(i) * 90;
      c.fillStyle = litK(i % 2 ? '#3a2a5a' : '#4a3a6a');
      poly(c, [[x - 30, GROUND - 60], [x - 4, GROUND - 60 - h], [x + 6, GROUND - 60 - h * 0.9], [x + 34, GROUND - 60]]);
      c.fillStyle = 'rgba(160,255,240,.12)'; poly(c, [[x - 4, GROUND - 60 - h], [x + 6, GROUND - 60 - h * 0.9], [x + 2, GROUND - 60]]);
    });
    // Hive citadel with glowing windows
    const par = 0.35;
    eachRepeat(par, 300, (x, i) => {
      const h = 120 + hash(i) * 60;
      c.fillStyle = litK('#2a1a3a');
      c.beginPath(); c.moveTo(x - 26, GROUND - 40); c.quadraticCurveTo(x - 30, GROUND - 40 - h * 0.6, x, GROUND - 40 - h); c.quadraticCurveTo(x + 30, GROUND - 40 - h * 0.6, x + 26, GROUND - 40); c.closePath(); c.fill();
      for (let k = 0; k < 6; k++) glowDot(x + (k % 2 ? 6 : -6), GROUND - 60 - k * (h / 7), 5, '255,90,210', 0.6);
      c.fillStyle = litK('#3a2a4a'); ell(c, x + 120, GROUND - 46, 46, 22);
      glowDot(x + 120, GROUND - 52, 14, '110,255,220', 0.35);
    });
    // Mothership with a tractor beam
    const mx = S.cam + viewW * 0.68 + Math.sin(S.t * 0.2) * 40, my = 60 + Math.sin(S.t * 0.7) * 4;
    c.fillStyle = '#1a1424'; ell(c, mx, my, 120, 16);
    c.fillStyle = '#2a2236'; ell(c, mx, my - 10, 50, 14);
    for (let k = -5; k <= 5; k++) glowDot(mx + k * 20, my + 6, 6, k % 2 ? '255,120,220' : '120,255,230', 0.5 + 0.4 * Math.sin(S.t * 4 + k));
    ectx.save(); ectx.globalCompositeOperation = 'lighter';
    const bg = ectx.createLinearGradient(0, my, 0, GROUND);
    bg.addColorStop(0, 'rgba(120,255,230,.22)'); bg.addColorStop(1, 'rgba(120,255,230,0)');
    ectx.fillStyle = bg; poly(ectx, [[mx - 16, my + 10], [mx + 16, my + 10], [mx + 60, GROUND - 40], [mx - 60, GROUND - 40]]);
    ectx.restore();
    // Crystal spires and glowing fungi up close
    const nPar = 0.6;
    ridge(nPar, GROUND - 28, 10, 0.014, 41, litK('#2a2238'), A.haze, 0.2);
    eachRepeat(nPar, 70, (x, i) => {
      if (hash(i) < 0.5) {
        const h = 26 + hash(i + 4) * 30;
        c.fillStyle = litK('#5a3a8a'); poly(c, [[x - 5, GROUND - 22], [x - 1, GROUND - 22 - h], [x + 5, GROUND - 22]]);
        c.fillStyle = 'rgba(200,160,255,.35)'; poly(c, [[x - 1, GROUND - 22 - h], [x + 5, GROUND - 22], [x + 1, GROUND - 22]]);
        glowDot(x, GROUND - 22 - h * 0.6, 8, '190,140,255', 0.35);
      } else {
        c.fillStyle = litK('#3a5a4a'); c.fillRect(x - 1, GROUND - 34, 2, 12);
        c.fillStyle = litK('#2f8a7a'); ell(c, x, GROUND - 35, 8, 4);
        glowDot(x, GROUND - 33, 10, '110,255,200', 0.45 + 0.2 * Math.sin(S.t * 2 + i));
      }
    });
  }

  const SCENES = [sceneColosseum, sceneCastle, sceneTenochtitlan, sceneHarbor, sceneRuins, sceneAlien];

  function drawBackground() {
    const A = artOf();
    const era = S.sides[0].era;
    drawSky();
    drawClouds();
    ridge(0.15, GROUND - 120, 30, 0.004, era * 7 + 3, litK(A.far), A.haze, 0.55);
    SCENES[era](A);
    drawGround(A, era);
  }

  function drawGround(A, era) {
    const c = ctx;
    const left = S.cam - 20, right = S.cam + viewW + 20;
    const g = c.createLinearGradient(0, GROUND, 0, WORLD_H);
    g.addColorStop(0, litK(A.ground[0])); g.addColorStop(1, litK(A.ground[1]));
    c.fillStyle = g;
    c.fillRect(left, GROUND, right - left, WORLD_H - GROUND + 40);
    // Worn battle lane
    const lane = c.createLinearGradient(0, GROUND, 0, GROUND + 18);
    lane.addColorStop(0, litA(A.lane, 0.55)); lane.addColorStop(1, litA(A.lane, 0));
    c.fillStyle = lane;
    c.fillRect(left, GROUND, right - left, 18);
    // Scorch marks
    for (const d of S.decals) {
      c.fillStyle = `rgba(20,14,10,${0.35 * (1 - d.t / 25)})`;
      ell(c, d.x, GROUND + 3, d.r, d.r * 0.16);
    }
    // Stones and texture
    const i0 = Math.max(0, Math.floor(left / 23)), i1 = Math.ceil(right / 23);
    for (let i = i0; i < i1; i++) {
      const x = i * 23 + hash(i) * 20;
      const y = GROUND + 10 + hash(i + 50) * 40;
      const r = 1 + hash(i + 9) * 2.6;
      c.fillStyle = litK(A.ground[1], -0.25);
      ell(c, x, y + 0.8, r, r * 0.55);
      c.fillStyle = litA(A.stone, 0.75);
      ell(c, x, y, r, r * 0.5);
    }
    // Grass lip
    c.strokeStyle = litK(A.grass);
    c.lineWidth = 1;
    const wind = Math.sin(S.t * 1.3) * 1.2;
    c.beginPath();
    const j0 = Math.max(0, Math.floor(left / 5)), j1 = Math.ceil(right / 5);
    for (let j = j0; j < j1; j++) {
      if (hash(j + 400) < 0.35) continue;
      const x = j * 5 + hash(j) * 4;
      const h = 2 + hash(j + 17) * 5;
      c.moveTo(x, GROUND + 1);
      c.lineTo(x + wind * (h / 6) + (hash(j + 3) - 0.5) * 2, GROUND + 1 - h);
    }
    c.stroke();
    c.fillStyle = litK(A.ground[0], -0.2);
    c.fillRect(left, GROUND, right - left, 1.2);
  }

  function drawForeground() {
    const A = artOf();
    const c = ctx;
    const par = 1.25;
    const col = shade(A.ground[1], -0.45);
    c.fillStyle = col;
    for (let i = 0; i < 70; i++) {
      const wx = i * 31 + hash(i + 900) * 25;
      const x = wx - S.cam * (par - 1);
      if (x < S.cam - 30 || x > S.cam + viewW + 30) continue;
      const y = WORLD_H + 2;
      if (hash(i + 77) < 0.5) {
        ell(c, x, y, 8 + hash(i) * 12, 5 + hash(i + 1) * 6);
      } else {
        for (let k = 0; k < 5; k++) {
          const bx = x + (k - 2) * 2.5, h = 8 + hash(i + k) * 12;
          poly(c, [[bx - 1.4, y], [bx + Math.sin(S.t * 1.2 + i + k) * 1.5, y - h], [bx + 1.4, y]]);
        }
      }
    }
  }

  function drawVignette() {
    const c = ctx;
    const g = c.createRadialGradient(cssW / 2, cssH * 0.55, Math.min(cssW, cssH) * 0.35, cssW / 2, cssH * 0.55, Math.max(cssW, cssH) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(10,6,0,${0.35 + 0.2 * LIGHT.nightK})`);
    c.fillStyle = g;
    c.fillRect(0, 0, cssW, cssH);
  }

  // ── Strongholds ─────────────────────────────────────────────────────────
  function wallFill(c, x, y, w, h, col) {
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, shade(col, 0.14));
    g.addColorStop(0.6, col);
    g.addColorStop(1, shade(col, -0.22));
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }
  function courses(c, x, y, w, h, col, rowH = 9, brick = 16) {
    c.strokeStyle = rgba(col, 0.5);
    c.lineWidth = 0.6;
    c.beginPath();
    for (let yy = y + rowH, r = 0; yy < y + h; yy += rowH, r++) {
      c.moveTo(x, yy); c.lineTo(x + w, yy);
      for (let xx = x + (r % 2 ? brick / 2 : 0); xx < x + w; xx += brick) { c.moveTo(xx, yy); c.lineTo(xx, yy + rowH); }
    }
    c.stroke();
  }
  function banner(c, x, y, h, col, t) {
    const w = Math.sin(S.t * 2 + t) * 1.2;
    c.fillStyle = col;
    poly(c, [[x - 5, y], [x + 5, y], [x + 5 + w, y + h], [x + w, y + h - 5], [x - 5 + w, y + h]]);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(x - 5, y, 3, h - 4);
    c.fillStyle = '#c9a23a';
    c.fillRect(x - 6, y - 1, 12, 2);
  }
  function flame(c0, x, y, s = 1) {
    onEmit(c0, (c) => flameOn(c, x, y, s));
  }
  function flameOn(c, x, y, s) {
    const f = 0.8 + Math.sin(S.t * 18 + x) * 0.2;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y - 3 * s, 0, x, y - 3 * s, 22 * s);
    g.addColorStop(0, 'rgba(255,190,90,.45)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    c.fillStyle = g;
    circle(c, x, y - 3 * s, 22 * s);
    c.fillStyle = 'rgba(255,150,50,.9)';
    poly(c, [[x - 3 * s, y], [x + Math.sin(S.t * 13 + x) * s, y - 9 * s * f], [x + 3 * s, y]]);
    c.fillStyle = 'rgba(255,240,170,.9)';
    poly(c, [[x - 1.4 * s, y], [x, y - 5 * s * f], [x + 1.4 * s, y]]);
    c.restore();
  }

  function drawBase(sd) {
    const c = ctx;
    const b = sd.base;
    const era = sd.era;
    const A = ART[era];
    const dir = DIR[sd.team];
    const team = TEAM_COL[sd.team];
    const stone = A.stone;
    c.save();
    c.translate(b.x, GROUND);
    // Contact shadow
    c.fillStyle = 'rgba(0,0,0,.28)';
    ell(c, 0, 1, 60, 6);
    let top = -120;
    switch (era) {
      case 0: {
        c.fillStyle = shade(stone, -0.15); c.fillRect(-54, -8, 108, 8);
        c.fillStyle = shade(stone, -0.05); c.fillRect(-50, -15, 100, 7);
        wallFill(c, -44, -96, 88, 81, shade(stone, -0.1));
        for (let i = 0; i < 4; i++) {
          const x = -40 + i * 24;
          wallFill(c, x, -94, 11, 79, stone);
          c.strokeStyle = rgba('#000000', 0.12); c.lineWidth = 0.7;
          for (let k = 2; k < 11; k += 3) line(c, x + k, -92, x + k, -17);
          c.fillStyle = shade(stone, 0.15); c.fillRect(x - 2, -98, 15, 4);
        }
        c.fillStyle = shade(stone, 0.08); c.fillRect(-50, -108, 100, 10);
        c.fillStyle = shade(stone, -0.12); c.fillRect(-50, -100, 100, 2);
        c.fillStyle = shade(stone, 0.18); poly(c, [[-52, -108], [0, -132], [52, -108]]);
        c.fillStyle = shade(stone, -0.1); poly(c, [[-38, -110], [0, -126], [38, -110]]);
        c.fillStyle = '#3a2a1c'; rr(c, -11, -44, 22, 29, 2);
        c.fillStyle = '#b8862e'; c.fillRect(-1, -42, 2, 26);
        banner(c, -28, -92, 30, team, 0); banner(c, 28, -92, 30, team, 1);
        c.fillStyle = '#5a4630'; c.fillRect(-49, -116, 6, 8); c.fillRect(43, -116, 6, 8);
        flame(c, -46, -116, 0.9); flame(c, 46, -116, 0.9);
        top = -132;
        break;
      }
      case 1: {
        wallFill(c, -46, -112, 92, 112, stone);
        courses(c, -46, -112, 92, 112, shade(stone, -0.35), 10, 15);
        c.fillStyle = shade(stone, -0.05);
        for (let i = 0; i < 6; i++) c.fillRect(-46 + i * 16.4, -122, 10, 10);
        wallFill(c, -dir * 34 - 10, -146, 20, 34, shade(stone, -0.08));
        c.fillStyle = '#5a2f22'; poly(c, [[-dir * 34 - 13, -146], [-dir * 34, -168], [-dir * 34 + 13, -146]]);
        c.fillStyle = '#1e1610';
        for (const x of [-26, 0, 26]) { c.fillRect(x - 1.5, -92, 3, 12); c.fillRect(x - 4, -87, 8, 2); }
        c.fillStyle = '#20170f';
        c.beginPath(); c.moveTo(-15, 0); c.lineTo(-15, -30); c.arc(0, -30, 15, Math.PI, 0); c.lineTo(15, 0); c.fill();
        c.strokeStyle = '#5a5a5a'; c.lineWidth = 1.2;
        for (let x = -12; x <= 12; x += 4) line(c, x, -40, x, -4);
        for (let y = -36; y < 0; y += 6) line(c, -14, y, 14, y);
        banner(c, -32, -108, 34, team, 0); banner(c, 32, -108, 34, team, 1);
        c.fillStyle = '#3a2a1a'; c.fillRect(dir * 22 - 1, -40, 2, 10);
        flame(c, dir * 22, -40, 0.8);
        top = -168;
        break;
      }
      case 2: {
        for (let i = 0; i < 6; i++) {
          const w = 108 - i * 15;
          wallFill(c, -w / 2, -(i + 1) * 18, w, 18, i % 2 ? stone : shade(stone, 0.06));
          c.fillStyle = shade(stone, -0.25); c.fillRect(-w / 2, -(i + 1) * 18 + 16, w, 2);
          c.fillStyle = '#2f8a7c';
          for (let k = -w / 2 + 4; k < w / 2 - 4; k += 8) c.fillRect(k, -(i + 1) * 18 + 6, 3, 3);
        }
        wallFill(c, -9, -108, 18, 108, shade(stone, 0.1));
        c.strokeStyle = shade(stone, -0.2); c.lineWidth = 0.6;
        for (let y = -104; y < 0; y += 4) line(c, -9, y, 9, y);
        wallFill(c, -18, -134, 36, 26, '#a8322a');
        c.fillStyle = '#20170f'; rr(c, -6, -126, 12, 18, 2);
        c.fillStyle = '#c9a23a'; c.fillRect(-18, -134, 36, 3);
        c.fillStyle = '#6b5a2a'; poly(c, [[-22, -134], [0, -150], [22, -134]]);
        banner(c, -36, -56, 26, team, 0); banner(c, 36, -56, 26, team, 1);
        c.fillStyle = '#4a3a22'; c.fillRect(-25, -112, 6, 4); c.fillRect(19, -112, 6, 4);
        flame(c, -22, -112, 0.9); flame(c, 22, -112, 0.9);
        top = -150;
        break;
      }
      case 3: {
        c.save();
        c.beginPath(); c.moveTo(-54, 0); c.lineTo(-46, -104); c.lineTo(46, -104); c.lineTo(54, 0); c.closePath();
        c.clip();
        wallFill(c, -54, -104, 108, 104, stone);
        courses(c, -54, -104, 108, 104, shade(stone, -0.35), 7, 12);
        c.restore();
        c.fillStyle = shade(stone, 0.1); c.fillRect(-48, -110, 96, 6);
        c.fillStyle = shade(stone, -0.05);
        for (let i = 0; i < 5; i++) c.fillRect(-46 + i * 20, -118, 12, 8);
        c.fillStyle = '#1e1610'; c.beginPath(); c.arc(dir * 28, -62, 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2a2a2a'; c.fillRect(dir > 0 ? dir * 28 : dir * 28 - 12, -64, 12, 4);
        c.fillStyle = '#3a2a1a'; rr(c, -12, -32, 24, 32, 2);
        c.strokeStyle = '#2a1e12'; c.lineWidth = 1; for (let x = -8; x <= 8; x += 4) line(c, x, -30, x, 0);
        banner(c, -dir * 30, -100, 30, team, 0);
        c.fillStyle = '#2a2016'; c.fillRect(dir * 16 - 2, -46, 4, 6);
        flame(c, dir * 16, -46, 0.6);
        top = -118;
        break;
      }
      case 4: {
        wallFill(c, -48, -104, 96, 104, stone);
        c.fillStyle = 'rgba(40,50,40,.35)';
        for (let i = 0; i < 6; i++) ell(c, -30 + hash(i) * 60, -90 + hash(i + 4) * 80, 10, 5, hash(i + 2));
        c.fillStyle = shade(stone, -0.2); c.fillRect(-48, -66, 96, 3); c.fillRect(-48, -34, 96, 3);
        c.fillStyle = '#0d1116'; c.fillRect(-32, -90, 64, 9);
        c.fillStyle = 'rgba(255,220,140,.55)'; c.fillRect(-30, -88, 60, 2);
        onEmit(c, (e) => { e.fillStyle = `rgba(255,210,130,${0.15 + 0.6 * LIGHT.nightK})`; e.fillRect(-30, -88, 60, 2); });
        c.fillStyle = '#14191f'; rr(c, -13, -28, 26, 28, 2);
        c.fillStyle = '#8f8a6a';
        for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) ell(c, -42 + i * 16 + r * 8 + dir * 8, -4 - r * 7, 9, 4.5);
        c.save(); c.translate(-dir * 24, -104);
        c.fillStyle = '#4a5058'; c.fillRect(-1.5, -14, 3, 14);
        c.rotate(Math.sin(S.t * 0.7) * 0.6);
        c.strokeStyle = '#9aa3ab'; c.lineWidth = 2; c.beginPath(); c.arc(0, -14, 9, Math.PI * 0.15, Math.PI * 0.85, true); c.stroke();
        c.restore();
        c.strokeStyle = '#3a3f46'; c.lineWidth = 1.5; line(c, dir * 30, -104, dir * 30, -146);
        if (Math.sin(S.t * 4) > 0) onEmit(c, (e) => { e.fillStyle = 'rgba(255,60,60,.95)'; circle(e, dir * 30, -147, 2.2); });
        banner(c, -dir * 6, -100, 26, team, 0);
        // Floodlight
        const lx = dir * 40, ly = -98;
        onEmit(c, (e) => {
          const g = e.createLinearGradient(lx, ly, lx + dir * 180, 0);
          const a = 0.06 + 0.3 * LIGHT.nightK;
          g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(1, 'rgba(255,240,200,0)');
          e.fillStyle = g;
          poly(e, [[lx, ly - 2], [lx + dir * 220, -6], [lx + dir * 150, 4], [lx, ly + 3]]);
        });
        c.fillStyle = '#e8e4cc'; c.fillRect(lx - 3, ly - 3, 6, 5);
        top = -147;
        break;
      }
    }
    if (era === 5) {
      // Hive spire: an organic tower with a glowing core under a shield dome.
      const g2 = c.createLinearGradient(-40, 0, 40, 0);
      g2.addColorStop(0, '#5a4a7a'); g2.addColorStop(0.6, '#3a2a5a'); g2.addColorStop(1, '#22183a');
      c.fillStyle = g2;
      c.beginPath(); c.moveTo(-50, 0); c.quadraticCurveTo(-46, -70, -16, -100); c.quadraticCurveTo(0, -150, 4, -150); c.quadraticCurveTo(10, -150, 18, -100); c.quadraticCurveTo(46, -70, 50, 0); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(200,160,255,.35)'; c.lineWidth = 1;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-40 + i * 4, 0); c.quadraticCurveTo(-30 + i * 6, -60, 2, -140 + i * 8); c.stroke(); }
      c.fillStyle = '#14101e'; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(0, -46, 14, 0); c.fill();
      const pulse = 0.6 + 0.3 * Math.sin(S.t * 3);
      onEmit(c, (e) => {
        const cg = e.createRadialGradient(2, -84, 0, 2, -84, 26);
        cg.addColorStop(0, `rgba(120,255,230,${pulse})`); cg.addColorStop(1, 'rgba(120,255,230,0)');
        e.fillStyle = cg; circle(e, 2, -84, 26);
        e.strokeStyle = `rgba(150,200,255,${0.18 + 0.08 * Math.sin(S.t * 2)})`; e.lineWidth = 1.5;
        e.beginPath(); e.ellipse(0, -10, 70, 150, 0, Math.PI, 0); e.stroke();
        for (let i = 0; i < 6; i++) { e.fillStyle = 'rgba(255,120,220,.8)'; circle(e, -30 + i * 12, -30 - Math.sin(i) * 20, 1.6); }
      });
      c.fillStyle = TEAM_COL[sd.team]; c.fillRect(-20, -46, 40, 3);
      top = -150;
    }
    // Damage: cracks grow as the stronghold weakens.
    const hpk = b.hp / b.maxHp;
    if (hpk < 0.7) {
      c.strokeStyle = 'rgba(20,12,6,.7)'; c.lineWidth = 1;
      const n = hpk < 0.35 ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const x = -34 + hash(i + era * 9) * 68, y = -90 + hash(i + 3) * 70;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y + 7); c.lineTo(x + 2, y + 13); c.lineTo(x + 8, y + 20); c.stroke();
      }
    }
    // Turret ledges
    for (let i = 0; i < b.slots; i++) {
      const p = turretPos(sd.team, i);
      c.fillStyle = '#2e241a';
      c.fillRect(p.x - b.x - 13, p.y - GROUND + 5, 26, 5);
      c.fillStyle = '#4a3a2a';
      c.fillRect(p.x - b.x - 13, p.y - GROUND + 5, 26, 1.5);
    }
    // Flag
    const fx = -dir * 18;
    c.strokeStyle = '#2a2016'; c.lineWidth = 2;
    line(c, fx, top, fx, top - 28);
    const wave = Math.sin(S.t * 4) * 3;
    c.fillStyle = team;
    c.beginPath(); c.moveTo(fx, top - 28);
    c.quadraticCurveTo(fx + dir * 12, top - 31 + wave, fx + dir * 24, top - 25 + wave);
    c.lineTo(fx + dir * 22, top - 18 + wave * 0.5);
    c.quadraticCurveTo(fx + dir * 10, top - 20 - wave * 0.5, fx, top - 17);
    c.closePath(); c.fill();
    c.restore();
    b.top = GROUND + top;

    for (let i = 0; i < MAX_SLOTS; i++) if (b.turrets[i]) drawTurret(sd.team, i, b.turrets[i]);
  }

  function drawTurret(team, i, t) {
    const c = ctx;
    const p = turretPos(team, i);
    const dir = DIR[team];
    const art = t.def.art;
    const metal = '#2a2c30', wood = '#6a4a2a';
    c.save();
    c.translate(p.x, p.y);
    c.scale(dir, 1);
    c.fillStyle = '#3a2e22'; rr(c, -11, -3, 22, 7, 2);
    c.fillStyle = '#5a4632'; c.fillRect(-11, -3, 22, 1.5);
    // Level pips on the mount
    c.fillStyle = '#d9b45a';
    for (let k = 0; k < t.level; k++) c.fillRect(-9 + k * 4, 1.5, 3, 1.5);
    if (art === 'archers') {
      // A fighting platform with its crew
      c.fillStyle = wood; c.fillRect(-11, -10, 22, 7);
      c.fillStyle = '#4a321e'; for (let k = -10; k < 11; k += 4) c.fillRect(k, -12, 2, 3);
      const crew = t.def.n ? 3 : 2;
      for (let k = 0; k < crew; k++) {
        const x = -6 + k * 6;
        c.fillStyle = '#c99067'; circle(c, x, -15, 2.2);
        c.fillStyle = TEAM_COL[team]; c.fillRect(x - 1.8, -13, 3.6, 3);
        c.strokeStyle = '#5a3a20'; c.lineWidth = 0.9;
        c.beginPath(); c.arc(x + 3, -14, 3.6, -1.2 + t.angle * 0.3, 1.2 + t.angle * 0.3); c.stroke();
      }
    } else {
      c.rotate(Math.max(-0.6, Math.min(1.1, t.angle)));
      switch (art) {
        case 'catapult': {
          c.fillStyle = wood; c.fillRect(-11, -7, 22, 5);
          const arm = Math.max(0, Math.min(1, t.cd / t.def.cd));
          c.save(); c.translate(-4, -5); c.rotate(-0.4 - arm * 1.1);
          c.fillStyle = '#8a6a3a'; c.fillRect(0, -1.2, 18, 2.4);
          c.fillStyle = t.def.proj === 'nest' ? '#9a8a5a' : '#7a7a74'; circle(c, 18, 0, 3.2);
          c.restore();
          break;
        }
        case 'cannon': {
          c.fillStyle = wood; circle(c, -3, 3, 4.5);
          c.fillStyle = '#5a3a20'; circle(c, -3, 3, 1.5);
          const g = c.createLinearGradient(0, -6, 0, 2);
          g.addColorStop(0, '#5a5c60'); g.addColorStop(1, '#1e2024');
          c.fillStyle = g; rr(c, -6, -6, t.def.id === 'mortar' ? 14 : 24, 7, 3);
          break;
        }
        case 'gun':
          c.fillStyle = metal; c.fillRect(-6, -5, 9, 7);
          for (let k = 0; k < (t.def.n || 1); k++) { c.fillStyle = metal; c.fillRect(2, -3.5 - k * 2.4 + (t.def.n ? 3 : 0), 20, 2.2); }
          c.fillStyle = '#4a4c50'; c.fillRect(2, -3.5, 20, 0.8);
          break;
        case 'rifle':
          c.fillStyle = '#8f8a6a'; for (let k = 0; k < 3; k++) ell(c, -6 + k * 6, 0, 4, 2.6);
          c.fillStyle = wood; c.fillRect(-4, -5, 10, 3);
          c.fillStyle = metal; c.fillRect(4, -4.6, 22, 1.8);
          c.fillStyle = '#111'; c.fillRect(2, -7.6, 7, 2);
          break;
        case 'rpg':
          c.fillStyle = '#8f8a6a'; for (let k = 0; k < 3; k++) ell(c, -6 + k * 6, 0, 4, 2.6);
          c.fillStyle = '#4a5a3a'; rr(c, -6, -7, 26, 4.6, 2);
          c.fillStyle = '#3a3a2a'; poly(c, [[20, -9], [27, -4.7], [20, -0.4]]);
          break;
        case 'rack':
          c.fillStyle = wood; c.fillRect(-10, -4, 14, 4);
          c.fillStyle = '#4a321e'; rr(c, -4, -14, 18, 11, 1.5);
          c.fillStyle = '#1a1210'; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) circle(c, 14, -12 + r * 3.4, 0.9 + k * 0);
          c.fillStyle = '#a8322a'; c.fillRect(-4, -14, 18, 1.4);
          break;
        case 'plasma': case 'ion': {
          const ion = art === 'ion';
          c.fillStyle = '#2a2236'; ell(c, 0, -3, 8, 5);
          c.fillStyle = '#3a3050'; rr(c, 0, -5, ion ? 26 : 18, 4.4, 2);
          onEmit(c, (e) => { e.fillStyle = ion ? 'rgba(150,190,255,.9)' : 'rgba(120,255,220,.9)'; circle(e, 0, -3, 2.6); e.fillRect(4, -3.6, ion ? 20 : 12, 1.2); });
          break;
        }
        case 'pylon':
          c.fillStyle = '#3a2a5a'; poly(c, [[-5, 0], [0, -22], [5, 0]]);
          onEmit(c, (e) => {
            e.strokeStyle = `rgba(190,140,255,${0.6 + 0.3 * Math.sin(S.t * 5)})`; e.lineWidth = 1;
            for (let k = 0; k < 3; k++) { e.beginPath(); e.ellipse(0, -10 + k * 3, 9 - k, 2.4, S.t * (k + 1), 0, Math.PI * 2); e.stroke(); }
          });
          break;
        case 'spire':
          c.fillStyle = '#4a3a5a'; poly(c, [[-4, 0], [0, -26], [4, 0]]);
          onEmit(c, (e) => {
            const g = e.createRadialGradient(0, -24, 0, 0, -24, 9);
            g.addColorStop(0, 'rgba(255,140,240,.95)'); g.addColorStop(1, 'rgba(255,140,240,0)');
            e.fillStyle = g; circle(e, 0, -24, 9);
          });
          break;
        default: { // ballista
          c.fillStyle = wood; c.fillRect(-5, -3, 22, 3.5);
          c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.8;
          c.beginPath(); c.arc(12, -1.2, 9, -1.3, 1.3); c.stroke();
          c.strokeStyle = '#e8e0cc'; c.lineWidth = 0.5;
          line(c, 12 + Math.cos(1.3) * 9, -1.2 - Math.sin(1.3) * 9, 4, -1.2); line(c, 4, -1.2, 12 + Math.cos(1.3) * 9, -1.2 + Math.sin(1.3) * 9);
          if (t.def.id === 'zhugenu') { c.fillStyle = '#4a321e'; c.fillRect(2, -7, 8, 4); }
        }
      }
      if (t.flashT > 0) onEmit(c, (e) => {
        const g = e.createRadialGradient(24, -1, 0, 24, -1, 12);
        g.addColorStop(0, 'rgba(255,230,160,.95)'); g.addColorStop(1, 'rgba(255,150,60,0)');
        e.fillStyle = g; circle(e, 24, -1, 12);
      });
    }
    c.restore();
    // Overdrive heat and the character bonus star
    if (t.odT > 0) {
      ectx.save(); ectx.globalCompositeOperation = 'lighter';
      const g = ectx.createRadialGradient(p.x, p.y - 4, 0, p.x, p.y - 4, 18);
      g.addColorStop(0, `rgba(255,140,50,${0.45 + 0.2 * Math.sin(S.t * 14)})`); g.addColorStop(1, 'rgba(255,140,50,0)');
      ectx.fillStyle = g; circle(ectx, p.x, p.y - 4, 18);
      ectx.restore();
    }
    if (t.syn) { c.fillStyle = '#f2d27a'; star(c, p.x - dir * 14, p.y - 12, 2.6); }
  }

  // ── Warriors ────────────────────────────────────────────────────────────
  function drawHorse(c, col, walk, teamCol) {
    const dark = shade(col, -0.3), light = shade(col, 0.18);
    const leg = (x0, ph, back) => {
      const th = Math.sin(walk + ph) * 0.5;
      const sh = th - 0.55 * Math.max(0, Math.cos(walk + ph));
      const kx = x0 + Math.sin(th) * 9, ky = -18 + Math.cos(th) * 9;
      const fx = kx + Math.sin(sh) * 9, fy = ky + Math.cos(sh) * 9;
      c.strokeStyle = back ? dark : col; c.lineWidth = 3.2;
      c.beginPath(); c.moveTo(x0, -20); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      c.fillStyle = '#1e1610'; c.fillRect(fx - 1.8, fy - 1.5, 3.6, 2);
    };
    c.lineCap = 'round';
    leg(-11, Math.PI, true); leg(10, 0, true);
    c.strokeStyle = dark; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(-16, -27); c.quadraticCurveTo(-25 + Math.sin(walk) * 2, -22, -22, -10); c.stroke();
    const g = c.createLinearGradient(0, -33, 0, -16);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    c.fillStyle = g;
    ell(c, 0, -24, 17, 8.5);
    poly(c, [[9, -29], [16, -43], [23, -42], [17, -22]]);
    c.fillStyle = col;
    ell(c, 22.5, -41.5, 6.8, 3.6, 0.45);
    c.fillStyle = dark; poly(c, [[17, -46], [18, -50], [20, -46]]);
    c.fillStyle = '#111'; circle(c, 22, -43, 0.8);
    c.strokeStyle = dark; c.lineWidth = 2; line(c, 11, -31, 17, -45);
    c.strokeStyle = '#2a1a10'; c.lineWidth = 0.8; line(c, 27, -40, 14, -32);
    // Saddle cloth in team color
    c.fillStyle = teamCol; rr(c, -9, -33, 15, 9, 2);
    c.fillStyle = '#4a2e1a'; rr(c, -6, -34, 10, 4, 2);
    leg(-8, 0, false); leg(12, Math.PI, false);
  }

  const METAL_HELMS = new Set(['crest', 'gladiator', 'horned', 'kabuto', 'greathelm', 'nasal', 'morion', 'helmet', 'inca', 'ming']);

  function drawHelm(c, L, X, Y) {
    const hc = L.hc;
    switch (L.helm) {
      case 'crest':
        dome(c, hc, X, Y, 6.8, -0.3);
        c.fillStyle = shade(hc, -0.15); c.fillRect(X - 6.5, Y - 1, 3, 7);
        c.fillStyle = L.plume || '#9c1d1d';
        if (L.crossPlume) ell(c, X, Y - 9, 2.6, 5.5);
        else ell(c, X - 1, Y - 8.5, 8.5, 3);
        break;
      case 'gladiator':
        dome(c, hc, X, Y, 6.8, -0.3);
        c.fillStyle = shade(hc, -0.1); ell(c, X, Y - 1, 9.5, 1.8);
        c.strokeStyle = shade(hc, -0.35); c.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) line(c, X + 2 + i * 1.6, Y, X + 2 + i * 1.6, Y + 5);
        break;
      case 'celt':
        c.fillStyle = '#c97a3a'; dome(c, '#c97a3a', X, Y, 6.8, 0);
        c.strokeStyle = '#c97a3a'; c.lineWidth = 1.5;
        for (let i = -2; i <= 2; i++) line(c, X + i * 2.5, Y - 5, X + i * 3.5 - 1, Y - 10);
        c.strokeStyle = hc; c.lineWidth = 1.6; line(c, X - 4, Y + 7, X + 4, Y + 7);
        break;
      case 'tiara':
        c.fillStyle = hc; poly(c, [[X - 6, Y - 2], [X - 4, Y - 13], [X + 4, Y - 13], [X + 6, Y - 2]]);
        c.fillStyle = '#2a1a1a'; ell(c, X + 2, Y + 6, 4, 3);
        break;
      case 'fur':
        c.fillStyle = hc; rr(c, X - 7, Y - 11, 14, 8, 3);
        c.fillStyle = shade(hc, 0.15); c.fillRect(X - 7.5, Y - 5, 15, 3);
        break;
      case 'guan':
        dome(c, '#1a1a1a', X, Y, 6.4, 0.3);
        c.fillStyle = hc; c.fillRect(X - 2, Y - 11, 4, 5);
        c.fillStyle = '#1a1a1a'; ell(c, X + 2, Y + 7, 2, 4);
        break;
      case 'horned':
        dome(c, hc, X, Y, 6.8, -0.25);
        c.strokeStyle = '#efe4cf'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(X - 5, Y - 4); c.quadraticCurveTo(X - 10, Y - 8, X - 8, Y - 13); c.stroke();
        c.beginPath(); c.moveTo(X + 5, Y - 4); c.quadraticCurveTo(X + 10, Y - 8, X + 8, Y - 13); c.stroke();
        break;
      case 'kabuto':
        dome(c, hc, X, Y, 7, -0.2);
        c.fillStyle = shade(hc, 0.1); poly(c, [[X - 9, Y], [X - 6, Y - 3], [X + 6, Y - 3], [X + 9, Y]]);
        c.strokeStyle = L.plume || '#c9a23a'; c.lineWidth = 1.5;
        line(c, X, Y - 6, X - 4, Y - 14); line(c, X, Y - 6, X + 4, Y - 14);
        break;
      case 'greathelm':
        c.fillStyle = hc; rr(c, X - 6.8, Y - 8, 13.6, 15, 2);
        c.fillStyle = '#1a1a1a'; c.fillRect(X - 1, Y - 2, 8, 1.5);
        if (L.plume) { c.fillStyle = L.plume; ell(c, X - 1, Y - 10, 5, 2.5); }
        break;
      case 'hood':
        c.fillStyle = hc; ell(c, X, Y, 7, 7.2);
        c.fillStyle = L.skin; c.fillRect(X + 1, Y - 2, 6, 2.5);
        break;
      case 'bald':
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(X - 1, Y - 6, 1, 1);
        break;
      case 'mongol':
        c.fillStyle = hc; poly(c, [[X - 7, Y - 2], [X, Y - 15], [X + 7, Y - 2]]);
        c.fillStyle = '#5a3a26'; c.fillRect(X - 7.5, Y - 4, 15, 3.5);
        break;
      case 'turban':
        c.fillStyle = hc; ell(c, X, Y - 4, 8, 5.5);
        c.fillStyle = shade(hc, -0.2); ell(c, X, Y - 3, 8, 1.5);
        break;
      case 'ming':
        dome(c, hc, X, Y, 7, -0.2);
        c.fillStyle = L.plume || '#a8322a'; ell(c, X, Y - 9, 2, 3);
        c.fillStyle = shade(hc, 0.2); ell(c, X, Y - 1, 8.5, 1.5);
        break;
      case 'none':
        if (L.shortHair) { dome(c, hc, X, Y, 6.8, 0.1); c.fillRect(X - 6.5, Y - 2, 3, 6); }
        else { dome(c, hc, X, Y, 6.8, 0); c.fillStyle = hc; c.fillRect(X - 7, Y - 2, 4, 9); }
        break;
      case 'nasal':
        c.fillStyle = hc; poly(c, [[X - 7, Y - 1], [X - 1, Y - 13], [X + 7, Y - 1]]);
        c.fillRect(X + 4.5, Y - 1, 1.6, 5);
        break;
      case 'cap':
        c.fillStyle = hc; rr(c, X - 7, Y - 9, 14, 7, 3);
        c.fillStyle = shade(hc, -0.2); c.fillRect(X - 7, Y - 3, 15, 2);
        if (L.star) { c.fillStyle = '#c8312b'; c.fillRect(X + 3, Y - 7, 2.5, 2.5); }
        if (L.plume) { c.fillStyle = L.plume; ell(c, X - 3, Y - 10, 1.5, 4, -0.4); }
        break;
      case 'jaguar':
        c.fillStyle = hc; ell(c, X, Y - 2, 8.5, 8.5);
        c.fillStyle = '#2a1a0a';
        for (let i = 0; i < 5; i++) ell(c, X - 5 + (i * 3.7) % 9, Y - 7 + ((i * 5) % 7), 1, 1);
        c.fillStyle = hc; ell(c, X - 4, Y - 10, 2.2, 3); ell(c, X + 3, Y - 10, 2.2, 3);
        c.fillStyle = '#efe4cf'; poly(c, [[X + 3, Y - 2], [X + 10, Y - 1], [X + 6, Y + 1]]);
        c.fillStyle = L.skin; ell(c, X + 2, Y + 2, 4.5, 4);
        break;
      case 'eagle':
        c.fillStyle = hc; ell(c, X - 1, Y - 3, 8, 7.5);
        c.fillStyle = '#e0b030'; poly(c, [[X + 5, Y - 5], [X + 13, Y - 2], [X + 6, Y]]);
        c.fillStyle = '#1a1a1a'; ell(c, X + 3, Y - 6, 1, 1);
        if (L.feathers) { c.fillStyle = L.feathers; poly(c, [[X - 7, Y - 6], [X - 14, Y - 14], [X - 4, Y - 9]]); }
        c.fillStyle = L.skin; ell(c, X + 2, Y + 2.5, 4.5, 3.6);
        break;
      case 'maya':
      case 'quetzal': {
        c.fillStyle = L.helm === 'quetzal' ? '#e0c46a' : hc;
        c.fillRect(X - 7, Y - 7, 14, 4);
        const fcol = L.feathers || '#2f8a7c';
        const n = L.helm === 'quetzal' ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const a = -2.6 + i * (1.6 / (n - 1));
          c.fillStyle = i % 2 ? fcol : shade(fcol, 0.15);
          ell(c, X - 2 + Math.cos(a) * 9, Y - 7 + Math.sin(a) * 9, 2.2, 7, a + Math.PI / 2);
        }
        break;
      }
      case 'inca':
        dome(c, hc, X, Y, 6.8, -0.1);
        c.fillStyle = '#a8322a'; ell(c, X, Y - 9, 2, 3);
        c.fillStyle = '#1a1a1a'; c.fillRect(X - 6.5, Y - 1, 3, 6);
        break;
      case 'topknot':
        dome(c, hc, X, Y, 6.8, 0.2);
        c.fillStyle = hc; ell(c, X - 1, Y - 9, 3, 2.6);
        break;
      case 'zande':
        c.fillStyle = '#b8a06a'; rr(c, X - 6, Y - 13, 12, 9, 2);
        c.fillStyle = hc; ell(c, X, Y - 14, 2, 3);
        break;
      case 'headband':
        dome(c, '#1a1a1a', X, Y, 6.8, 0);
        c.fillStyle = hc; c.fillRect(X - 7, Y - 4, 14, 2.5);
        break;
      case 'feather':
        dome(c, '#1a1a1a', X, Y, 6.8, 0);
        c.fillStyle = hc; ell(c, X - 3, Y - 10, 1.6, 5.5, -0.3);
        c.fillStyle = '#1a1a1a'; ell(c, X - 4.2, Y - 14, 1, 1.6, -0.3);
        break;
      case 'zulu':
        c.fillStyle = '#1a1a1a'; dome(c, '#1a1a1a', X, Y, 6.8, 0.1);
        c.fillStyle = '#c9a26a'; c.fillRect(X - 7, Y - 4, 14, 2.5);
        c.fillStyle = '#2a2a2a'; ell(c, X - 2, Y - 10, 1.8, 5, -0.2);
        break;
      case 'tricorn':
        c.fillStyle = hc; poly(c, [[X - 10, Y - 3], [X, Y - 11], [X + 10, Y - 3], [X, Y - 5]]);
        break;
      case 'cavalier':
        c.fillStyle = hc; ell(c, X, Y - 5, 11, 2.4); dome(c, hc, X, Y - 5, 5, 0);
        if (L.plume) { c.fillStyle = L.plume; ell(c, X - 6, Y - 9, 5, 2, -0.5); }
        break;
      case 'morion':
        c.fillStyle = hc; ell(c, X, Y - 4, 10, 2.2); dome(c, hc, X, Y - 4, 5.5, 0);
        c.fillRect(X - 1, Y - 13, 2, 4);
        if (L.plume) { c.fillStyle = L.plume; ell(c, X - 3, Y - 13, 3, 1.5, -0.3); }
        break;
      case 'streltsy':
        c.fillStyle = hc; rr(c, X - 6, Y - 14, 12, 12, 4);
        c.fillStyle = L.fur || '#5a3a26'; c.fillRect(X - 7, Y - 5, 14, 3.5);
        break;
      case 'bearskin':
        c.fillStyle = hc; rr(c, X - 7, Y - 20, 14, 19, 6);
        if (L.plume) { c.fillStyle = L.plume; ell(c, X - 6, Y - 14, 1.5, 4); }
        break;
      case 'tsar':
        c.fillStyle = hc; dome(c, hc, X, Y - 3, 6, 0);
        c.fillStyle = L.fur || '#f0e6d0'; c.fillRect(X - 7, Y - 5, 14, 3.5);
        c.strokeStyle = hc; c.lineWidth = 1.2; line(c, X, Y - 9, X, Y - 15); line(c, X - 2, Y - 13, X + 2, Y - 13);
        break;
      case 'bicorne':
        c.fillStyle = hc; ell(c, X - 1, Y - 6, 11, 4.5);
        c.fillStyle = '#c8312b'; c.fillRect(X - 1, Y - 9, 2, 2);
        break;
      case 'cowboy':
        c.fillStyle = hc; ell(c, X, Y - 4, 11, 2.2); rr(c, X - 5, Y - 11, 10, 7, 2);
        break;
      case 'beret':
        c.fillStyle = hc; ell(c, X - 1, Y - 5, 8, 3.4, -0.15);
        c.fillStyle = '#c9a23a'; c.fillRect(X - 5, Y - 6, 2, 2);
        break;
      case 'balaclava':
        c.fillStyle = hc; ell(c, X, Y, 7, 7.2);
        c.fillStyle = L.skin; c.fillRect(X + 1, Y - 2.5, 6, 3);
        break;
      case 'boonie':
        c.fillStyle = hc; ell(c, X, Y - 4, 10, 2.2); dome(c, hc, X, Y - 4, 5.5, 0);
        break;
      case 'helmet':
        dome(c, hc, X, Y + 0.5, 7.4, -0.15);
        c.fillStyle = shade(hc, -0.2); c.fillRect(X - 7.5, Y - 0.5, 15, 1.5);
        break;
      case 'slouch':
        c.fillStyle = hc; ell(c, X, Y - 4, 11, 2.4); rr(c, X - 5, Y - 10, 10, 6, 3);
        c.fillStyle = shade(hc, -0.2); c.fillRect(X - 5, Y - 6, 10, 1.5);
        c.fillStyle = hc; ell(c, X - 7, Y - 7, 3, 4);
        break;
      case 'kepi':
        c.fillStyle = hc; rr(c, X - 5.5, Y - 12, 11, 9, 2);
        c.fillStyle = '#1a1a1a'; poly(c, [[X + 2, Y - 3], [X + 10, Y - 3], [X + 4, Y - 1]]);
        break;
      case 'conical':
        c.fillStyle = hc; poly(c, [[X - 12, Y - 3], [X, Y - 13], [X + 12, Y - 3]]);
        break;
      case 'fedora':
        c.fillStyle = hc; ell(c, X, Y - 4, 10, 2); rr(c, X - 5.5, Y - 11, 11, 7, 2);
        c.fillStyle = '#1a1a1a'; c.fillRect(X - 5.5, Y - 6, 11, 1.6);
        break;
      case 'slick':
        dome(c, hc, X, Y, 6.8, 0.15);
        break;
      case 'sombrero':
        c.fillStyle = hc; ell(c, X, Y - 4, 15, 2.6); poly(c, [[X - 5, Y - 4], [X - 3, Y - 14], [X + 3, Y - 14], [X + 5, Y - 4]]);
        break;
      case 'keffiyeh':
        c.fillStyle = hc; ell(c, X - 1, Y - 1, 7.6, 8);
        poly(c, [[X - 7, Y], [X - 9, Y + 12], [X - 2, Y + 6]]);
        c.fillStyle = L.skin; ell(c, X + 3, Y + 1, 3.8, 4.5);
        c.fillStyle = L.agal || '#2a2a2a'; c.fillRect(X - 7, Y - 6, 13, 2);
        break;
    }
  }

  // Draws one warrior facing right, feet at the origin.
  // ── Alien bodies ────────────────────────────────────────────────────────
  // Facing right, feet at the origin, like drawFigure. Glows go on the
  // emissive layer when drawing in the world, inline in portraits.
  function glowAt(c, x, y, r, col, a = 0.8) {
    const draw = (e) => {
      const g = e.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
      e.fillStyle = g; circle(e, x, y, r);
    };
    if (c === ctx) onEmit(c, draw);
    else { c.save(); c.globalCompositeOperation = 'lighter'; draw(c); c.restore(); }
  }
  function alienLeg(c, x0, y0, ph, len, col, w = 3) {
    const th = Math.sin(ph) * 0.5;
    const kx = x0 + Math.sin(th) * len, ky = y0 + Math.cos(th) * len;
    const fx = kx - Math.sin(th - 0.9) * len * 0.9, fy = ky + Math.cos(th - 0.9) * len * 0.9;
    c.strokeStyle = col; c.lineWidth = w;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(kx, ky); c.lineTo(fx, Math.min(0, fy)); c.stroke();
  }
  function alienWeapon(c, k, hx, hy, th, sw, glow) {
    c.save(); c.translate(hx, hy);
    if (k === 'rifle' || k === 'pistol' || k === 'throw' || k === 'bow') {
      c.rotate(-0.06);
      const len = k === 'rifle' ? 18 : 11;
      c.fillStyle = '#20242c'; rr(c, -6, -2.2, len + 6, 4.4, 2);
      c.fillStyle = glow; c.fillRect(-2, -0.8, len - 2, 1.6);
      if (sw > 0.6) glowAt(c, len + 2, 0, 7, glow, 0.9);
    } else if (k === 'sword' || k === 'knife' || k === 'spear') {
      c.rotate(th - 1.25);
      const len = k === 'spear' ? 28 : k === 'sword' ? 20 : 11;
      c.strokeStyle = '#20242c'; c.lineWidth = 2; line(c, -3, 0, 3, 0);
      c.strokeStyle = glow; c.lineWidth = 2.2; line(c, 3, 0, len, 0);
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.7; line(c, 4, 0, len - 1, 0);
      glowAt(c, len * 0.6, 0, 7, glow, 0.35);
    } else {
      glowAt(c, 2, 0, 5 + sw * 4, glow, 0.6);
    }
    c.restore();
  }
  function drawAlien(c, def, o) {
    const L = def.look;
    const walk = o.walk || 0, sw = o.swing || 0;
    const glow = L.glow || '#6ff2c8';
    const Lt = o.light || PORTRAIT_LIGHT;
    const lunge = sw > 0 ? Math.sin((1 - sw) * Math.PI) * 3 : 0;
    const w = o.weapon, k = w ? w.kind || 'sword' : 'sword';
    const body = L.body, skin = L.skin, dark = shade(body, -0.35);
    const shadeG = (x0, y0, x1, y1, col) => { const g = c.createLinearGradient(x0 + Lt.lx * 5, y0 + Lt.ly * 5, x1, y1); g.addColorStop(0, shade(col, 0.22)); g.addColorStop(1, shade(col, -0.3)); return g; };
    c.save();
    c.translate(lunge, 0);
    c.lineCap = 'round'; c.lineJoin = 'round';
    let th = k === 'rifle' || k === 'pistol' || k === 'throw' ? -0.08 : sw > 0 ? -1.6 + (1 - sw) * 2.6 : 0.9;
    switch (L.alien) {
      case 'grey': case 'trooper': case 'stalker': {
        const tall = L.alien === 'stalker' ? 1.15 : 1;
        // Digitigrade legs for the stalker, plain for the others
        const legY = -18 * tall;
        for (const [ph, back] of [[walk + Math.PI, true], [walk, false]]) {
          if (L.alien === 'stalker') alienLeg(c, 0, legY, ph, 10, back ? dark : body, 3);
          else {
            const t2 = Math.sin(ph) * 0.5;
            c.strokeStyle = back ? dark : body; c.lineWidth = L.alien === 'grey' ? 2.4 : 4;
            line(c, 0, legY, Math.sin(t2) * 9, -1);
          }
        }
        if (L.alien === 'stalker') {
          // Phase cloak shimmer
          c.fillStyle = rgba('#3a3a6a', 0.55 + 0.2 * Math.sin(S_t() * 3));
          poly(c, [[-4, -42 * tall], [-14 + Math.sin(walk) * 2, -10], [4, -12], [4, -40 * tall]]);
        }
        c.fillStyle = shadeG(-6, -38 * tall, 6, -18 * tall, body);
        rr(c, L.alien === 'grey' ? -4 : -6.5, -37 * tall, L.alien === 'grey' ? 8 : 13, 19 * tall, 3);
        if (L.alien === 'trooper') {
          c.fillStyle = '#20242c'; rr(c, -9, -36, 5, 14, 2);
          glowAt(c, -6.5, -30, 6, glow, 0.5);
          c.fillStyle = shade(body, 0.25); ell(c, 2, -35, 5, 3);
        }
        c.fillStyle = o.teamCol; c.fillRect(-5, -21 * tall, 10, 2.4);
        // Head
        if (L.alien === 'grey') {
          c.fillStyle = shadeG(-6, -56, 6, -40, skin); ell(c, 2, -47, 8, 9.5);
          c.fillStyle = '#05070a'; ell(c, 6, -47, 3, 4.6, 0.5);
          c.fillStyle = 'rgba(255,255,255,.6)'; circle(c, 6.5, -48.5, 0.8);
          c.fillStyle = shade(skin, -0.2); c.fillRect(-0.5, -38.5, 3, 2);
        } else if (L.alien === 'trooper') {
          c.fillStyle = shadeG(-6, -50, 6, -36, '#3a4a5e'); ell(c, 1.5, -43, 7, 7.5);
          c.fillStyle = glow; rr(c, 2.5, -46, 6.5, 3, 1.5);
          glowAt(c, 6, -44.5, 7, glow, 0.6);
        } else {
          c.fillStyle = shadeG(-6, -60, 6, -44, skin); ell(c, 2, -51, 5, 7, 0.3);
          c.fillStyle = glow; ell(c, 5, -52, 1.6, 0.9); glowAt(c, 5, -52, 5, glow, 0.7);
        }
        const shy = -33 * tall;
        const hx = Math.cos(th) * 10, hy = shy + Math.sin(th) * 10;
        c.strokeStyle = L.alien === 'grey' ? skin : body; c.lineWidth = L.alien === 'grey' ? 2 : 3.2;
        line(c, 0, shy, hx, hy);
        alienWeapon(c, k, hx, hy, th, sw, glow);
        break;
      }
      case 'drone': case 'queen': {
        const big = L.alien === 'queen' ? 1.45 : 1;
        c.scale(big, big);
        // Six legs
        for (let i = 0; i < 3; i++) alienLeg(c, -6 + i * 6, -14, walk + i * 2.1, 7, dark, 2);
        for (let i = 0; i < 3; i++) alienLeg(c, -4 + i * 6, -14, walk + i * 2.1 + Math.PI, 7, body, 2);
        // Abdomen, thorax, head
        c.fillStyle = shadeG(-22, -26, -6, -10, body); ell(c, -12, -18, 11, 7, -0.2);
        if (L.alien === 'queen') { glowAt(c, -14, -18, 12, glow, 0.6); c.fillStyle = rgba(glow, 0.5); for (let i = 0; i < 4; i++) circle(c, -18 + i * 3, -16, 1.4); }
        c.fillStyle = shadeG(-6, -26, 8, -12, body); ell(c, 2, -20, 8, 6);
        c.fillStyle = o.teamCol; c.fillRect(-3, -16, 8, 2);
        c.fillStyle = shadeG(6, -32, 16, -20, skin); ell(c, 12, -26, 6, 4.6, 0.3);
        c.fillStyle = glow; circle(c, 14, -27.5, 1.3); glowAt(c, 14, -27.5, 4, glow, 0.8);
        c.strokeStyle = dark; c.lineWidth = 1.2;
        const m = sw > 0 ? 0.6 : 0.2;
        line(c, 16, -24, 21, -24 + m * 4); line(c, 16, -23, 20, -20 - m * 2);
        if (L.alien === 'queen') { c.fillStyle = shade(skin, 0.2); poly(c, [[8, -30], [10, -40], [13, -31], [16, -39], [17, -29]]); }
        // Wings and claws
        c.fillStyle = 'rgba(220,255,200,.25)';
        const flap = Math.sin(S_t() * 40) * 3;
        ell(c, -2, -30 - flap, 10, 3, -0.6); ell(c, -6, -28 + flap, 9, 2.6, -0.4);
        c.strokeStyle = shade(skin, 0.2); c.lineWidth = 1.8;
        const cl = sw > 0 ? -0.8 + (1 - sw) * 1.6 : 0.3;
        c.beginPath(); c.moveTo(8, -20); c.lineTo(16, -24 + cl * 6); c.lineTo(22, -18 + cl * 8); c.stroke();
        if (k === 'throw') glowAt(c, 20, -24, 4 + sw * 4, glow, 0.6);
        break;
      }
      case 'brute': {
        for (const [ph, back] of [[walk + Math.PI, true], [walk, false]]) {
          const t2 = Math.sin(ph) * 0.4;
          c.strokeStyle = back ? dark : body; c.lineWidth = 6;
          line(c, 0, -18, Math.sin(t2) * 8, -1);
        }
        c.fillStyle = shadeG(-10, -44, 10, -16, body);
        c.beginPath(); c.moveTo(-10, -18); c.quadraticCurveTo(-14, -44, 2, -46); c.quadraticCurveTo(14, -44, 10, -18); c.closePath(); c.fill();
        c.strokeStyle = glow; c.lineWidth = 0.9;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, -30 + i * 5, 7, 0.4, Math.PI - 0.4); c.stroke(); }
        glowAt(c, 0, -28, 9, glow, 0.35);
        c.fillStyle = shade(body, 0.3); for (let i = 0; i < 4; i++) poly(c, [[-8 + i * 4, -44], [-6 + i * 4, -52], [-4 + i * 4, -44]]);
        c.fillStyle = o.teamCol; c.fillRect(-9, -21, 18, 3);
        c.fillStyle = shadeG(4, -48, 12, -38, skin); ell(c, 8, -42, 5, 4);
        c.fillStyle = glow; circle(c, 10.5, -43, 1.1); glowAt(c, 10.5, -43, 4, glow, 0.8);
        const hx = Math.cos(th) * 12, hy = -36 + Math.sin(th) * 12;
        c.strokeStyle = body; c.lineWidth = 5; line(c, 2, -36, hx, hy);
        c.fillStyle = shade(body, -0.1); circle(c, hx, hy, 3.4);
        if (k === 'club' && w && /hammer/i.test(w.name)) {
          c.save(); c.translate(hx, hy); c.rotate(th - 1.25);
          c.strokeStyle = '#20242c'; c.lineWidth = 2.4; line(c, -2, 0, 18, 0);
          c.fillStyle = '#2a2e36'; rr(c, 14, -6, 9, 12, 2);
          c.restore();
          glowAt(c, hx + Math.cos(th - 1.25) * 18, hy + Math.sin(th - 1.25) * 18, 10, glow, 0.5);
        } else if (k === 'throw') glowAt(c, hx + 3, hy, 6, glow, 0.6);
        break;
      }
      case 'spore': {
        for (const [ph, back] of [[walk + Math.PI, true], [walk, false]]) alienLeg(c, 0, -14, ph, 8, back ? dark : body, 3.5);
        c.fillStyle = shadeG(-12, -46, 10, -12, body); ell(c, 0, -28, 11, 15);
        c.fillStyle = shade(skin, 0.15);
        for (let i = 0; i < 6; i++) { const a = i * 1.05; ell(c, Math.cos(a) * 8, -28 + Math.sin(a) * 11, 2.6, 2.6); }
        for (let i = 0; i < 6; i++) { const a = i * 1.05; glowAt(c, Math.cos(a) * 8, -28 + Math.sin(a) * 11, 4.5, glow, 0.5 + 0.3 * Math.sin(S_t() * 3 + i)); }
        c.fillStyle = shade(body, 0.1); ell(c, 2, -45, 9, 5);
        c.fillStyle = o.teamCol; c.fillRect(-8, -16, 16, 2.4);
        c.strokeStyle = shade(body, 0.2); c.lineWidth = 2;
        const tl = sw > 0 ? (1 - sw) * 10 : Math.sin(walk) * 2;
        c.beginPath(); c.moveTo(8, -30); c.quadraticCurveTo(16, -34 + tl, 22, -26 + tl); c.stroke();
        break;
      }
      case 'overmind': {
        const hover = Math.sin(S_t() * 2) * 2.5;
        c.translate(0, hover - 6);
        glowAt(c, 0, -30, 26, glow, 0.25);
        c.fillStyle = shadeG(-8, -36, 8, -2, body);
        poly(c, [[-7, -32], [7, -32], [11, -4 + Math.sin(walk) * 1.5], [-11, -4 - Math.sin(walk) * 1.5]]);
        c.fillStyle = shade('#d9b45a', 0); c.fillRect(-7, -32, 14, 2);
        c.fillStyle = o.teamCol; c.fillRect(-8, -20, 16, 2.4);
        c.fillStyle = shadeG(-12, -56, 10, -34, skin); ell(c, 0, -44, 12, 11);
        c.strokeStyle = shade(skin, -0.25); c.lineWidth = 0.8;
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 3.5, -48, 3, 0.2, Math.PI - 0.2); c.stroke(); }
        c.fillStyle = glow; ell(c, 7, -40, 2, 1.2); glowAt(c, 7, -40, 5, glow, 0.9);
        c.strokeStyle = rgba(glow, 0.8); c.lineWidth = 1.2;
        c.beginPath(); c.ellipse(0, -58, 12, 3, 0, 0, Math.PI * 2); c.stroke();
        glowAt(c, 0, -58, 12, glow, 0.35);
        if (sw > 0) glowAt(c, 14 + (1 - sw) * 8, -36, 9, glow, 0.8);
        break;
      }
    }
    if (o.shield) glowAt(c, 2, -26, 20, glow, 0.25);
    c.restore();
  }

  let CUR_LT = PORTRAIT_LIGHT;

  // ── Uniform rendering ───────────────────────────────────────────────────
  // Cloth and armor patterns, drawn inside the current clip.
  function drawPattern(c, kind, pc, x0, y0, w, h, seed = 0) {
    const p0 = pc && pc[0] ? pc[0] : '#000000', p1 = pc && pc[1] ? pc[1] : p0, p2 = pc && pc[2] ? pc[2] : p1;
    const x1 = x0 + w, y1 = y0 + h;
    switch (kind) {
      case 'mail':
        c.strokeStyle = rgba(p0, 0.6); c.lineWidth = 0.35;
        for (let y = y0, r = 0; y < y1; y += 1.5, r++) for (let x = x0 + (r % 2) * 0.75; x < x1; x += 1.5) { c.beginPath(); c.arc(x, y, 0.6, 0, Math.PI * 2); c.stroke(); }
        break;
      case 'lamellar':
        for (let y = y0, r = 0; y < y1; y += 2.6, r++) for (let x = x0 + (r % 2); x < x1; x += 2.1) {
          c.fillStyle = rgba(p0, 0.85); c.fillRect(x, y, 1.7, 2.2);
          c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x, y, 1.7, 0.5);
        }
        break;
      case 'lacing':
        for (let y = y0 + 1; y < y1; y += 2.4) {
          c.strokeStyle = p0; c.lineWidth = 0.9; line(c, x0, y, x1, y);
          c.strokeStyle = shade(p0, -0.35); c.lineWidth = 0.4;
          for (let x = x0 + 0.6; x < x1; x += 1.6) line(c, x, y - 0.6, x, y + 0.6);
        }
        break;
      case 'tartan':
        c.fillStyle = rgba(p0, 0.38);
        for (let x = x0; x < x1; x += 4) c.fillRect(x, y0, 1.4, h);
        for (let y = y0; y < y1; y += 4) c.fillRect(x0, y, w, 1.4);
        c.fillStyle = rgba(p1, 0.7);
        for (let x = x0 + 2.4; x < x1; x += 4) c.fillRect(x, y0, 0.4, h);
        for (let y = y0 + 2.4; y < y1; y += 4) c.fillRect(x0, y, w, 0.4);
        break;
      case 'checker':
        c.fillStyle = p0;
        for (let y = y0, r = 0; y < y1; y += 2.6, r++) for (let x = x0 + (r % 2) * 2.6; x < x1; x += 5.2) c.fillRect(x, y, 2.6, 2.6);
        break;
      case 'tocapu':
        for (let y = y0, r = 0; y < y1; y += 3.2, r++) for (let x = x0, i = 0; x < x1; x += 3.2, i++) {
          const col = [p0, p1, p2][(r + i) % 3];
          c.fillStyle = col; c.fillRect(x + 0.3, y + 0.3, 2.6, 2.6);
          c.fillStyle = 'rgba(255,255,255,.55)';
          if ((r + i) % 2) c.fillRect(x + 1.2, y + 0.6, 0.8, 2); else c.fillRect(x + 0.6, y + 1.2, 2, 0.8);
        }
        break;
      case 'rosette':
        c.strokeStyle = p0; c.lineWidth = 0.55;
        for (let i = 0; i < 14; i++) {
          const x = x0 + hash(i + seed) * w, y = y0 + hash(i + seed + 40) * h;
          c.beginPath(); c.arc(x, y, 0.95, 0.3, Math.PI * 1.8); c.stroke();
          c.fillStyle = p0; circle(c, x, y, 0.25);
        }
        break;
      case 'leopard':
        c.fillStyle = p0; c.fillRect(x0, y0, w, h);
        c.fillStyle = p1;
        for (let i = 0; i < 16; i++) circle(c, x0 + hash(i + seed) * w, y0 + hash(i + seed + 9) * h, 0.6);
        break;
      case 'feathers':
        c.strokeStyle = p0; c.lineWidth = 0.5;
        for (let y = y0, r = 0; y < y1; y += 2, r++) for (let x = x0 + (r % 2) * 1.2; x < x1; x += 2.4) { c.beginPath(); c.arc(x, y, 1.2, 0.2, Math.PI - 0.2); c.stroke(); }
        break;
      case 'quilt':
        c.strokeStyle = rgba(p0, 0.75); c.lineWidth = 0.45;
        for (let d = -h; d < w + h; d += 2.8) { line(c, x0 + d, y0, x0 + d + h, y1); line(c, x0 + d + h, y0, x0 + d, y1); }
        break;
      case 'studs':
        c.fillStyle = p0;
        for (let y = y0 + 1, r = 0; y < y1; y += 2.2, r++) for (let x = x0 + 1 + (r % 2) * 1.1; x < x1; x += 2.2) circle(c, x, y, 0.42);
        break;
      case 'brocade':
        c.strokeStyle = rgba(p0, 0.85); c.lineWidth = 0.45;
        for (let y = y0 + 1.5, r = 0; y < y1; y += 3.2, r++) for (let x = x0 + 1 + (r % 2) * 1.6; x < x1; x += 3.2) { c.beginPath(); c.arc(x, y, 1, 0, Math.PI * 1.4); c.stroke(); }
        break;
      case 'calico':
        c.fillStyle = p0;
        for (let i = 0; i < 26; i++) circle(c, x0 + hash(i + seed) * w, y0 + hash(i + seed + 3) * h, 0.35);
        break;
      case 'woodland': case 'multicam': {
        const cols = [p0, p1, p2];
        const n = kind === 'woodland' ? 9 : 14;
        for (let i = 0; i < n; i++) {
          c.fillStyle = rgba(cols[i % 3], kind === 'woodland' ? 0.95 : 0.7);
          ell(c, x0 + hash(i + seed) * w, y0 + hash(i + seed + 21) * h, kind === 'woodland' ? 2.4 : 1.6, kind === 'woodland' ? 1.2 : 1, hash(i + 5) * 3);
        }
        break;
      }
      case 'digital':
        for (let y = y0; y < y1; y += 1.2) for (let x = x0; x < x1; x += 1.2) {
          const v = hash(Math.round(x * 7 + y * 13) + seed);
          if (v < 0.25) { c.fillStyle = p0; c.fillRect(x, y, 1.2, 1.2); } else if (v > 0.8) { c.fillStyle = p1; c.fillRect(x, y, 1.2, 1.2); }
        }
        break;
      case 'pinstripe':
        c.strokeStyle = rgba(p0, 0.8); c.lineWidth = 0.3;
        for (let x = x0 + 0.6; x < x1; x += 1.8) line(c, x, y0, x, y1);
        break;
      case 'slashed':
        c.fillStyle = p0;
        for (let x = x0 + 1; x < x1; x += 2.6) rr(c, x, y0 + 2, 0.9, h - 4, 0.4);
        break;
    }
  }

  // Heraldic and painted devices, centred at (x, y), about s pixels tall.
  function drawEmblem(c, kind, x, y, s, col) {
    c.save();
    c.translate(x, y);
    c.scale(s / 8, s / 8);
    c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.3; c.lineCap = 'round';
    switch (kind) {
      case 'lambda': c.lineWidth = 1.8; c.beginPath(); c.moveTo(-3, 3.5); c.lineTo(0, -3.5); c.lineTo(3, 3.5); c.stroke(); break;
      case 'lion':
        ell(c, 0, 0.5, 2.2, 3); circle(c, 0.6, -3.2, 1.6);
        poly(c, [[-1.5, 2.6], [-3.2, 4.2], [-1, 3.4]]); poly(c, [[1.2, 2.6], [2.8, 4.4], [1.8, 2.4]]);
        poly(c, [[1.6, -1], [3.6, -2.4], [2.2, 0]]);
        c.beginPath(); c.moveTo(-2, 1); c.quadraticCurveTo(-4.4, -0.4, -3.4, -3); c.stroke();
        break;
      case 'fleur':
        ell(c, 0, -1.2, 1.1, 2.8);
        c.beginPath(); c.moveTo(-0.6, 0); c.quadraticCurveTo(-3.6, -1, -2.6, -3); c.stroke();
        c.beginPath(); c.moveTo(0.6, 0); c.quadraticCurveTo(3.6, -1, 2.6, -3); c.stroke();
        c.fillRect(-2.2, 0.6, 4.4, 0.9);
        ell(c, 0, 2.8, 0.8, 1.3);
        break;
      case 'wings':
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-3, -3, -4, 0); c.quadraticCurveTo(-2, 0.5, 0, 0); c.fill();
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(3, -3, 4, 0); c.quadraticCurveTo(2, 0.5, 0, 0); c.fill();
        c.fillRect(-0.5, -1, 1, 4);
        break;
      case 'quarters': c.fillRect(-4.5, -9, 4.5, 9); c.fillRect(0, 0, 4.5, 9); break;
      case 'swirl':
        for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * 2.094); c.beginPath(); c.arc(1.6, 0, 1.6, Math.PI, Math.PI * 2.6); c.stroke(); c.restore(); }
        break;
      case 'feathers':
        for (let i = -2; i <= 2; i++) ell(c, Math.sin(i * 0.5) * 3, -Math.cos(i * 0.5) * 3, 0.8, 2.2, i * 0.5);
        circle(c, 0, 1.6, 1.4);
        break;
      case 'diamonds': for (let i = -1; i <= 1; i++) poly(c, [[0, i * 3 - 1.2], [1.2, i * 3], [0, i * 3 + 1.2], [-1.2, i * 3]]); break;
      case 'sun':
        circle(c, 0, 0, 1.8);
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(c, Math.cos(a) * 2.6, Math.sin(a) * 2.6, Math.cos(a) * 4, Math.sin(a) * 4); }
        break;
      case 'spots': for (let i = 0; i < 5; i++) circle(c, (hash(i) - 0.5) * 6, (hash(i + 4) - 0.5) * 12, 0.9); break;
    }
    c.restore();
  }

  function drawFigure(c, def, o) {
    const L = def.look;
    const Lt = o.light || PORTRAIT_LIGHT;
    CUR_LT = Lt;
    if (L.alien) { drawAlien(c, def, o); return; }
    const walk = o.walk || 0;
    const sw = o.swing || 0;
    const lunge = sw > 0 ? Math.sin((1 - sw) * Math.PI) * 3 : 0;
    const seed = def.id.length * 7 + def.era;
    c.save();
    c.translate(lunge, 0);
    if (def.mounted) { drawHorse(c, L.mounted, walk, o.teamCol); c.translate(-2, -13); }
    const bob = def.mounted ? Math.sin(walk * 2) * 0.6 : -Math.abs(Math.sin(walk)) * 1.2;
    c.translate(0, bob);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const body = L.coat || L.body;

    if (L.cape) {
      const fl = Math.sin(walk * 0.8 + S_t()) * 1.5;
      const g = c.createLinearGradient(-4, -36, -12, -12);
      g.addColorStop(0, shade(L.cape, 0.1)); g.addColorStop(1, shade(L.cape, -0.3));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-3, -36); c.quadraticCurveTo(-12 + fl, -26, -14 + fl, -12); c.lineTo(-5, -14); c.lineTo(-1, -30); c.closePath(); c.fill();
      if (L.capeSpots) { c.save(); c.clip(); c.fillStyle = L.capeSpots; for (let i = 0; i < 9; i++) circle(c, -12 + hash(i + seed) * 11, -34 + hash(i + 3) * 22, 0.8); c.restore(); }
      if (L.capeTrim) {
        c.strokeStyle = L.capeTrim; c.lineWidth = 0.9;
        c.beginPath(); c.moveTo(-3, -36); c.quadraticCurveTo(-12 + fl, -26, -14 + fl, -12); c.lineTo(-5, -14); c.stroke();
      }
    }
    if (L.duster) { c.fillStyle = shade(L.duster, -0.1); poly(c, [[-6, -34], [-10, -8], [6, -8], [6, -34]]); }

    // Legs: thigh and shin with a knee bend, back leg shaded; boots and leg patterns.
    const legCol = L.legs;
    const legDots = (x0, y0, x1, y1, back) => {
      if (!L.legsPattern || !L.pc) return;
      for (let i = 0; i < 4; i++) {
        const t = (i + 0.5) / 4;
        c.fillStyle = back ? shade(L.pc[i % L.pc.length], -0.3) : L.pc[i % L.pc.length];
        ell(c, x0 + (x1 - x0) * t + (hash(i + seed) - 0.5), y0 + (y1 - y0) * t, 1.4, 1);
      }
    };
    const drawLeg = (ph, back) => {
      const th = Math.sin(ph) * 0.5;
      const sh = th - 0.6 * Math.max(0, Math.cos(ph));
      const kx = Math.sin(th) * 8.5, ky = -18 + Math.cos(th) * 8.5;
      const fx = kx + Math.sin(sh) * 8.5, fy = ky + Math.cos(sh) * 8.5;
      c.strokeStyle = back ? shade(legCol, -0.3) : legCol;
      c.lineWidth = 4;
      c.beginPath(); c.moveTo(0, -18); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      legDots(0, -18, kx, ky, back); legDots(kx, ky, fx, fy, back);
      if (L.boots) {
        c.strokeStyle = back ? shade(L.boots, -0.3) : L.boots; c.lineWidth = 4.4;
        line(c, kx + (fx - kx) * 0.45, ky + (fy - ky) * 0.45, fx, fy);
      }
      if (L.tassels) { c.fillStyle = back ? shade(L.tassels, -0.3) : L.tassels; ell(c, kx, ky + 1.5, 1.6, 2.4); }
      c.fillStyle = L.boots ? (back ? shade(L.boots, -0.4) : shade(L.boots, -0.15)) : back ? '#140f0a' : '#2a2016';
      rr(c, fx - 2, fy - 2.4, 6, 3, 1.2);
    };
    if (def.mounted) {
      c.strokeStyle = legCol; c.lineWidth = 4;
      c.beginPath(); c.moveTo(0, -18); c.lineTo(7, -12); c.lineTo(5, -4); c.stroke();
      if (L.boots) { c.strokeStyle = L.boots; c.lineWidth = 4.4; line(c, 6, -9, 5, -4); }
      c.fillStyle = L.boots ? shade(L.boots, -0.15) : '#2a2016'; rr(c, 3, -6, 6, 3, 1.2);
    } else {
      drawLeg(walk + Math.PI, true);
    }

    // Back arm
    c.strokeStyle = shade(body, -0.3); c.lineWidth = 3;
    const bs = Math.sin(walk) * 3;
    c.beginPath(); c.moveTo(-1, -33); c.lineTo(-4 - bs * 0.4, -27); c.lineTo(-3 - bs, -22); c.stroke();
    if (L.tassels) { c.fillStyle = shade(L.tassels, -0.25); ell(c, -4 - bs * 0.4, -27, 1.4, 2.2); }
    if (!def.mounted) drawLeg(walk, false);

    // Long garments: robes fall to the ankle, kaftans and coats to the knee.
    if (L.robe || L.kaftan) {
      const hem = L.robe ? -2.5 : -8.5;
      const sway = Math.sin(walk) * (L.robe ? 1.4 : 1);
      const rg = c.createLinearGradient(Lt.lx * 6, -20, -Lt.lx * 6, hem);
      rg.addColorStop(0, shade(body, 0.1)); rg.addColorStop(1, shade(body, -0.28));
      c.fillStyle = rg;
      poly(c, [[-6, -21], [6, -21], [8.5 + sway, hem], [-8.5 + sway, hem]]);
      if (L.pattern && L.pattern !== 'none') {
        c.save(); c.beginPath(); c.moveTo(-6, -21); c.lineTo(6, -21); c.lineTo(8.5 + sway, hem); c.lineTo(-8.5 + sway, hem); c.closePath(); c.clip();
        drawPattern(c, L.pattern, L.pc, -9, -21, 19, 21 + hem, seed + 50);
        c.restore();
      }
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 0.5; line(c, 0.5, -20, 1 + sway * 0.5, hem);
      if (L.trim) { c.strokeStyle = L.trim; c.lineWidth = 1.2; line(c, -8.5 + sway, hem, 8.5 + sway, hem); line(c, 1.5, -20, 2 + sway * 0.5, hem); }
    }

    // Torso, shaded toward the light.
    const torso = () => { c.beginPath(); c.moveTo(-6.5, -36); c.lineTo(6.5, -36); c.lineTo(5.6, -18); c.lineTo(-5.6, -18); c.closePath(); };
    const tg = c.createLinearGradient(Lt.lx * 7, -27 + Lt.ly * 10, -Lt.lx * 7, -27 - Lt.ly * 10);
    tg.addColorStop(0, shade(body, 0.2)); tg.addColorStop(1, shade(body, -0.26));
    c.fillStyle = tg;
    torso(); c.fill();
    if (L.pattern && L.pattern !== 'none') {
      c.save(); torso(); c.clip();
      drawPattern(c, L.pattern, L.pc, -7, -37, 14, 20, seed);
      // Re-apply the light falloff over the pattern.
      const sg = c.createLinearGradient(Lt.lx * 7, -27 + Lt.ly * 10, -Lt.lx * 7, -27 - Lt.ly * 10);
      sg.addColorStop(0, 'rgba(255,255,255,.08)'); sg.addColorStop(1, 'rgba(0,0,0,.25)');
      c.fillStyle = sg; c.fillRect(-7, -37, 14, 20);
      c.restore();
    }
    torso(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.7; c.stroke();

    if (L.cuirass) {
      const cg = c.createRadialGradient(Lt.lx * 3, -30 + Lt.ly * 3, 0.5, 0, -28, 11);
      cg.addColorStop(0, shade(L.cuirass, 0.45)); cg.addColorStop(0.5, L.cuirass); cg.addColorStop(1, shade(L.cuirass, -0.35));
      c.fillStyle = cg;
      poly(c, [[-6, -35.5], [6.2, -35.5], [5.4, -21], [-5.4, -21]]);
      c.strokeStyle = shade(L.cuirass, -0.4); c.lineWidth = 0.5;
      c.beginPath(); c.arc(-1, -30, 2.4, 0.2, Math.PI - 0.2); c.stroke();
      c.beginPath(); c.arc(3.4, -30, 2.4, 0.2, Math.PI - 0.2); c.stroke();
      line(c, 1.2, -27, 1.2, -22); line(c, -2, -25, 4.4, -25);
      c.fillStyle = `rgba(${Lt.specRGB},${0.55 * Lt.spec})`; ell(c, 1 + Lt.lx * 3, -31 + Lt.ly * 2, 1.4, 0.8);
    }
    if (L.phalerae) {
      for (const [x, y] of [[-2.5, -31], [1.5, -31], [-0.5, -26.5]]) {
        const pg = c.createRadialGradient(x + Lt.lx * 0.6, y + Lt.ly * 0.6, 0, x, y, 1.4);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#9ea3a6');
        c.fillStyle = pg; circle(c, x, y, 1.3);
      }
    }
    if (L.yoke) { c.fillStyle = L.yoke; poly(c, [[-6.5, -36], [6.5, -36], [6.2, -33], [0.5, -30.5], [-6.2, -33]]); }
    if (L.tabard) {
      const tg2 = c.createLinearGradient(Lt.lx * 6, -30, -Lt.lx * 6, -24);
      tg2.addColorStop(0, shade(L.tabard, 0.15)); tg2.addColorStop(1, shade(L.tabard, -0.25));
      c.fillStyle = tg2;
      poly(c, [[-5, -35.5], [5.2, -35.5], [5.6, -12.5], [-5.4, -12.5]]);
      c.strokeStyle = shade(L.tabard, -0.4); c.lineWidth = 0.4; line(c, 0.2, -21, 0.4, -12.5);
      if (L.emblem) drawEmblem(c, L.emblem, 0.3, -28.5, 7, L.ec || '#e0b84a');
    }
    if (L.skirt || L.kilt) {
      c.fillStyle = L.kilt ? '#3a5a8a' : shade(L.legs, -0.05);
      poly(c, [[-6.5, -21], [6.5, -21], [8, -9 + Math.sin(walk) * 0.8], [-8, -9 - Math.sin(walk) * 0.8]]);
      if (L.kilt) {
        c.save(); c.beginPath(); c.moveTo(-6.5, -21); c.lineTo(6.5, -21); c.lineTo(8, -9); c.lineTo(-8, -9); c.closePath(); c.clip();
        drawPattern(c, 'tartan', ['#2f5a3a', '#a8322a'], -9, -21, 18, 13, seed);
        c.restore();
      }
    }
    if (L.fringe) {
      c.strokeStyle = L.fringe; c.lineWidth = 0.6;
      for (let x = -5.5; x <= 5.5; x += 1.3) line(c, x, -18.5, x + Math.sin(walk + x) * 0.6, L.skirt ? -8 : -14.5);
    }
    if (L.pteruges) {
      for (let i = 0; i < 6; i++) {
        c.fillStyle = i % 2 ? L.pteruges : shade(L.pteruges, -0.25);
        rr(c, -6 + i * 2.1, -20.5, 1.9, 7 + Math.sin(walk + i) * 0.5, 0.6);
      }
    }
    if (L.vest) { const vg = c.createLinearGradient(-6, -34, 6, -21); vg.addColorStop(0, shade(L.vest, 0.12)); vg.addColorStop(1, shade(L.vest, -0.2)); c.fillStyle = vg; rr(c, -5.5, -34.5, 11, 12.5, 2); c.fillStyle = shade(L.vest, -0.3); c.fillRect(-4, -30, 3, 3); c.fillRect(1, -30, 3, 3); }
    if (L.stripes) { c.strokeStyle = '#2a4a8a'; c.lineWidth = 0.9; c.fillStyle = '#efe4cf'; c.fillRect(-2.5, -36.3, 5, 2.4); for (let y = -35.8; y < -34; y += 1.1) line(c, -2.5, y, 2.5, y); }
    if (L.cowhide) { c.fillStyle = '#2a2016'; ell(c, -2, -30, 2.4, 3); ell(c, 3, -24, 2, 2.4); }
    if (L.facing && !L.lapels) { c.fillStyle = L.facing; c.fillRect(2, -35.5, 3, 15); }
    if (L.lapels) {
      c.fillStyle = L.lapels;
      poly(c, [[1, -35.8], [5.6, -35.8], [5, -24], [2.4, -22]]);
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.4; line(c, 1, -35.8, 2.4, -22);
    }
    if (L.cross) {
      c.fillStyle = '#efe4cf'; c.fillRect(-1, -33, 2, 10); c.fillRect(-4, -30, 8, 2);
      c.fillStyle = '#c8312b'; for (const [x, y] of [[0, -33.5], [0, -22.5], [-4.5, -29], [4.5, -29]]) circle(c, x, y, 0.7);
    }
    if (L.crossbelts) { c.strokeStyle = L.crossbelts; c.lineWidth = 1.5; line(c, -6, -35, 5.4, -19.5); line(c, 6, -35, -5.4, -19.5); c.fillStyle = '#d9b45a'; c.fillRect(-0.6, -28, 1.4, 1.4); }
    if (L.sash) { c.strokeStyle = L.sash; c.lineWidth = 2.5; line(c, -6, -35, 6, -22); }
    if (L.bandolier) { c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.2; line(c, -6, -35, 6, -22); line(c, 6, -35, -6, -22); c.fillStyle = '#c9a23a'; for (let k2 = 0; k2 < 4; k2++) c.fillRect(-4 + k2 * 3, -33 + k2 * 3, 1.2, 1.2); }
    if (L.buttons) { c.fillStyle = L.buttons; for (let y = -34; y < -21; y += 2.6) circle(c, L.lapels ? 0.4 : 1, y, 0.5); }
    if (L.tie) { c.fillStyle = L.tie; poly(c, [[0, -35], [2, -27], [0, -25], [-2, -27]]); }
    if (L.paintBolt) { c.strokeStyle = '#efe4cf'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-3, -34); c.lineTo(0, -30); c.lineTo(-2, -29); c.lineTo(2, -24); c.stroke(); c.fillStyle = '#efe4cf'; circle(c, 3.6, -31, 0.5); circle(c, -3.6, -26, 0.5); }
    if (L.trim && !L.robe && !L.kaftan) { c.strokeStyle = L.trim; c.lineWidth = 1; line(c, -5.6, -18.4, 5.6, -18.4); }
    if (L.trim) { c.strokeStyle = L.trim; c.lineWidth = 0.9; c.beginPath(); c.arc(0.5, -36.5, 3, 0.15, Math.PI - 0.15); c.stroke(); }
    if (L.fur) { c.fillStyle = L.fur; rr(c, -7, -38, 14, 4, 2); }
    if (L.furCollar) { c.fillStyle = L.furCollar; rr(c, -6.5, -38.3, 13, 3.6, 1.8); c.fillStyle = shade(L.furCollar, 0.2); for (let x = -5.5; x < 6; x += 2) circle(c, x, -37.6, 0.6); }
    if (L.neck) { c.fillStyle = L.neck; poly(c, [[-4, -36], [4, -36], [0, -31]]); }
    if (L.scarf) {
      c.fillStyle = L.scarf; poly(c, [[-3.5, -36.5], [4.5, -36.5], [1, -30.5]]);
      if (L.scarfDots) { c.fillStyle = L.scarfDots; for (const [x, y] of [[-1.5, -35.5], [1, -34.5], [3, -35.6], [0.8, -32.5]]) circle(c, x, y, 0.4); }
    }
    if (L.beads) { c.fillStyle = L.beads; for (let a = 0.2; a < Math.PI - 0.1; a += 0.35) circle(c, 0.5 + Math.cos(a) * 4, -36 + Math.sin(a) * 3, 0.65); }
    if (L.torc) { c.strokeStyle = L.torc; c.lineWidth = 1.2; c.beginPath(); c.arc(0.8, -36.4, 3.2, 0.2, Math.PI - 0.2); c.stroke(); c.fillStyle = L.torc; circle(c, 3.8, -35.4, 0.8); circle(c, -2.2, -35.4, 0.8); }
    if (L.sode) {
      c.fillStyle = L.sode; rr(c, -1.5, -37, 6, 6.5, 0.8);
      drawPattern(c, 'lacing', L.pc, -1.5, -37, 6, 6.5);
    }
    if (L.epaulettes) {
      c.fillStyle = L.epaulettes; ell(c, 1.5, -36, 3.6, 1.6);
      c.strokeStyle = L.epFringe || L.epaulettes; c.lineWidth = 0.5;
      for (let x = -1.5; x <= 4.5; x += 0.9) line(c, x, -35.2, x, -33);
    }
    if (def.role === 'heavy' || def.hero) {
      const pcol = def.role === 'heavy' ? (L.cuirass || (L.hc && L.hc !== '#1a1a1a' ? L.hc : '#9ea3a6')) : (L.epaulettes || L.capeTrim || '#c9a23a');
      if (!L.epaulettes && !L.sode) {
        const pg = c.createRadialGradient(2 + Lt.lx * 2.5, -34 + Lt.ly * 2, 0, 2, -34, 6);
        pg.addColorStop(0, shade(pcol, 0.4)); pg.addColorStop(1, shade(pcol, -0.25));
        c.fillStyle = pg; ell(c, 2, -34, 5, 3.4);
      }
    }
    // Belt with team color and buckle.
    const beltCol = L.belt || '#2a1d12';
    c.fillStyle = beltCol; c.fillRect(-6, L.belt ? -22.5 : -21.5, 12, L.belt ? 3 : 2);
    c.fillStyle = o.teamCol; c.fillRect(-6, -20, 12, 2.4);
    c.fillStyle = '#d9b45a'; c.fillRect(2.5, -21.5, 2, 2);

    // Head
    const HX = 1, HY = -42;
    c.fillStyle = shade(L.skin, -0.15); c.fillRect(-1, -38, 3.5, 3);
    if (L.longHair || L.whiteHair) { c.fillStyle = L.whiteHair ? '#e8e4dc' : '#1a1a1a'; rr(c, -6, -46, 6, 13, 2); }
    const hg = c.createRadialGradient(HX + Lt.lx * 2.6, HY + Lt.ly * 2.6, 0.5, HX, HY, 6.5);
    hg.addColorStop(0, shade(L.skin, 0.18)); hg.addColorStop(1, shade(L.skin, -0.12));
    c.fillStyle = hg;
    circle(c, HX, HY, 6);
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.6; c.beginPath(); c.arc(HX, HY, 6, 0, Math.PI * 2); c.stroke();
    c.fillStyle = shade(L.skin, -0.1); poly(c, [[HX + 5.6, HY - 0.6], [HX + 7.6, HY + 1.2], [HX + 5.4, HY + 1.8]]);
    if (L.paint) { c.fillStyle = L.paint; c.fillRect(HX, HY - 2, 6, 2.5); }
    if (L.moko) { c.strokeStyle = '#2a2a3a'; c.lineWidth = 0.7; c.beginPath(); c.arc(HX + 3, HY + 1, 2.5, 0, Math.PI); c.stroke(); line(c, HX + 1, HY - 3, HX + 5, HY - 4); line(c, HX + 2, HY + 4, HX + 5, HY + 3.4); }
    if (L.beard) { c.fillStyle = L.beard; c.beginPath(); c.arc(HX + 1, HY + 2, 5, 0.1, Math.PI - 0.4); c.fill(); }
    if (L.mustache) { c.strokeStyle = '#2a1a1a'; c.lineWidth = 1.3; line(c, HX + 2.5, HY + 2.6, HX + 6, HY + 2.4); }
    c.fillStyle = '#f4efe4'; c.fillRect(HX + 2.6, HY - 1.8, 2.2, 1.6);
    c.fillStyle = '#16100c'; c.fillRect(HX + 3.6, HY - 1.8, 1.2, 1.6);
    c.strokeStyle = 'rgba(30,20,12,.7)'; c.lineWidth = 0.7; line(c, HX + 2.4, HY - 2.9, HX + 5.2, HY - 3.2);
    if (L.glasses) { c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.8; c.beginPath(); c.arc(HX + 4, HY - 1, 1.8, 0, Math.PI * 2); c.stroke(); }
    if (L.paintBolt) { c.strokeStyle = '#efe4cf'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(HX + 3, HY - 5); c.lineTo(HX + 1.5, HY - 2); c.lineTo(HX + 3, HY - 1.5); c.lineTo(HX + 1.5, HY + 2); c.stroke(); }
    drawHelm(c, L, HX, HY);
    if (L.helmDots) { c.fillStyle = L.helmDots; for (let x = -4; x <= 5; x += 1.8) circle(c, HX + x, HY - 5.2 - Math.sin((x + 4) / 9 * Math.PI) * 1.4, 0.55); }
    if (METAL_HELMS.has(L.helm)) {
      // Metal: tight specular lobe toward the light, sky reflection on the far edge.
      const sx2 = HX + Lt.lx * 3, sy2 = HY - 2 + Lt.ly * 2.6;
      const sg = c.createRadialGradient(sx2, sy2, 0, sx2, sy2, 3.4);
      sg.addColorStop(0, `rgba(${Lt.specRGB},${0.9 * Lt.spec})`);
      sg.addColorStop(1, `rgba(${Lt.specRGB},0)`);
      c.fillStyle = sg; circle(c, sx2, sy2, 3.4);
      c.strokeStyle = Lt.env; c.lineWidth = 0.9;
      const fa = Math.atan2(-Lt.ly, -Lt.lx);
      c.beginPath(); c.arc(HX, HY - 1, 5.8, fa - 0.7, fa + 0.7); c.stroke();
    }

    // Shield on the near arm, with its painted device.
    const w = o.weapon;
    const k = w ? (w.kind || 'sword') : 'sword';
    const twoHand = k === 'bow' || k === 'rifle' || (k === 'spear' && !L.shield);
    if (L.shield && !twoHand) {
      const ecol = L.ec2 || L.ec || '#efe4cf';
      if (L.kite) {
        c.fillStyle = L.shield; poly(c, [[2, -37], [12, -35], [10, -20], [6, -11], [3, -20]]);
        if (L.shieldEmblem) drawEmblem(c, L.shieldEmblem, 7, -27, 8, ecol);
        c.fillStyle = 'rgba(255,255,255,.18)'; poly(c, [[3, -36], [7, -35.5], [5, -22], [3.6, -21]]);
      } else {
        const sg = c.createRadialGradient(7 + Lt.lx * 3, -27 + Lt.ly * 5, 1, 7, -27, 10);
        sg.addColorStop(0, shade(L.shield, 0.28)); sg.addColorStop(1, shade(L.shield, -0.3));
        c.fillStyle = sg;
        ell(c, 7, -27, 5.2, 9.8);
        if (L.shieldEmblem) {
          c.save(); c.beginPath(); c.ellipse(7, -27, 5.2, 9.8, 0, 0, Math.PI * 2); c.clip();
          if (L.shieldEmblem === 'quarters') drawEmblem(c, 'quarters', 7, -27, 8, ecol);
          else { c.translate(7, -27); c.scale(0.62, 1); drawEmblem(c, L.shieldEmblem, 0, 0, 10, ecol); }
          c.restore();
        }
        c.strokeStyle = shade(L.shield, -0.45); c.lineWidth = 1;
        c.beginPath(); c.ellipse(7, -27, 5.2, 9.8, 0, 0, Math.PI * 2); c.stroke();
        if (!L.shieldEmblem || L.shieldEmblem === 'quarters') { c.fillStyle = shade(L.shield, 0.4); ell(c, 7.6, -27, 1.6, 2.4); }
        c.fillStyle = `rgba(${Lt.specRGB},${0.75 * Lt.spec})`; circle(c, 7 + Lt.lx * 2.5, -27 + Lt.ly * 5, 0.9);
      }
    }

    // Front arm (upper arm and forearm) and weapon.
    let th;
    if (k === 'bow' || k === 'rifle' || k === 'pistol') th = -0.08;
    else if (sw > 0) th = -1.6 + (1 - sw) * 2.6;
    else th = k === 'spear' ? 0.35 : 0.9;
    const shx = 0, shy = -33;
    const ex = shx + Math.cos(th + 0.35) * 5.5, ey = shy + Math.sin(th + 0.35) * 5.5;
    const hx = ex + Math.cos(th - 0.25) * 5.5, hy = ey + Math.sin(th - 0.25) * 5.5;
    c.strokeStyle = L.manica || body; c.lineWidth = 3.4;
    c.beginPath(); c.moveTo(shx, shy); c.lineTo(ex, ey); c.lineTo(hx, hy); c.stroke();
    if (L.manica) { c.strokeStyle = shade(L.manica, -0.3); c.lineWidth = 0.5; for (let t = 0.15; t < 1; t += 0.22) { const mx = shx + (hx - shx) * t, my = shy + (hy - shy) * t; line(c, mx - 1.4, my - 0.6, mx + 1.4, my + 0.6); } }
    if (L.pattern === 'mail' || L.pattern === 'lamellar') { c.strokeStyle = rgba(L.pc[0], 0.6); c.lineWidth = 1; line(c, shx, shy, ex, ey); }
    if (L.cuffs) { c.strokeStyle = L.cuffs; c.lineWidth = 3.8; line(c, ex + (hx - ex) * 0.6, ey + (hy - ey) * 0.6, ex + (hx - ex) * 0.9, ey + (hy - ey) * 0.9); }
    if (L.fringe) { c.strokeStyle = L.fringe; c.lineWidth = 0.5; for (let t = 0.2; t < 0.9; t += 0.18) { const mx = shx + (hx - shx) * t, my = shy + (hy - shy) * t; line(c, mx, my + 1.5, mx - 0.6, my + 3.2); } }
    if (L.tassels) { c.fillStyle = L.tassels; ell(c, ex, ey + 1.6, 1.4, 2.4); }
    drawWeapon(c, k, hx, hy, th, sw, w);
    c.fillStyle = L.skin; circle(c, hx, hy, 1.9);

    if (o.shield) {
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,220,140,.55)'; c.lineWidth = 2;
      c.beginPath(); c.arc(2, -27, 17, -1.25, 1.25); c.stroke();
      c.restore();
    }
    c.restore();
  }
  const S_t = () => (S ? S.t : 0);

  function drawWeapon(c, k, hx, hy, th, sw, w) {
    const n = w ? w.name.toLowerCase() : '';
    const steel = '#dfe3e6', steelD = '#8d959b', wood = '#7a5230', woodD = '#4e3320', dark = '#222326';
    const blade = (x0, x1, wdt) => {
      c.strokeStyle = steelD; c.lineWidth = wdt + 0.8; line(c, x0, 0, x1, 0);
      c.strokeStyle = steel; c.lineWidth = wdt; line(c, x0, -0.3, x1, -0.3);
      c.strokeStyle = `rgba(${CUR_LT.specRGB},${0.35 + 0.6 * CUR_LT.spec})`; c.lineWidth = 0.5; line(c, x0 + 1, -0.8, x1 - 1, -0.8);
    };
    c.save();
    c.translate(hx, hy);
    c.lineCap = 'round';
    switch (k) {
      case 'sword': {
        c.rotate(th - 1.25);
        const len = /claymore|long sword|great|falcata|katana|macuahuitl|broadsword/.test(n) ? 21 : 16;
        if (/macuahuitl/.test(n)) {
          c.strokeStyle = wood; c.lineWidth = 3.2; line(c, 0, 0, len, 0);
          c.fillStyle = '#121212'; for (let i = 5; i < len; i += 3.2) { poly(c, [[i, -1.6], [i + 1.2, -3.4], [i + 2.2, -1.6]]); poly(c, [[i, 1.6], [i + 1.2, 3.4], [i + 2.2, 1.6]]); }
        } else {
          blade(2.5, len, 2.2);
          c.strokeStyle = '#b8862e'; c.lineWidth = 2; line(c, 1.8, -3.2, 1.8, 3.2);
          c.strokeStyle = woodD; c.lineWidth = 1.8; line(c, -2, 0, 1.5, 0);
        }
        break;
      }
      case 'knife':
        c.rotate(th - 1.25);
        blade(1.5, 9, 1.8);
        c.strokeStyle = woodD; c.lineWidth = 1.8; line(c, -1.5, 0, 1.5, 0);
        break;
      case 'axe':
        c.rotate(th - 1.25);
        c.strokeStyle = wood; c.lineWidth = 2; line(c, -2, 0, 17, 0);
        c.fillStyle = steelD; poly(c, [[12, 0], [17, -7], [20, -1], [18, 2.5]]);
        c.fillStyle = steel; poly(c, [[13.5, -0.5], [17, -6], [19, -1.5]]);
        break;
      case 'club':
        c.rotate(th - 1.25);
        if (/staff/.test(n)) { c.strokeStyle = wood; c.lineWidth = 2; line(c, -8, 0, 20, 0); c.strokeStyle = '#c9a23a'; c.lineWidth = 2.2; line(c, 6, 0, 7, 0); break; }
        if (/knuckles|krav/.test(n)) break;
        if (/nunchaku/.test(n)) { c.strokeStyle = wood; c.lineWidth = 2; line(c, 0, 0, 8, 0); c.strokeStyle = '#999'; c.lineWidth = 0.6; line(c, 8, 0, 11, 2); c.strokeStyle = wood; c.lineWidth = 2; line(c, 11, 2, 18, 5); break; }
        c.strokeStyle = wood; c.lineWidth = 2.4; line(c, 0, 0, 13, 0);
        {
          const metal = /champi|morning|mace/.test(n);
          const hc = metal ? '#a4a8ac' : /mere/.test(n) ? '#4f7a5a' : '#5a3a20';
          const g = c.createRadialGradient(14, -1.5, 0.5, 15, 0, 4.5);
          g.addColorStop(0, shade(hc, 0.35)); g.addColorStop(1, shade(hc, -0.25));
          c.fillStyle = g; circle(c, 15, 0, 3.8);
          if (metal) { c.strokeStyle = '#a4a8ac'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const aa = i * Math.PI / 3; line(c, 15, 0, 15 + Math.cos(aa) * 6, Math.sin(aa) * 6); } }
        }
        break;
      case 'spear': {
        c.rotate(th - 0.75 + (sw > 0 ? 0.3 : 0));
        const len = /sarissa|lance|kontos/.test(n) ? 34 : 26;
        c.strokeStyle = wood; c.lineWidth = 1.8; line(c, -12, 0, len, 0);
        c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.5; line(c, -12, -0.6, len, -0.6);
        if (/trident/.test(n)) { c.strokeStyle = steel; c.lineWidth = 1.2; line(c, len, -3, len + 5, -3); line(c, len, 0, len + 6, 0); line(c, len, 3, len + 5, 3); line(c, len, -3, len, 3); }
        else if (/halberd|bardiche|guan dao|naginata/.test(n)) { c.fillStyle = steelD; poly(c, [[len - 7, 0], [len - 2, -7], [len + 5, -2], [len + 7, 0]]); c.fillStyle = steel; poly(c, [[len - 5, -0.5], [len - 2, -6], [len + 4, -1.5]]); }
        else if (/taiaha/.test(n)) { c.fillStyle = '#a8322a'; ell(c, len - 4, 0, 2, 3); c.fillStyle = '#efe4cf'; ell(c, len - 4, -3, 1, 1.5); }
        else { c.fillStyle = steelD; poly(c, [[len, -2.2], [len + 7, 0], [len, 2.2]]); c.fillStyle = steel; poly(c, [[len, -1.6], [len + 6, -0.2], [len, 0]]); }
        if (/lance|kontos/.test(n)) { c.fillStyle = '#c9a23a'; poly(c, [[len - 6, 0], [len - 12, -4], [len - 12, 0]]); }
        break;
      }
      case 'throw':
        c.rotate(th - 1.0);
        if (/sling|huaraca/.test(n)) { c.strokeStyle = '#c9a26a'; c.lineWidth = 1; line(c, 0, 0, 6, 8 - sw * 8); c.fillStyle = '#8a8a80'; circle(c, 6, 8 - sw * 8, 1.8); }
        else if (/atlatl/.test(n)) { c.strokeStyle = wood; c.lineWidth = 2; line(c, 0, 0, 10, 0); c.strokeStyle = '#c9a26a'; c.lineWidth = 1; line(c, -6, -1, 22, -1); c.fillStyle = '#121212'; poly(c, [[22, -2.2], [26, -1], [22, 0.2]]); }
        else if (/shuriken|chakram|kpinga/.test(n)) { c.fillStyle = steel; star(c, 3, 0, 3); }
        else { c.strokeStyle = wood; c.lineWidth = 1.6; line(c, -10, 0, 20, 0); c.fillStyle = steel; poly(c, [[20, -1.6], [25, 0], [20, 1.6]]); }
        break;
      case 'bow': {
        const cross = /crossbow|scorpio|gastraphetes/.test(n);
        if (cross) {
          c.strokeStyle = wood; c.lineWidth = 2.6; line(c, -5, 0, 12, 0);
          c.strokeStyle = woodD; c.lineWidth = 1.8; c.beginPath(); c.arc(8, 0, 7, -1.3, 1.3); c.stroke();
          c.strokeStyle = '#e8e0cc'; c.lineWidth = 0.5; line(c, 8 + Math.cos(1.3) * 7, -Math.sin(1.3) * 7, 3, 0); line(c, 3, 0, 8 + Math.cos(1.3) * 7, Math.sin(1.3) * 7);
          if (sw < 0.5) { c.strokeStyle = '#5a3a20'; c.lineWidth = 1; line(c, 3, -0.8, 14, -0.8); }
        } else {
          const pull = sw > 0.6 ? 0 : 4.5 * (1 - sw);
          c.strokeStyle = wood; c.lineWidth = 2;
          c.beginPath(); c.arc(-1, 0, 12, -1.1, 1.1); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.6;
          c.beginPath(); c.arc(-1, 0, 12.6, -0.9, -0.2); c.stroke();
          c.strokeStyle = '#e8e0cc'; c.lineWidth = 0.6;
          const ex = -1 + Math.cos(1.1) * 12, ey = Math.sin(1.1) * 12;
          c.beginPath(); c.moveTo(ex, -ey); c.lineTo(ex - pull, 0); c.lineTo(ex, ey); c.stroke();
          if (pull > 1) { c.strokeStyle = '#5a3a20'; c.lineWidth = 0.9; line(c, ex - pull, 0, 13, 0); }
        }
        break;
      }
      case 'rifle': {
        const musket = /musket|arquebus|pishchal|brown bess|long rifle|charleville|hand cannon/.test(n);
        const len = musket ? 22 : /smg|thompson|uzi|mp5|sten/.test(n) ? 13 : 17;
        c.rotate(-0.06);
        c.fillStyle = musket ? wood : dark; rr(c, -10, -1.6, 11, 3.8, 1);
        c.fillStyle = dark; c.fillRect(-1, -1.6, len, 2.4);
        c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(-1, -1.6, len, 0.6);
        if (/thompson/.test(n)) circle(c, 4, 3, 3);
        else if (/dragunov|sniper|m24|psg|mk 11/.test(n)) { c.fillStyle = '#111'; c.fillRect(1, -4, 8, 2); }
        else if (!musket) c.fillRect(3, 0, 2.5, 5);
        if (sw > 0.75) {
          c.save(); c.globalCompositeOperation = 'lighter';
          c.fillStyle = 'rgba(255,220,120,.95)'; star(c, len + 3, -0.5, 4.5);
          c.restore();
        }
        break;
      }
      case 'pistol':
        c.fillStyle = dark; c.fillRect(0, -2, 9, 2.6); c.fillRect(0, -1, 2.5, 4.5);
        c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(0, -2, 9, 0.6);
        if (sw > 0.75) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,220,120,.95)'; star(c, 11, -1, 3.5); c.restore(); }
        break;
    }
    c.restore();
  }

  // Marker for the player's battle order.
  function drawOrderLine() {
    if (!S || S.mode !== 'play') return;
    const st = S.sides[0].stance;
    if (st === 'advance') return;
    const c = ctx;
    const x = st === 'hold' ? BASE_X[0] + HOLD_DIST : spawnX(0) + 24;
    c.strokeStyle = 'rgba(71,179,194,.45)'; c.lineWidth = 1; c.setLineDash([4, 4]);
    line(c, x, GROUND + 2, x, GROUND - 60); c.setLineDash([]);
    c.strokeStyle = '#2a2016'; c.lineWidth = 1.5; line(c, x, GROUND, x, GROUND - 34);
    c.fillStyle = TEAM_COL[0];
    poly(c, [[x, GROUND - 34], [x + 13, GROUND - 31 + Math.sin(S.t * 4)], [x, GROUND - 26]]);
  }

  function drawShadow(u) {
    const c = ctx;
    const w = u.def.mounted ? 21 : 11;
    const a = (u.dead ? Math.max(0, 0.3 * (1 - u.deathT / 1.6)) : 0.3) * (0.55 + 0.45 * LIGHT.dayK);
    c.fillStyle = `rgba(0,0,0,${a})`;
    ell(c, u.x, GROUND + 1.5, w * (u.def.hero ? 1.15 : 1), 2.8);
    if (u.def.hero && !u.dead) onEmit(c, (e) => {
      const g = e.createRadialGradient(u.x, GROUND, 0, u.x, GROUND, 26);
      g.addColorStop(0, `rgba(217,169,68,${0.22 + 0.1 * Math.sin(S.t * 4)})`); g.addColorStop(1, 'rgba(217,169,68,0)');
      e.fillStyle = g; ell(e, u.x, GROUND, 26, 6);
    });
  }

  function drawUnit(u) {
    const c = ctx;
    const dir = DIR[u.team];
    c.save();
    c.translate(u.x + (u.flash > 0 ? (Math.random() - 0.5) * 1.5 : 0), GROUND);
    if (u.dead) {
      const t = Math.min(1, u.deathT / 0.45);
      const ease = 1 - Math.pow(1 - t, 3);
      c.rotate(-dir * ease * 1.5);
      c.globalAlpha = u.deathT > 0.9 ? Math.max(0, 1 - (u.deathT - 0.9) / 0.7) : 1;
    }
    const sc = u.def.hero ? 1.14 : u.def.role === 'heavy' ? 1.05 : 1;
    c.scale(dir * sc, sc);
    const sw = u.swingW;
    const showSwing = u.swing > 0 && sw && (!sw.fx || ((sw.fx === 'stun' || sw.fx === 'flurry') && !sw.proj));
    drawFigure(c, u.def, { walk: u.walk, swing: u.swing, weapon: showSwing ? sw : u.weapon, teamCol: TEAM_COL[u.team], shield: u.shieldT > 0, light: LIGHT.dirs[u.team] });
    c.restore();
    if (u.dead) return;

    const top = GROUND - (u.def.mounted ? 70 : 58) * sc;
    if (u.hp < u.maxHp) {
      const k = Math.max(0, u.hp / u.maxHp);
      c.fillStyle = 'rgba(10,8,6,.7)'; rr(c, u.x - 13, top - 0.5, 26, 4.2, 2);
      c.fillStyle = k < 0.3 ? '#e0603f' : TEAM_COL[u.team]; rr(c, u.x - 12.5, top, 25 * k, 3.2, 1.6);
    }
    if (u.def.hero) {
      c.fillStyle = '#e6b84e';
      star(c, u.x, top - 6, 3.6);
    }
    if (u.rank) {
      c.strokeStyle = '#f2d27a'; c.lineWidth = 1.2;
      for (let i = 0; i < u.rank; i++) {
        const y = top + 7 + i * 2.4;
        c.beginPath(); c.moveTo(u.x - 15, y - 1.4); c.lineTo(u.x - 13, y); c.lineTo(u.x - 11, y - 1.4); c.stroke();
      }
    }
    if (u.stunT > 0) {
      c.fillStyle = '#ffe08a';
      for (let i = 0; i < 3; i++) { const a = S.t * 6 + i * 2.1; star(c, u.x + Math.cos(a) * 8, top - 3 + Math.sin(a) * 2, 1.8); }
    }
    if (u.slowT > 0) {
      c.strokeStyle = 'rgba(190,140,255,.8)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(u.x, GROUND - 22, 9, 3, S.t * 3, 0, Math.PI * 2); c.stroke();
    }
    if (u.rallyT > 0) {
      c.strokeStyle = 'rgba(230,184,78,.7)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(u.x, GROUND - 1, 12, 2.8, 0, 0, Math.PI * 2); c.stroke();
    }
  }

  function star(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr2 = i % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    c.closePath(); c.fill();
  }

  // Runs fn on the emissive layer with the caller's current transform.
  function onEmit(c, fn) {
    ectx.save();
    ectx.setTransform(c.getTransform());
    ectx.globalCompositeOperation = 'lighter';
    fn(ectx);
    ectx.restore();
  }

  function drawProj(p) {
    if (p.t < 0) return;
    const c = ctx;
    const ang = Math.atan2(p.y - p.py, (p.x - p.px) || 0.0001);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(ang);
    switch (p.kind) {
      case 'arrow': case 'dart': case 'bolt': case 'javelin': case 'stake': {
        const len = p.kind === 'javelin' ? 21 : p.kind === 'bolt' ? 10 : p.kind === 'stake' ? 11 : 14;
        c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; line(c, -len - 10, 0, -len, 0);
        c.strokeStyle = p.kind === 'javelin' || p.kind === 'stake' ? '#7a5230' : '#5a3a20'; c.lineWidth = p.kind === 'javelin' ? 1.8 : 1.2;
        line(c, -len, 0, 0, 0);
        c.fillStyle = p.kind === 'dart' ? '#151515' : '#c8ccd0'; poly(c, [[0, -1.7], [4.5, 0], [0, 1.7]]);
        if (p.kind === 'arrow' || p.kind === 'bolt') { c.fillStyle = '#e8e0cc'; poly(c, [[-len, 0], [-len + 3.5, 0], [-len - 1, -2.4]]); poly(c, [[-len, 0], [-len + 3.5, 0], [-len - 1, 2.4]]); }
        if (p.kind === 'dart') { c.fillStyle = '#2f8a6a'; poly(c, [[-len, 0], [-len + 4, 0], [-len - 1, -2.2]]); }
        break;
      }
      case 'bullet':
        onEmit(c, (e) => {
          const g = e.createLinearGradient(-20, 0, 0, 0);
          g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(1, 'rgba(255,236,170,.95)');
          e.strokeStyle = g; e.lineWidth = 1.6; line(e, -20, 0, 0, 0);
          e.fillStyle = '#fff6d8'; circle(e, 0, 0, 1.1);
        });
        break;
      case 'stone':
        c.rotate(S.t * 12);
        c.fillStyle = '#7d776c'; poly(c, [[-2.8, -1.6], [0, -3], [2.9, -1], [2.2, 2.2], [-1.6, 2.8]]);
        c.fillStyle = 'rgba(255,255,255,.3)'; circle(c, -0.8, -1.2, 0.9);
        break;
      case 'star':
        c.rotate(S.t * 22); c.fillStyle = '#c8ccd0'; star(c, 0, 0, 3.8);
        c.fillStyle = '#ffffff'; circle(c, 0, 0, 0.8);
        break;
      case 'rocket':
        c.fillStyle = '#4a4c3a'; rr(c, -8, -1.8, 11, 3.6, 1.5);
        c.fillStyle = '#2a2a22'; poly(c, [[-8, -1.8], [-11, -4], [-6, -1.8]]); poly(c, [[-8, 1.8], [-11, 4], [-6, 1.8]]);
        c.fillStyle = '#5a5a3a'; poly(c, [[3, -1.8], [6, 0], [3, 1.8]]);
        onEmit(c, (e) => {
          e.fillStyle = 'rgba(255,170,70,.9)'; ell(e, -12, 0, 4 + Math.random() * 2, 1.8);
          e.fillStyle = 'rgba(255,240,180,.9)'; ell(e, -10, 0, 2, 1);
        });
        break;
      case 'bomb': case 'shell': {
        const g = c.createRadialGradient(-1, -1, 0.3, 0, 0, 4);
        g.addColorStop(0, '#6a6c70'); g.addColorStop(1, '#141414');
        c.fillStyle = g; circle(c, 0, 0, p.kind === 'shell' ? 3.8 : 3.2);
        if (p.kind === 'bomb') onEmit(c, (e) => { e.fillStyle = `rgba(255,200,90,${0.6 + Math.random() * 0.4})`; circle(e, -3.5, -2, 1.4); });
        break;
      }
      case 'fire':
        c.fillStyle = '#8a4a20'; circle(c, 0, 0, 3.2);
        onEmit(c, (e) => {
          e.fillStyle = 'rgba(255,140,40,.85)'; ell(e, -4, 0, 6, 3);
          e.fillStyle = 'rgba(255,230,150,.85)'; ell(e, -1, 0, 3, 1.6);
        });
        break;
      case 'nest':
        c.fillStyle = '#a8986a'; ell(c, 0, 0, 4.4, 3.8);
        c.strokeStyle = '#7a6a44'; c.lineWidth = 0.6; for (let k = -2; k <= 2; k += 2) line(c, -3.6, k, 3.6, k);
        break;
      case 'net': case 'rope': case 'bola':
        c.strokeStyle = '#c9b48a'; c.lineWidth = 1;
        c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.stroke();
        if (p.kind === 'net') { line(c, -5, 0, 5, 0); line(c, 0, -5, 0, 5); line(c, -3.5, -3.5, 3.5, 3.5); }
        if (p.kind === 'bola') { c.fillStyle = '#7a7468'; circle(c, 5, 0, 1.6); circle(c, -5, 0, 1.6); }
        break;
      case 'flash': c.fillStyle = '#3a3f46'; rr(c, -2.5, -2, 5, 4, 1); break;
      case 'plasma': case 'ion':
        onEmit(c, (e) => {
          const big = p.kind === 'ion' ? 2 : 1;
          const col = p.kind === 'ion' ? '150,190,255' : '120,255,220';
          const g = e.createLinearGradient(-16 * big, 0, 0, 0);
          g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},.9)`);
          e.strokeStyle = g; e.lineWidth = 2.4 * big; line(e, -16 * big, 0, 0, 0);
          const r = e.createRadialGradient(0, 0, 0, 0, 0, 5 * big);
          r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, `rgba(${col},.9)`); r.addColorStop(1, `rgba(${col},0)`);
          e.fillStyle = r; circle(e, 0, 0, 5 * big);
        });
        break;
      case 'acid':
        c.fillStyle = '#7ad82a'; ell(c, 0, 0, 3.4, 2.4);
        onEmit(c, (e) => { e.fillStyle = 'rgba(180,255,80,.5)'; ell(e, -3, 0, 5, 2.4); });
        break;
    }
    c.restore();
  }

  function drawFx(f) {
    const c = ctx;
    const e = ectx;
    const k = f.t / f.dur;
    switch (f.type) {
      case 'boom': {
        const r = f.r;
        if (k < 0.5) {
          e.save(); e.globalCompositeOperation = 'lighter';
          const g = e.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * (0.5 + k));
          g.addColorStop(0, `rgba(255,250,220,${0.95 * (1 - k * 2)})`);
          g.addColorStop(0.35, f.fire ? `rgba(255,140,40,${0.85 * (1 - k * 2)})` : `rgba(255,180,80,${0.85 * (1 - k * 2)})`);
          g.addColorStop(1, 'rgba(255,90,20,0)');
          e.fillStyle = g; circle(e, f.x, f.y, r * (0.5 + k));
          e.restore();
        }
        c.strokeStyle = `rgba(255,235,200,${0.5 * (1 - k)})`;
        c.lineWidth = 2 * (1 - k);
        c.beginPath(); c.ellipse(f.x, f.y + 4, r * (0.3 + k * 1.1), r * 0.18 * (0.3 + k * 1.1), 0, 0, Math.PI * 2); c.stroke();
        break;
      }
      case 'swarm':
        for (let i = 0; i < 18; i++) {
          const a = i * 2.4 + f.t * 9;
          const x = f.x + Math.cos(a) * f.r * 0.6 * Math.sin(i + f.t * 3), y = f.y - 16 + Math.sin(a * 1.3) * 12;
          c.fillStyle = 'rgba(30,22,8,.85)'; c.fillRect(x, y, 2, 1.4);
          c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x, y - 1, 1, 0.8);
        }
        break;
      case 'muzzle': {
        e.save(); e.globalCompositeOperation = 'lighter';
        const g = e.createRadialGradient(f.x, f.y, 0, f.x, f.y, 12);
        g.addColorStop(0, `rgba(255,230,160,${1 - k})`); g.addColorStop(1, 'rgba(255,140,40,0)');
        e.fillStyle = g; circle(e, f.x, f.y, 12);
        e.restore();
        break;
      }
      case 'slash':
        e.save();
        e.translate(f.x, f.y);
        e.scale(f.dir, 1);
        e.strokeStyle = `rgba(255,250,235,${0.8 * (1 - k)})`;
        e.lineWidth = 2.2 * (1 - k) + 0.4;
        e.beginPath(); e.arc(-4, 0, 11, -1.2 + k * 0.6, 0.6 + k * 0.6); e.stroke();
        e.restore();
        break;
      case 'ring':
        e.save();
        e.strokeStyle = f.col; e.globalAlpha = 1 - k; e.lineWidth = 2;
        e.beginPath(); e.ellipse(f.x, GROUND - 2, f.r * (0.3 + 0.7 * k), 8 * (0.3 + 0.7 * k), 0, 0, Math.PI * 2); e.stroke();
        e.globalAlpha = 0.15 * (1 - k);
        e.fillStyle = f.col; e.fill();
        e.restore();
        break;
      case 'flash': {
        e.save(); e.globalCompositeOperation = 'lighter';
        const g = e.createRadialGradient(f.x, f.y, 0, f.x, f.y, 44);
        g.addColorStop(0, `rgba(255,255,240,${0.95 * (1 - k)})`); g.addColorStop(1, 'rgba(255,255,240,0)');
        e.fillStyle = g; circle(e, f.x, f.y, 44);
        e.restore();
        break;
      }
      case 'jet': {
        const dir = DIR[f.team];
        const x = dir > 0 ? S.cam - 80 + k * (viewW + 160) : S.cam + viewW + 80 - k * (viewW + 160);
        c.save();
        c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1.5;
        line(c, x - dir * 26, 44, x - dir * 220, 44);
        c.translate(x, 44); c.scale(dir, 1);
        c.fillStyle = '#2a3038';
        poly(c, [[-24, -1], [14, -3], [26, 0.5], [14, 3], [-24, 3]]);
        c.fillStyle = '#1c2026';
        poly(c, [[-4, 1], [-16, 13], [-9, 13], [6, 1]]);
        poly(c, [[-21, 0], [-28, -9], [-23, -9], [-14, 0]]);
        c.fillStyle = '#7fa6c4'; poly(c, [[8, -2.5], [16, -2], [12, 0]]);
        onEmit(c, (em) => { em.fillStyle = 'rgba(255,170,80,.95)'; ell(em, -27, 1, 6 + Math.random() * 2, 1.8); });
        c.restore();
        break;
      }
    }
  }

  function drawParts() {
    const c = ctx;
    const e = ectx;
    e.save();
    e.globalCompositeOperation = 'lighter';
    for (const p of S.parts) {
      const k = 1 - p.life / p.max;
      switch (p.type) {
        case 'spark':
          e.strokeStyle = p.col; e.globalAlpha = Math.max(0, 1 - k); e.lineWidth = 1.2;
          line(e, p.x, p.y, p.x - p.vx * 0.025, p.y - p.vy * 0.025);
          e.globalAlpha = 1;
          break;
        case 'ember': case 'firefly': case 'spore': {
          const a = p.type === 'ember' ? 1 - k : (0.5 + 0.5 * Math.sin(S.t * (p.type === 'spore' ? 2 : 5) + p.seed)) * Math.sin(k * Math.PI);
          const rgb = p.type === 'firefly' ? '220,255,140' : p.type === 'spore' ? '120,255,220' : '255,190,90';
          const g = e.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.2);
          g.addColorStop(0, `rgba(${rgb},${a})`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          e.fillStyle = g; circle(e, p.x, p.y, p.size * 3.2);
          break;
        }
        case 'mote': {
          // Dust that catches the sun; it glows only in daylight.
          const a = Math.sin(k * Math.PI) * (0.25 + 0.75 * LIGHT.dayK);
          e.fillStyle = `rgba(255,236,190,${0.75 * a})`;
          circle(e, p.x, p.y, 0.8);
          break;
        }
        // Soft volumes go on the background layer so they are not outlined as solids.
        case 'smoke': {
          const a = p.alpha * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
          bgCtx.fillStyle = `rgba(${p.col},${Math.max(0, a)})`;
          circle(bgCtx, p.x, p.y, p.size * (1 + k * 1.8));
          break;
        }
        case 'dust':
          bgCtx.fillStyle = `rgba(${p.col},${0.45 * (1 - k)})`;
          circle(bgCtx, p.x, p.y, p.size * (1 + k * 1.5));
          break;
        case 'debris':
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.fillStyle = p.col; c.globalAlpha = Math.min(1, (1 - k) * 2);
          c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          c.restore();
          break;
        case 'casing':
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.fillStyle = '#d9b45a'; c.fillRect(-1, -0.5, 2, 1);
          c.restore();
          break;
        case 'leaf':
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.fillStyle = p.col; c.globalAlpha = Math.min(1, (1 - k) * 3);
          ell(c, 0, 0, 2.4, 1.1);
          c.restore();
          break;
        case 'ash':
          c.fillStyle = `rgba(70,64,58,${0.6 * Math.sin(k * Math.PI)})`;
          c.fillRect(p.x, p.y, 1.6, 1.2);
          break;
        case 'rain':
          c.strokeStyle = 'rgba(170,195,220,.35)'; c.lineWidth = 0.8;
          line(c, p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          break;
        case 'bubble':
          c.strokeStyle = `rgba(150,230,120,${0.8 * (1 - k)})`; c.lineWidth = 0.7;
          c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.stroke();
          break;
      }
    }
    e.restore();
  }

  function drawOverlay(fallback) {
    // Screen space: stronghold health, minimap and time of day.
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fallback) drawVignette();
    const pad = 10;
    const bw = Math.min(230, cssW * 0.32);
    for (let t = 0; t < 2; t++) {
      const b = S.sides[t].base;
      const x = t === 0 ? pad : cssW - pad - bw;
      const duelU = S.mode === 'duel' ? S.units.find((u) => u.team === t) : null;
      const k = duelU ? Math.max(0, duelU.hp / duelU.maxHp) : isFinite(b.maxHp) ? Math.max(0, b.hp / b.maxHp) : 1;
      c.fillStyle = 'rgba(14,10,7,.78)'; rr(c, x, pad, bw, 26, 4);
      c.strokeStyle = 'rgba(217,169,68,.35)'; c.lineWidth = 1; c.beginPath(); c.roundRect ? c.roundRect(x + 0.5, pad + 0.5, bw - 1, 25, 4) : c.rect(x + 0.5, pad + 0.5, bw - 1, 25); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.08)'; rr(c, x + 4, pad + 17, bw - 8, 5, 2.5);
      const g = c.createLinearGradient(x, 0, x + bw, 0);
      const low = k < 0.3;
      g.addColorStop(0, low ? '#ff7a52' : shade(TEAM_COL[t], 0.2)); g.addColorStop(1, low ? '#b8392c' : shade(TEAM_COL[t], -0.15));
      c.fillStyle = g;
      const bwid = (bw - 8) * k;
      if (t === 0) rr(c, x + 4, pad + 17, bwid, 5, 2.5);
      else rr(c, x + 4 + (bw - 8) - bwid, pad + 17, bwid, 5, 2.5);
      if (low && Math.sin(S.t * 8) > 0) { c.fillStyle = 'rgba(255,90,60,.25)'; rr(c, x, pad, bw, 26, 4); }
      c.fillStyle = '#efe4cf';
      c.font = '600 11px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif';
      c.textAlign = t === 0 ? 'left' : 'right';
      const label = duelU ? duelU.def.name : S.mode === 'attract' ? (t === 0 ? 'Left army' : 'Right army')
        : t === 1 && S.variant === 'survival' ? `The horde · Wave ${S.wave.n}` : (t === 0 ? 'Your stronghold' : 'Enemy stronghold');
      const hpText = duelU ? `${Math.max(0, Math.ceil(duelU.hp))}` : isFinite(b.hp) ? `${Math.max(0, Math.ceil(b.hp))}` : '∞';
      let text = duelU || (t === 1 && S.variant === 'survival') ? label : `${label} · ${ERAS[S.sides[t].era].name}`;
      if (c.measureText(text).width > bw - 48) text = label;
      if (c.measureText(text).width > bw - 48) text = S.mode === 'attract' ? (t === 0 ? 'Left' : 'Right') : (t === 0 ? 'You' : 'Enemy');
      c.fillText(text, t === 0 ? x + 6 : x + bw - 6, pad + 12);
      c.font = '500 10px "IBM Plex Mono", monospace';
      c.textAlign = t === 0 ? 'right' : 'left';
      c.fillStyle = '#c9b996';
      c.fillText(hpText, t === 0 ? x + bw - 6 : x + 6, pad + 12);
    }
    // Minimap
    let mw = Math.min(260, cssW - 2 * bw - 4 * pad);
    let my = pad + 6;
    if (mw < 120) { mw = Math.min(260, cssW - 2 * pad); my = pad + 32; }
    const mx = (cssW - mw) / 2, mh = 12;
    c.fillStyle = 'rgba(14,10,7,.78)'; rr(c, mx, my, mw, mh, 3);
    const k = mw / WORLD_W;
    c.fillStyle = TEAM_COL[0]; c.fillRect(mx + BASE_X[0] * k - 2, my + 2, 4, mh - 4);
    c.fillStyle = TEAM_COL[1]; c.fillRect(mx + BASE_X[1] * k - 2, my + 2, 4, mh - 4);
    for (const u of S.units) {
      if (u.dead) continue;
      c.fillStyle = TEAM_COL[u.team];
      c.fillRect(mx + u.x * k - 0.75, my + (u.def.hero ? 2 : 4), 1.5, u.def.hero ? mh - 4 : mh - 8);
    }
    c.strokeStyle = 'rgba(239,228,207,.9)'; c.lineWidth = 1;
    c.strokeRect(mx + S.cam * k + 0.5, my + 0.5, viewW * k - 1, mh - 1);
    S.mini = { x: mx, y: my, w: mw, h: mh };
    // Time of day
    const space = cssW - pad - bw - (mx + mw);
    const tx = space > 74 ? mx + mw + 12 : cssW / 2 - 22;
    const ty = space > 74 ? my + mh / 2 : my + mh + 12;
    const sun = LIGHT.label !== 'Night';
    c.fillStyle = sun ? (LIGHT.label === 'Day' ? '#f5d77a' : '#f0a05a') : '#cfdcef';
    circle(c, tx + 5, ty, 4.5);
    if (!sun) { c.fillStyle = 'rgba(14,10,7,.95)'; circle(c, tx + 7.2, ty - 1.6, 3.8); }
    c.font = '600 11px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif';
    c.textAlign = 'left';
    c.fillStyle = 'rgba(0,0,0,.55)'; c.fillText(LIGHT.label, tx + 14.5, ty + 4.5);
    c.fillStyle = '#efe4cf'; c.fillText(LIGHT.label, tx + 14, ty + 4);
  }

  function render() {
    if (!S) return;
    if (cv.width !== Math.round(cssW * dpr) || !cssW) resize();
    if (S.mode === 'attract' || S.mode === 'duel') {
      const fronts = S.units.filter((u) => !u.dead).map((u) => u.x);
      const mid = fronts.length ? (Math.min(...fronts) + Math.max(...fronts)) / 2 : WORLD_W / 2;
      S.cam += (mid - viewW / 2 - S.cam) * 0.02;
    }
    clampCam();
    const A = artOf();
    computeLight(A);
    const sh = S.paused ? 0 : S.shake;
    const sx = sh ? (Math.random() - 0.5) * sh : 0;
    const sy = sh ? (Math.random() - 0.5) * sh : 0;
    const k = res * scale;
    const T = [k, 0, 0, k, (-S.cam * scale + sx) * res, sy * res];
    for (const c2 of [bgCtx, fgCtx, emCtx]) {
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.globalAlpha = 1;
      c2.globalCompositeOperation = 'source-over';
    }
    fgCtx.clearRect(0, 0, fgC.width, fgC.height);
    emCtx.clearRect(0, 0, emC.width, emC.height);
    for (const c2 of [bgCtx, fgCtx, emCtx]) c2.setTransform(...T);

    ctx = bgCtx;
    drawBackground();
    for (const u of S.units) drawShadow(u);

    ctx = fgCtx;
    drawBase(S.sides[0]);
    drawBase(S.sides[1]);
    drawOrderLine();
    const dead = S.units.filter((u) => u.dead), alive = S.units.filter((u) => !u.dead);
    for (const u of dead) drawUnit(u);
    alive.sort((a, b) => (a.def.mounted ? 0 : 1) - (b.def.mounted ? 0 : 1));
    for (const u of alive) drawUnit(u);
    for (const p of S.projs) drawProj(p);
    drawParts();
    for (const f of S.fx) drawFx(f);
    drawForeground();
    emCtx.font = '600 11px "IBM Plex Mono", monospace';
    emCtx.textAlign = 'center';
    for (const x of S.texts) {
      emCtx.globalAlpha = 1 - x.t / 1.1;
      emCtx.fillStyle = x.col;
      emCtx.fillText(x.text, x.x, x.y);
    }
    emCtx.globalAlpha = 1;

    const useGL = GFX.ok && GFX.on;
    glCanvas.hidden = !useGL;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, cv.width, cv.height);
    if (useGL) {
      GFX.draw({
        ldir: [LIGHT.lx, LIGHT.ly], ground: (GROUND * scale + sy) / cssH, time: S.t, camx: S.cam, scale: k, shx: sx * res,
        light: LIGHT.light, rim: LIGHT.rim, fog: LIGHT.fog, tint: A.tint, rimK: LIGHT.rimK, fogK: LIGHT.fogK, wet: LIGHT.wet,
        rain: A.weather === 'rain' ? 1 : 0, bloom: 0.8 + 0.5 * LIGHT.nightK, night: LIGHT.nightK,
      });
    } else {
      // 2D fallback: dim the actors to the scene light, then stack the layers.
      const lum = (LIGHT.light[0] + LIGHT.light[1] + LIGHT.light[2]) / 3;
      if (lum < 0.98) {
        fgCtx.save();
        fgCtx.setTransform(1, 0, 0, 1, 0, 0);
        fgCtx.globalCompositeOperation = 'source-atop';
        fgCtx.fillStyle = `rgba(12,18,40,${Math.min(0.6, (1 - lum) * 0.9)})`;
        fgCtx.fillRect(0, 0, fgC.width, fgC.height);
        fgCtx.restore();
      }
      sctx.drawImage(bgC, 0, 0, cv.width, cv.height);
      sctx.drawImage(fgC, 0, 0, cv.width, cv.height);
      sctx.globalCompositeOperation = 'lighter';
      sctx.drawImage(emC, 0, 0, cv.width, cv.height);
      sctx.globalCompositeOperation = 'source-over';
    }
    ctx = sctx;
    drawOverlay(!useGL);
    ctx = fgCtx;
  }

  // ── Portraits ───────────────────────────────────────────────────────────
  function drawPortrait(canvas, def, team = 0) {
    const r = Math.min(2, window.devicePixelRatio || 1);
    const size = canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || 58;
    canvas.width = size * r;
    canvas.height = size * r;
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    const A = ART[def.era];
    const W = canvas.width, H = canvas.height;
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, shade(A.sky[1], -0.35)); bg.addColorStop(0.75, shade(A.sky[2], -0.45)); bg.addColorStop(1, shade(A.ground[1], -0.3));
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const glow = c.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.6);
    glow.addColorStop(0, def.hero ? 'rgba(230,184,78,.35)' : 'rgba(255,240,210,.16)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    c.fillStyle = shade(A.ground[0], -0.35); c.fillRect(0, H - 4 * r, W, 4 * r);
    const k = (size / (def.mounted ? 78 : 62)) * r;
    c.setTransform(k, 0, 0, k, W / 2 - 2 * k, H - 4 * r);
    c.fillStyle = 'rgba(0,0,0,.35)'; ell(c, 0, 0.5, def.mounted ? 20 : 10, 2.4);
    drawFigure(c, def, { walk: 0.6, swing: 0, weapon: def.normal.find((w) => w.slot === 'mid') || def.normal[0], teamCol: TEAM_COL[team] });
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  let tab = 'warriors';

  let bannerTimer = 0;
  function showBanner(title, sub) {
    const b = $('banner');
    b.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 1800);
  }
  let toastTimer = 0;
  function toast(msg) {
    if (!msg) return;
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
  }

  function powerBar(p, tier) {
    let s = `<span class="pw t-${tier}" aria-label="Power ${p} of 10">`;
    for (let i = 1; i <= 10; i++) s += `<i class="${i <= p ? 'on' : ''}"></i>`;
    return s + '</span>';
  }

  function weaponDetail(w) {
    if (w.slot === 'special') {
      const bits = [FX_TEXT[w.fx]];
      if (w.dmg) bits.push(`${Math.round(w.dmg)} dmg${w.n ? ` × ${w.n}` : ''}`);
      if (w.dot) bits.push(`${Math.round(w.dot)}/s for ${w.dotT} s`);
      bits.push(`every ${w.cd} s`);
      return bits.join(' · ');
    }
    const bits = [`${Math.round(w.dmg)} dmg`, `every ${+w.cd.toFixed(2)} s`, w.ranged ? `range ${w.range}` : `reach ${w.range}`];
    if (w.ammo != null) bits.push(`${w.ammo} throw${w.ammo > 1 ? 's' : ''}`);
    if (w.pierce >= 0.5) bits.push('armor-piercing');
    return bits.join(' · ');
  }

  function weaponRow(w) {
    return `<div class="wep"><div class="slot">${SLOT_LABEL[w.slot]}</div><div class="n">${esc(w.name)} <em class="tier t-${w.tier.id}">${w.tier.label}</em></div>${powerBar(w.power, w.tier.id)}<div class="d">${esc(weaponDetail(w))}</div></div>`;
  }

  function sheetHTML(def, full) {
    const isAdded = !def.show.startsWith('S');
    let h = `<div class="wname">${esc(def.name)}</div>
      <div class="wsub">${esc(def.roleInfo.label)} · ${esc(def.origin)}</div>
      <span class="record${isAdded ? ' added' : ''}">${esc(def.show)}</span>
      ${def.uniform ? `<p class="uni"><span>Uniform</span>${esc(def.uniform)}</p>` : ''}
      <div class="statrow"><div><span>HP</span>${def.hp}</div><div><span>Armor</span>${Math.round(def.armor * 100)}%</div><div><span>Speed</span>${Math.round(def.speed)}</div><div><span>Cost</span>${def.cost}</div></div>`;
    if (full !== false) {
      h += '<div class="weps">';
      for (const w of def.weapons) {
        h += weaponRow(w);
      }
      h += '</div>';
    }
    return h;
  }

  function buildCards() {
    hideTip();
    const box = $('cards');
    box.innerHTML = '';
    if (!S || S.mode !== 'play') return;
    const sd = S.sides[0];
    if (tab === 'warriors') {
      BY_ERA[sd.era].forEach((def, i) => {
        const card = el('div', 'card' + (def.hero ? ' hero' : ''));
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.dataset.id = def.id;
        card.innerHTML = `<canvas width="58" height="58"></canvas><span class="nm">${esc(def.name)}</span><span class="meta">${def.cost}</span><span class="role"><i class="gem t-${def.tier.id}" title="Best weapon: ${def.tier.label}"></i>${def.hero ? 'Hero' : def.roleInfo.label}</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}`;
        const info = el('button', 'info', 'i');
        info.title = `${def.name}: weapons and record`;
        info.setAttribute('aria-label', `${def.name} details`);
        info.addEventListener('click', (e) => { e.stopPropagation(); openCodex(def.era, def.id); });
        card.appendChild(info);
        const go = () => { Sound.init(); const err = recruit(sd, def); if (err) toast(err); else Sound.play('ui'); refreshHud(true); };
        card.addEventListener('click', go);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        card.addEventListener('mouseenter', () => showTip(card, def));
        card.addEventListener('mouseleave', hideTip);
        card.addEventListener('focus', () => showTip(card, def));
        card.addEventListener('blur', hideTip);
        box.appendChild(card);
        drawPortrait(card.querySelector('canvas'), def);
      });
    } else if (tab === 'armory') {
      for (const up of UPGRADES) {
        const lv = sd.up[up.id];
        const card = el('div', 'card turret upgrade');
        card.tabIndex = 0; card.setAttribute('role', 'button');
        const pips = Array.from({ length: UP_MAX }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
        const cost = lv >= UP_MAX ? 'Max' : upCost(sd, up);
        card.innerHTML = `<span class="nm">${esc(up.name)}</span><span class="pips" aria-label="Level ${lv} of ${UP_MAX}">${pips}</span><span class="meta">${cost}</span><span class="role">${esc(up.desc)}</span>`;
        if (lv < UP_MAX) card.dataset.cost = cost;
        const go = () => { const err = buyUpgrade(sd, up); if (err) toast(err); else Sound.play('ui'); buildCards(); };
        card.addEventListener('click', go);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        box.appendChild(card);
      }
    } else {
      const era = ERAS[sd.era];
      const b = sd.base;
      // Slots: build, upgrade, overdrive, sell
      for (let i = 0; i < MAX_SLOTS; i++) {
        const t = b.turrets[i];
        const card = el('div', 'card turret slotcard' + (t ? ' built' : ''));
        if (i >= b.slots) {
          if (i === b.slots) {
            card.innerHTML = `<span class="nm">Slot ${i + 1} · locked</span><span class="meta">${slotCost(sd)}</span><span class="role">Build a new tower slot on the stronghold</span><div class="acts"><button class="mini" data-act="slot">Build slot</button></div>`;
            card.dataset.cost = slotCost(sd);
          } else card.innerHTML = `<span class="nm">Slot ${i + 1} · locked</span><span class="role">Build slot ${i} first</span>`;
        } else if (!t) {
          card.innerHTML = `<span class="nm">Slot ${i + 1} · empty</span><span class="role">Pick a tower on the right to build it here</span>`;
        } else {
          const st = towerStats(sd, t);
          const pips = Array.from({ length: TOWER_MAX_LV }, (_, k) => `<i class="${k < t.level ? 'on' : ''}"></i>`).join('');
          const upc = t.level < TOWER_MAX_LV ? upgradeCost(t) : null;
          card.innerHTML = `<span class="nm">${esc(t.def.name)}</span><span class="pips">${pips}</span>
            <span class="role">${Math.round(st.dmg)} dmg · every ${st.cd.toFixed(2)} s · range ${Math.round(st.range)}${t.syn ? ' · <b class="syn">bonus active</b>' : ''}</span>
            <div class="acts">
              <button class="mini" data-act="up" ${upc == null ? 'disabled' : ''} ${upc != null ? `data-cost="${upc}"` : ''}>${upc == null ? 'Max level' : `Upgrade ${upc}`}</button>
              <button class="mini od" data-act="od" data-slot="${i}">Overdrive</button>
              <button class="mini" data-act="sell">Sell +${Math.round(t.spent * 0.5)}</button>
            </div>`;
        }
        card.querySelectorAll('button[data-act]').forEach((btn) => btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          const err = act === 'slot' ? buySlot(sd) : act === 'up' ? upgradeTurret(sd, i) : act === 'od' ? overdrive(sd, i) : sellTurret(sd, i);
          if (err) toast(err); else Sound.play(act === 'sell' ? 'coin' : 'ui');
          buildCards();
        }));
        box.appendChild(card);
      }
      box.appendChild(el('div', 'cardsep', 'Build'));
      // Tower shop for this era
      era.turrets.forEach((t) => {
        const card = el('div', 'card turret tower');
        card.tabIndex = 0; card.setAttribute('role', 'button');
        const dmg = Math.round(t.dmg0 * era.dmgMul);
        card.innerHTML = `<span class="nm">${esc(t.name)}</span><span class="meta">${t.cost}</span>
          <span class="role">${esc(t.culture)} · ${dmg} dmg${t.n ? ` × ${t.n}` : ''} every ${t.cd} s · range ${t.r}</span>
          <span class="role fx">${esc(TOWER_EFFECT(t))}</span>
          <span class="role by">+25% while ${esc(t.byNames.join(', '))} ${t.byNames.length > 1 ? 'fight' : 'fights'}</span>`;
        const go = () => { const err = buyTurret(sd, t); if (err) toast(err); else Sound.play('ui'); buildCards(); };
        card.addEventListener('click', go);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        card.dataset.cost = t.cost;
        box.appendChild(card);
      });
    }
    refreshHud(true);
  }

  function showTip(card, def) {
    if (matchMedia('(hover: none)').matches) return;
    const tip = $('tip');
    tip.innerHTML = sheetHTML(def);
    tip.hidden = false;
    const r = card.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(16, Math.min(window.innerWidth - tw - 16, x));
    let y = r.top - th - 8;
    if (y < 8) y = 8;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { $('tip').hidden = true; }

  let hudT = 0;
  function refreshHud(force) {
    if (!S) return;
    hudT -= 1;
    if (!force && hudT > 0) return;
    hudT = 6;
    const sd = S.sides[0];
    const era = ERAS[sd.era];
    $('gold').textContent = Math.floor(sd.gold);
    const next = ERAS[sd.era + 1];
    const xpbar = $('xpbar');
    if (next) {
      const prev = era.xp;
      const k = Math.max(0, Math.min(1, (sd.xp - prev) / (next.xp - prev)));
      $('xp').textContent = `${Math.floor(sd.xp)} / ${next.xp}`;
      xpbar.style.width = `${(sd.xp >= next.xp ? 1 : k) * 100}%`;
      xpbar.classList.toggle('full', sd.xp >= next.xp);
    } else {
      $('xp').textContent = `${Math.floor(sd.xp)}`;
      xpbar.style.width = '100%';
      xpbar.classList.add('full');
    }
    $('eraName').textContent = era.name;
    $('eraSpan').textContent = `Era ${sd.era + 1} of ${ERAS.length} · ${era.span}`;
    const ev = $('btnEvolve');
    ev.disabled = S.mode !== 'play' || !next || sd.xp < next.xp;
    ev.textContent = next ? `Evolve to ${next.name}` : 'Final era';
    $('abilityName').textContent = era.ability.name;
    const ab = $('btnAbility');
    ab.title = `${era.ability.desc} (Q)`;
    $('abilityCd').style.width = `${(1 - sd.abilityCd / era.ability.cd) * 100}%`;
    ab.classList.toggle('ready', sd.abilityCd <= 0);
    ab.disabled = S.mode !== 'play';
    $('btnPause').textContent = S.paused ? 'Resume' : 'Pause';
    document.querySelectorAll('#stance button').forEach((b) => b.classList.toggle('on', b.dataset.s === sd.stance));
    $('btnSpeed').textContent = `${S.speed}×`;

    const heroBusy = heroActive(sd);
    for (const card of document.querySelectorAll('#cards .card[data-id]')) {
      const def = DEF_BY_ID[card.dataset.id];
      card.classList.toggle('off', sd.gold < def.cost || sd.queue.length >= MAX_QUEUE || (def.hero && heroBusy));
    }
    for (const card of document.querySelectorAll('#cards .card[data-cost]')) card.classList.toggle('off', sd.gold < +card.dataset.cost);
    for (const btn of document.querySelectorAll('#cards button.mini[data-cost]')) btn.disabled = sd.gold < +btn.dataset.cost;
    for (const btn of document.querySelectorAll('#cards button.od')) {
      const t = sd.base.turrets[+btn.dataset.slot];
      if (!t) continue;
      btn.disabled = t.odCd > 0;
      btn.textContent = t.odT > 0 ? `Overdrive ${Math.ceil(t.odT)} s` : t.odCd > 0 ? `Ready in ${Math.ceil(t.odCd)} s` : 'Overdrive';
    }

    const q = $('queue');
    const key = sd.queue.map((d) => d.id).join(',');
    if (q.dataset.key !== key) {
      q.dataset.key = key;
      q.innerHTML = '';
      for (let i = 0; i < MAX_QUEUE; i++) {
        const s = el('div', 'qslot');
        if (sd.queue[i]) {
          const cnv = el('canvas');
          cnv.width = 30; cnv.height = 30;
          s.appendChild(cnv);
          s.appendChild(el('i'));
          s.title = sd.queue[i].name;
          q.appendChild(s);
          drawPortrait(cnv, sd.queue[i]);
        } else q.appendChild(s);
      }
    }
    const bar = q.querySelector('.qslot i');
    if (bar && sd.queue[0]) bar.style.width = `${(sd.trainT / sd.queue[0].train) * 100}%`;
  }

  // Codex
  let codexEra = 0;
  function openCodex(era = null, focusId = null) {
    if (era != null) codexEra = era;
    else if (S && S.mode === 'play') codexEra = S.sides[0].era;
    if (S && S.mode === 'play' && !S.over) { S.wasPaused = S.paused; S.paused = true; }
    $('codex').hidden = false;
    renderCodex(focusId);
  }
  function closeCodex() {
    $('codex').hidden = true;
    if (S && S.mode === 'play' && !S.over) S.paused = !!S.wasPaused;
  }
  function renderCodex(focusId) {
    const tabs = $('codexTabs');
    tabs.innerHTML = '';
    ERAS.forEach((e, i) => {
      const b = el('button', i === codexEra ? 'on' : '', esc(e.name));
      b.addEventListener('click', () => { codexEra = i; renderCodex(); });
      tabs.appendChild(b);
    });
    const E = ERAS[codexEra];
    const body = $('codexBody');
    body.scrollTop = 0;
    body.innerHTML = `<p class="eranote"><b>${esc(E.name)}</b> · ${esc(E.span)}. Unlocks at ${E.xp} experience. Stronghold: ${E.baseHp} HP. Power bars rate each weapon from 1 to 10. Damage climbs steeply with power, common weapons hit softer, and a warrior's price rises with the power of everything they carry.</p>`;
    const grid = el('div', 'entries');
    for (const def of BY_ERA[codexEra]) {
      const entry = el('div', 'entry');
      entry.id = 'cx-' + def.id;
      const cnv = el('canvas');
      cnv.width = 64; cnv.height = 64;
      entry.appendChild(cnv);
      const info = el('div', '', sheetHTML(def, false));
      entry.appendChild(info);
      const weps = el('div', 'weps');
      weps.innerHTML = def.weapons.map(weaponRow).join('');
      entry.appendChild(weps);
      grid.appendChild(entry);
      requestAnimationFrame(() => drawPortrait(cnv, def));
    }
    body.appendChild(grid);
    const arm = el('div', 'armory');
    arm.innerHTML = E.turrets.map((t) => `<div><b>${esc(t.name)}</b><br>Tower · ${esc(t.culture)} · ${t.cost} gold · ${Math.round(t.dmg0 * E.dmgMul)} dmg${t.n ? ` × ${t.n}` : ''} every ${t.cd} s · range ${t.r}<br>${esc(TOWER_EFFECT(t))}<br>+25% while ${esc(t.byNames.join(', '))} on the field</div>`).join('') +
      `<div><b>${esc(E.ability.name)}</b><br>Era attack · ${esc(E.ability.desc)} Recharges in ${E.ability.cd} s.</div>`;
    body.appendChild(arm);
    body.appendChild(el('p', 'note', 'Matchups come from Spike TV’s Deadliest Warrior (2009–2011). A win or loss is shown only where the episode result was confirmed against published episode guides. Loadouts follow the show where sources confirm them; the rest use each warrior’s historically documented weapons. Warriors marked “Added” never appeared on the show. Power ratings are game balance numbers based on each weapon’s reputation, not the show’s simulated kill counts. Episodes featuring terrorist groups, death squads and the Nazi SS are left out.'));
    if (focusId) {
      const t = $('cx-' + focusId);
      if (t) { t.classList.add('flash'); requestAnimationFrame(() => t.scrollIntoView({ block: 'center' })); }
    }
  }

  function showEnd() {
    if (S.variant === 'survival') {
      const waves = Math.max(0, S.wave.n - 1);
      $('endTitle').textContent = `${waves} wave${waves === 1 ? '' : 's'}`;
      $('endTitle').className = 'result win';
      $('endText').textContent = `Your stronghold falls to wave ${S.wave.n}. Best so far: ${REC.bestWave} waves survived.`;
      const p = S.sides[0];
      const m = Math.floor(S.t / 60), s2 = Math.floor(S.t % 60);
      $('endStats').innerHTML = [
        ['Time', `${m}:${String(s2).padStart(2, '0')}`], ['Era reached', `${p.era + 1} of ${ERAS.length}`], ['Enemies slain', p.kills],
        ['Warriors trained', p.trained], ['Best record', `${REC.bestWave} waves`], ['Difficulty', DIFF[difficulty].label],
      ].map(([k, v]) => `<div><span class="lbl">${k}</span><b>${v}</b></div>`).join('');
      $('end').hidden = false;
      renderRecords();
      return;
    }
    const win = S.winner === 0;
    $('endTitle').textContent = win ? 'Victory' : 'Defeat';
    $('endTitle').className = 'result ' + (win ? 'win' : 'loss');
    const p = S.sides[0];
    $('endText').textContent = win
      ? `The enemy stronghold falls in the ${ERAS[S.sides[1].era].name}. Your warriors held the field.`
      : `Your stronghold falls in the ${ERAS[p.era].name}. Regroup, evolve sooner, and build turrets before the next wave.`;
    const m = Math.floor(S.t / 60), s = Math.floor(S.t % 60);
    $('endStats').innerHTML = [
      ['Time', `${m}:${String(s).padStart(2, '0')}`], ['Era reached', `${p.era + 1} of ${ERAS.length}`], ['Enemies slain', p.kills],
      ['Warriors trained', p.trained], ['Warriors lost', p.lost], ['Difficulty', DIFF[difficulty].label],
    ].map(([k, v]) => `<div><span class="lbl">${k}</span><b>${v}</b></div>`).join('');
    $('end').hidden = false;
    renderRecords();
  }

  // Records line on the start screen and the achievements list.
  function renderRecords() {
    const got = ACH.filter((a) => REC.ach[a.id]).length;
    const wins = Object.values(REC.wins).reduce((a, b) => a + b, 0);
    $('records').innerHTML = `<span><b>${wins}</b> wins</span><span><b>${REC.bestWave}</b> best wave</span><span><b>${REC.kills}</b> enemies slain</span><span><b>${got}/${ACH.length}</b> achievements</span>`;
    $('achList').innerHTML = ACH.map((a) => `<div class="ach${REC.ach[a.id] ? ' got' : ''}"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span><em>${REC.ach[a.id] ? 'Unlocked' : 'Locked'}</em></div>`).join('');
  }

  // Simulator screen
  let simResult = null;
  function simOption(d) { return `<option value="${d.id}">${esc(d.name)}</option>`; }
  function initSim() {
    const opts = ERAS.map((e, i) => `<optgroup label="${esc(e.name)}">${BY_ERA[i].map(simOption).join('')}</optgroup>`).join('');
    $('simA').innerHTML = opts;
    $('simB').innerHTML = opts;
    $('simA').value = 'spartan';
    $('simB').value = 'ninja';
    const sync = () => { drawPortrait($('simCvA'), DEF_BY_ID[$('simA').value], 0); drawPortrait($('simCvB'), DEF_BY_ID[$('simB').value], 1); };
    $('simA').addEventListener('change', () => {
      // Load the show's matchup for this warrior when there is one.
      const d = DEF_BY_ID[$('simA').value];
      const m = /vs ([^·]+)/.exec(d.show);
      if (m) {
        const name = m[1].trim().toLowerCase();
        const foe = DEFS.find((x) => x.id !== d.id && (x.name.toLowerCase() === name || name.startsWith(x.name.toLowerCase()) || x.name.toLowerCase().startsWith(name.replace(/s$/, ''))));
        if (foe) $('simB').value = foe.id;
      }
      sync();
    });
    $('simB').addEventListener('change', sync);
    sync();
  }
  function openSim(keep) {
    $('start').hidden = true;
    $('end').hidden = true;
    $('sim').hidden = false;
    if (!keep) { newGame('attract'); }
    else if (S.mode === 'duel') newGame('attract');
    requestAnimationFrame(() => { drawPortrait($('simCvA'), DEF_BY_ID[$('simA').value], 0); drawPortrait($('simCvB'), DEF_BY_ID[$('simB').value], 1); });
    renderSim();
  }
  function renderSim(progress) {
    const out = $('simOut');
    if (progress != null && progress < 1) { out.innerHTML = `<p class="simprog">Simulating… ${Math.round(progress * 100)}%</p>`; return; }
    if (!simResult) { out.innerHTML = ''; return; }
    const r = simResult;
    const [wa, wb] = r.wins;
    const total = Math.max(1, wa + wb);
    const pa = Math.round((wa / total) * 100);
    const winner = wa === wb ? null : wa > wb ? r.a : r.b;
    const list = (w) => {
      const rows = Object.entries(w).sort((x, y) => y[1] - x[1]);
      const max = Math.max(1, ...rows.map((x) => x[1]));
      return rows.map(([n, v]) => `<div class="wk"><span>${esc(n)}</span><i style="width:${(v / max) * 100}%"></i><b>${v}</b></div>`).join('') || '<p class="wsub">No kills</p>';
    };
    out.innerHTML = `
      <div class="tally"><div><b>${wa}</b><span>${esc(r.a.name)}</span></div><div class="dash">–</div><div><b>${wb}</b><span>${esc(r.b.name)}</span></div></div>
      <div class="split"><i style="width:${pa}%"></i></div>
      <p class="verdict">${winner ? `Deadliest warrior: <b>${esc(winner.name)}</b>, winning ${Math.round((Math.max(wa, wb) / total) * 100)}% of ${r.n.toLocaleString()} battles` : `Dead even across ${r.n.toLocaleString()} battles`}${r.draws ? ` · ${r.draws} draws` : ''}.</p>
      <div class="kills"><div><h3>${esc(r.a.name)} kills by weapon</h3>${list(r.weapons[0])}</div><div><h3>${esc(r.b.name)} kills by weapon</h3>${list(r.weapons[1])}</div></div>`;
  }
  function runSim() {
    const a = DEF_BY_ID[$('simA').value], b = DEF_BY_ID[$('simB').value];
    if (a.id === b.id) { toast('Pick two different warriors'); return; }
    $('simRun').disabled = true;
    simulate(a, b, 1000, (res, prog) => {
      if (!res) { renderSim(prog); return; }
      simResult = res;
      REC.sims++;
      if (REC.sims >= 10) unlock('analyst');
      saveRec();
      $('simRun').disabled = false;
      renderSim();
    });
  }
  function watchDuel() {
    const a = DEF_BY_ID[$('simA').value], b = DEF_BY_ID[$('simB').value];
    if (a.id === b.id) { toast('Pick two different warriors'); return; }
    $('sim').hidden = true;
    newGame('duel');
    S.sides[0].era = S.sides[1].era = a.era;
    S.tod = 0.4;
    spawnUnit(makeDef(a.raw, SIM_ERA, true), 0, 640);
    spawnUnit(makeDef(b.raw, SIM_ERA, true), 1, 860);
    S.cam = 750 - viewW / 2;
    showBanner(`${a.name} vs ${b.name}`, 'One duel at equal strength');
  }

  function startGame() {
    if (variant === 'simulator') { openSim(false); return; }
    Sound.init();
    $('start').hidden = true;
    $('end').hidden = true;
    newGame('play');
    resize();
    S.cam = 0;
    tab = 'warriors';
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    buildCards();
    showBanner(S.variant === 'survival' ? 'Survival' : ERAS[0].name, S.variant === 'survival' ? 'Hold out against endless waves' : ERAS[0].span);
  }

  function toMenu() {
    $('end').hidden = true;
    $('sim').hidden = true;
    $('start').hidden = false;
    renderRecords();
    newGame('attract');
    buildCards();
    refreshHud(true);
  }

  // ── Input ───────────────────────────────────────────────────────────────
  $('btnStart').addEventListener('click', startGame);
  $('btnAgain').addEventListener('click', startGame);
  $('simRun').addEventListener('click', runSim);
  $('simWatch').addEventListener('click', watchDuel);
  $('simClose').addEventListener('click', toMenu);
  $('btnAch').addEventListener('click', () => { renderRecords(); $('ach').hidden = false; });
  $('achClose').addEventListener('click', () => { $('ach').hidden = true; });
  document.querySelectorAll('#stance button').forEach((b) => b.addEventListener('click', () => {
    if (!S || S.mode !== 'play') return;
    setStance(S.sides[0], b.dataset.s);
    refreshHud(true);
  }));
  const MODE_NOTE = {
    skirmish: 'Destroy the enemy stronghold before it destroys yours.',
    survival: 'Endless waves that grow and advance through the eras. How long can you hold?',
    simulator: 'Pick two warriors and run 1,000 simulated duels, like the show.',
  };
  document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => {
    variant = b.dataset.m;
    document.querySelectorAll('#modeSeg button').forEach((x) => x.classList.toggle('on', x === b));
    $('modeNote').textContent = MODE_NOTE[variant];
    $('btnStart').textContent = variant === 'simulator' ? 'Open the simulator' : 'To battle';
    $('diffRow').hidden = variant === 'simulator';
  }));
  $('btnMenu').addEventListener('click', toMenu);
  $('btnCodex').addEventListener('click', () => openCodex());
  $('btnCodex2').addEventListener('click', () => openCodex(0));
  $('codexClose').addEventListener('click', closeCodex);
  $('codex').addEventListener('click', (e) => { if (e.target.id === 'codex') closeCodex(); });
  $('btnEvolve').addEventListener('click', () => { const err = evolve(S.sides[0]); if (err) toast(err); refreshHud(true); });
  $('btnAbility').addEventListener('click', () => { const err = useAbility(S.sides[0]); if (err) toast(err); refreshHud(true); });
  $('btnPause').addEventListener('click', () => { if (S.mode === 'play') { S.paused = !S.paused; refreshHud(true); } });
  $('btnSpeed').addEventListener('click', () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; refreshHud(true); });
  const gfxLabel = () => { $('btnGfx').textContent = !GFX.ok ? 'Effects: basic' : GFX.on ? 'Effects: high' : 'Effects: low'; };
  gfxLabel();
  $('btnGfx').addEventListener('click', () => {
    if (!GFX.ok) { toast('This browser does not support the WebGL2 effects pipeline'); return; }
    GFX.on = !GFX.on;
    try { localStorage.setItem('aow-effects', GFX.on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    gfxLabel();
  });
  $('btnSound').addEventListener('click', () => {
    Sound.init();
    Sound.on = !Sound.on;
    if (Sound.ac && Sound.ac.state === 'suspended') Sound.ac.resume();
    $('btnSound').textContent = Sound.on ? 'Sound on' : 'Sound off';
    Sound.play('ui');
  });
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    buildCards();
  }));
  document.querySelectorAll('#diff button').forEach((b) => b.addEventListener('click', () => {
    difficulty = b.dataset.d;
    document.querySelectorAll('#diff button').forEach((x) => x.classList.toggle('on', x === b));
  }));

  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    keys[e.key] = true;
    if (e.key === 'Escape' && !$('codex').hidden) { closeCodex(); return; }
    if (e.key === 'Escape' && !$('ach').hidden) { $('ach').hidden = true; return; }
    if (!S || S.mode !== 'play' || S.over || !$('codex').hidden) return;
    const sd = S.sides[0];
    if (/^[1-9]$/.test(e.key)) {
      const def = BY_ERA[sd.era][+e.key - 1];
      if (def) { const err = recruit(sd, def); if (err) toast(err); else Sound.play('ui'); refreshHud(true); }
    } else if (e.key === 'q' || e.key === 'Q') { const err = useAbility(sd); if (err) toast(err); }
    else if (e.key === 'e' || e.key === 'E') { const err = evolve(sd); if (err) toast(err); }
    else if (e.key === 'p' || e.key === 'P') { S.paused = !S.paused; refreshHud(true); }
    else if (e.key === 't' || e.key === 'T') {
      let n = 0;
      sd.base.turrets.forEach((t, i) => { if (t && t.odCd <= 0) { overdrive(sd, i); n++; } });
      if (!n) toast('No tower is ready to overdrive');
      if (tab === 'turrets') buildCards();
    }
    else if (e.key === 'c' || e.key === 'C') { setStance(sd, 'advance'); refreshHud(true); }
    else if (e.key === 'h' || e.key === 'H') { setStance(sd, 'hold'); refreshHud(true); }
    else if (e.key === 'f' || e.key === 'F') { setStance(sd, 'retreat'); refreshHud(true); }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  let drag = null, mouseX = -1;
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (S.mini && x >= S.mini.x && x <= S.mini.x + S.mini.w && y >= S.mini.y - 4 && y <= S.mini.y + S.mini.h + 4) {
      S.cam = (x - S.mini.x) / S.mini.w * WORLD_W - viewW / 2;
      clampCam();
      return;
    }
    if (S.mode === 'play' && !S.over) {
      const wx = S.cam + x / scale, wy = y / scale;
      const b = S.sides[0].base;
      for (let i = 0; i < MAX_SLOTS; i++) {
        if (!b.turrets[i]) continue;
        const p = turretPos(0, i);
        if (Math.abs(wx - p.x) < 16 && Math.abs(wy - (p.y - 4)) < 13) {
          const err = overdrive(S.sides[0], i);
          if (err) toast(err);
          if (tab === 'turrets') buildCards();
          return;
        }
      }
    }
    drag = { x: e.clientX, cam: S.cam };
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    mouseX = e.pointerType === 'mouse' ? e.clientX - r.left : -1;
    if (!drag) return;
    S.cam = drag.cam - (e.clientX - drag.x) / scale;
    clampCam();
  });
  const endDrag = () => { drag = null; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', () => { mouseX = -1; });
  cv.addEventListener('wheel', (e) => {
    S.cam += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / scale;
    clampCam();
    e.preventDefault();
  }, { passive: false });

  function panInput(dt) {
    if (!S || S.mode !== 'play') return;
    let v = 0;
    if (keys.ArrowLeft || keys.a || keys.A) v -= 1;
    if (keys.ArrowRight || keys.d || keys.D) v += 1;
    if (!drag && mouseX >= 0) {
      if (mouseX < 36) v -= 1;
      else if (mouseX > cssW - 36) v += 1;
    }
    if (v) { S.cam += v * 520 * dt; clampCam(); }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S && S.mode === 'play' && !S.over && !S.paused) { S.paused = true; refreshHud(true); }
  });
  window.addEventListener('resize', () => { resize(); });
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv);

  // ── Boot ────────────────────────────────────────────────────────────────
  $('eraList').innerHTML = ERAS.map((e) => `<span>${esc(e.name)}</span>`).join('');
  const total = DEFS.length;
  const shown = DEFS.filter((d) => /^S\d/.test(d.show)).length;
  $('lede').textContent = `Command ${total} warriors across ${ERAS.length} eras: ${shown} from Deadliest Warrior, the Aztec, Maya and Inca armies, the soldiers of history's great commanders, and an alien invasion. Every era fights on its own battlefield, from the Colosseum to an alien world. Each warrior picks the right weapon for the range, from the show's short, mid, long and special slots. Research upgrades, raise veterans, give battle orders, survive endless waves, or settle the old arguments in the Deadliest Warrior simulator.`;

  newGame('attract');
  resize();
  refreshHud(true);
  initSim();
  renderRecords();

  let last = performance.now();
  const perf = { t: 0, n: 0, checked: false };
  function frame(now) {
    const ft = (now - last) / 1000;
    if (GFX.ok && GFX.on && !perf.checked && S.mode === 'play' && !S.paused && document.visibilityState === 'visible') {
      perf.t += ft; perf.n++;
      if (perf.t > 4) {
        perf.checked = true;
        if (perf.n / perf.t < 24) {
          GFX.on = false;
          if (typeof gfxLabel === 'function') gfxLabel();
          toast('Effects lowered for smoother play. Turn them back on with the Effects button.');
        }
      }
    }
    const raw = Math.min(0.05, ft);
    last = now;
    panInput(raw);
    const steps = S.mode === 'play' ? S.speed : 1;
    for (let i = 0; i < steps; i++) update(raw);
    render();
    if (S.mode === 'play') refreshHud(false);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hook for automated play-throughs.
  window.__aow = {
    get state() { return S; }, DEFS, drawPortrait, BY_ERA, ERAS, recruit, evolve, useAbility, buyTurret, buySlot, update, newGame, startGame,
    setDifficulty(d) { difficulty = d; },
    setVariant(v) { variant = v; }, simulate, buyUpgrade, UPGRADES, setStance, REC, upgradeTurret, overdrive, sellTurret, towerStats,
  };
})();
