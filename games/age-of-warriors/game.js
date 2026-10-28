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
  const SLOT_COST = [0, 140, 380];
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
  // Damage comes from the 1–10 power rating, the slot and the era.
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
  const LONG_RANGE = { arrow: 230, bolt: 240, javelin: 165, stone: 200, dart: 210, star: 140, bullet: 270, rocket: 250 };
  const LONG_CD = { arrow: 1.6, bolt: 2.0, javelin: 1.8, stone: 1.5, dart: 1.6, star: 1.0, bullet: 1.5, rocket: 2.2 };
  const PROJ_SPEED = { bullet: 950, arrow: 430, bolt: 520, javelin: 340, stone: 380, dart: 400, star: 380, rocket: 380, bomb: 300, fire: 320, nest: 300, net: 300, rope: 360, bola: 360, flash: 330, shell: 460, stake: 320 };

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
    if (slot === 'special') return buildSpecial(w, o, mul, era);
    w.ranged = RANGED.has(kind);
    let cd0, base;
    if (w.ranged) {
      w.proj = o.proj || projOf(kind, n);
      const sniper = /sniper|psg|vintorez|mk 11|long rifle|dragunov|\bm24/.test(n);
      if (slot === 'long') {
        w.range = o.r || (sniper ? 340 : kind === 'pistol' ? 160 : LONG_RANGE[w.proj]);
        cd0 = sniper ? 2.2 : kind === 'pistol' ? 1.2 : LONG_CD[w.proj];
        base = power * 3.0;
      } else {
        w.range = o.r || (slot === 'mid' ? 95 : 70);
        cd0 = 1.2;
        base = power * 3.4;
      }
      if (w.proj === 'bullet' && !w.pierce) w.pierce = 0.3;
    } else {
      w.range = o.r || (slot === 'short' ? 24 : 42);
      cd0 = slot === 'short' ? 0.75 : 1.05;
      base = power * (slot === 'short' ? 2.6 : 3.6);
    }
    w.cd = o.cd || cd0;
    w.dmg = base * Math.pow(w.cd / cd0, 0.75) * mul;
    return w;
  }

  function buildSpecial(w, o, mul, era) {
    const p = w.power;
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
  const DEFS = DATA.warriors.map((raw) => {
    const role = ROLE[raw.role];
    const era = ERAS[raw.era];
    const weapons = raw.weapons.map((t) => buildWeapon(t, raw.era));
    const normal = weapons.filter((w) => w.slot !== 'special');
    const special = weapons.find((w) => w.slot === 'special') || null;
    const avgP = raw.weapons.reduce((s, t) => s + t[2], 0) / raw.weapons.length;
    const mounted = !!raw.look.mounted;
    const melee = normal.filter((w) => !w.ranged);
    return {
      ...raw,
      roleInfo: role,
      weapons, normal, special,
      hero: raw.role === 'hero',
      mounted,
      hp: Math.round(role.hp * era.hpMul * (raw.hpMul || 1) * (mounted ? 1.15 : 1)),
      armor: raw.armor ?? role.armor,
      speed: role.speed * (raw.speed || 1) * (mounted && raw.role === 'hero' ? 1.15 : 1),
      cost: Math.round(role.cost * (0.7 + (avgP * 4) / 90) * era.costMul * (mounted ? 1.1 : 1)),
      train: role.train,
      reach: melee.length ? Math.max(...melee.map((w) => w.range)) : 26,
    };
  });
  const DEF_BY_ID = Object.fromEntries(DEFS.map((d) => [d.id, d]));
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

  function newBase(team) {
    return { isBase: true, team, x: BASE_X[team], hp: ERAS[0].baseHp, maxHp: ERAS[0].baseHp, slots: 1, turrets: [null, null, null], flash: 0 };
  }
  function newSide(team, ai) {
    return { team, ai, gold: 180, xp: 0, era: 0, queue: [], trainT: 0, abilityCd: 12, base: newBase(team), kills: 0, lost: 0, trained: 0, aiT: 1.5, dmgDealt: 0 };
  }
  function newGame(mode) {
    S = {
      mode, t: 0, over: false, winner: -1, paused: false, speed: 1,
      sides: [newSide(0, mode === 'attract'), newSide(1, true)],
      units: [], projs: [], fx: [], texts: [], teams: [[], []],
      cam: mode === 'attract' ? WORLD_W / 2 : 0, endT: 0, uid: 0,
    };
    if (mode === 'attract') { S.sides[0].gold = 400; S.sides[1].gold = 400; }
  }

  const sideOf = (team) => S.sides[team];
  const diffOf = () => DIFF[difficulty];
  const heroActive = (sd) => S.units.some((u) => !u.dead && u.team === sd.team && u.def.hero) || sd.queue.some((d) => d.hero);
  const slotCost = (sd) => Math.round(SLOT_COST[sd.base.slots] * ERAS[sd.era].costMul);

  function spawnUnit(def, team) {
    const u = {
      id: ++S.uid, def, team, x: spawnX(team), hp: def.hp, maxHp: def.hp, armor: def.armor,
      cd: 0.2, specCd: 1 + Math.random() * 2, ammo: def.normal.map((w) => w.ammo ?? Infinity),
      stunT: 0, shieldT: 0, rallyT: 0, pauseT: 0, chargeT: 0, flash: 0, dots: [],
      walk: Math.random() * 6, swing: 0, swingW: null, weapon: def.normal[0], dead: false, deathT: 0, burst: null,
    };
    S.units.push(u);
    sideOf(team).trained++;
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
    b.maxHp = next.baseHp;
    b.hp = Math.min(b.maxHp, ratio * b.maxHp + 0.2 * b.maxHp);
    if (sd.team === 0 && S.mode === 'play') {
      showBanner(next.name, next.span);
      Sound.play('evolve');
      buildCards();
    }
    return null;
  }

  function buyTurret(sd, tdef) {
    const b = sd.base;
    let slot = -1;
    for (let i = 0; i < b.slots; i++) if (!b.turrets[i]) { slot = i; break; }
    if (slot < 0) return b.slots < 3 ? 'No empty slot. Build another turret slot first' : 'All three turret slots are full. Sell one first';
    if (sd.gold < tdef.cost) return `Not enough gold: ${tdef.name} costs ${tdef.cost}`;
    sd.gold -= tdef.cost;
    b.turrets[slot] = { def: tdef, era: sd.era, cd: 0.5, angle: 0, dmg: tdef.power * 3.2 * ERAS[sd.era].dmgMul, flashT: 0 };
    return null;
  }
  function buySlot(sd) {
    const b = sd.base;
    if (b.slots >= 3) return 'The stronghold already has three turret slots';
    const c = slotCost(sd);
    if (sd.gold < c) return `Not enough gold: a new slot costs ${c}`;
    sd.gold -= c;
    b.slots++;
    return null;
  }
  function sellTurret(sd) {
    const b = sd.base;
    for (let i = 2; i >= 0; i--) {
      if (b.turrets[i]) {
        sd.gold += Math.round(b.turrets[i].def.cost * 0.5);
        b.turrets[i] = null;
        return null;
      }
    }
    return 'No turret to sell';
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
    let m = u.rallyT > 0 ? 1.3 : 1;
    if (!u.def.hero && S.heroes[u.team].some((h) => Math.abs(h.x - u.x) < 130)) m *= 1.15;
    return m;
  }

  function damage(target, amount, team, pierce = 0) {
    if (!target || amount <= 0) return;
    if (target.isBase) {
      target.hp -= amount;
      target.flash = 0.12;
      const sd = sideOf(team);
      sd.xp += amount * 0.05 * (sd.ai ? diffOf().xp : 1);
      sd.dmgDealt += amount;
      Sound.play('base');
      if (target.hp <= 0 && !S.over) endGame(team);
      return;
    }
    if (target.dead) return;
    let d = amount * (1 - target.armor * (1 - pierce));
    if (target.shieldT > 0) d *= 0.45;
    target.hp -= d;
    target.flash = 0.1;
    if (target.hp <= 0) kill(target, team);
  }

  function kill(u, killerTeam) {
    u.dead = true;
    u.deathT = 0;
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
      x: sx, y: sy, px: sx, py: sy,
    });
    Sound.play(kind === 'bullet' ? 'shot' : kind === 'arrow' || kind === 'bolt' ? 'bow' : 'melee');
  }

  function attack(u, w, i, target) {
    if (w.ammo != null) u.ammo[i]--;
    u.swing = 1;
    u.swingW = w;
    const m = buffMul(u);
    if (w.ranged) {
      spawnProj(u, target, { kind: w.proj, dmg: w.dmg * m, pierce: w.pierce });
      if (w.proj === 'bullet') S.fx.push({ type: 'muzzle', x: u.x + DIR[u.team] * 22, y: GROUND - (u.def.mounted ? 52 : 33), t: 0, dur: 0.08 });
    } else {
      damage(target, w.dmg * m, u.team, w.pierce);
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
        if (sp.proj) spawnProj(u, target, { kind: sp.proj, dmg: sp.dmg * m, stun: sp.stun, aoe: sp.aoe || 0 });
        else { damage(target, sp.dmg * m, u.team, 0.3); stun(target, sp.stun); }
        u.swing = 1; u.swingW = sp;
        return true;
      case 'charge':
        if (dist > sp.r || dist < 34) return false;
        u.chargeT = 0.5; u.chargeDmg = sp.dmg * m;
        return true;
      case 'splash': case 'fire': case 'hornets': case 'poison': case 'snipe':
        if (dist > sp.r || (sp.aoe && dist < 26)) return false;
        spawnProj(u, target, { kind: sp.proj, dmg: sp.dmg * m, aoe: sp.aoe || 0, dot: sp.dot || 0, dotT: sp.dotT || 0, pierce: sp.pierce || 0 });
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
          if (Math.abs(e.x - u.x) < sp.aoe) { damage(e, sp.dmg * m, u.team, 0.3); stun(e, sp.stun); }
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
    u.swing = Math.max(0, u.swing - dt * 3.2);
    if (u.dots.length) {
      for (const d of u.dots) { d.t -= dt; damage(u, d.dps * dt, d.team, 1); }
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
        damage(target, u.chargeDmg, u.team, 0.4);
        if (!target.isBase && !target.dead) {
          target.x += dir * 26;
          target.x = Math.max(spawnX(0), Math.min(spawnX(1), target.x));
          stun(target, 0.6);
        }
        S.fx.push({ type: 'dust', x: u.x + dir * 14, y: GROUND - 6, t: 0, dur: 0.5 });
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
          if (dist <= b.sp.r + 6) { damage(target, b.sp.dmg * m, u.team, 0.2); Sound.play('melee'); }
          b.t = 0.15;
        } else {
          spawnProj(u, target, { kind: b.sp.proj, dmg: b.sp.dmg * m, pierce: 0.3 });
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
    if (wantMove && gap > space) {
      const sp = def.speed * (u.rallyT > 0 ? 1.3 : 1) * dt;
      u.x += dir * Math.min(sp, Math.max(0, dist - hold), gap - space);
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
    sd.trainT = Math.min(def.train, sd.trainT + dt);
    if (sd.trainT >= def.train) {
      const sx = spawnX(sd.team);
      const blocked = S.units.some((u) => !u.dead && u.team === sd.team && Math.abs(u.x - sx) < (def.mounted || u.def.mounted ? 34 : 22));
      if (!blocked) { spawnUnit(def, sd.team); sd.queue.shift(); sd.trainT = 0; }
    }
  }

  const turretPos = (team, i) => ({ x: BASE_X[team] + DIR[team] * 26, y: GROUND - 112 + i * 27 });

  function updateTurrets(sd, dt) {
    const b = sd.base;
    const foes = S.teams[1 - sd.team];
    for (let i = 0; i < 3; i++) {
      const t = b.turrets[i];
      if (!t) continue;
      t.cd -= dt;
      t.flashT = Math.max(0, t.flashT - dt);
      const p = turretPos(sd.team, i);
      let tgt = null, best = Infinity;
      for (const e of foes) {
        const d = Math.abs(e.x - p.x);
        if (d < t.def.r && d < best) { best = d; tgt = e; }
      }
      if (!tgt) continue;
      t.angle = Math.atan2(GROUND - 30 - p.y, (tgt.x - p.x) * DIR[sd.team]);
      if (t.cd <= 0) {
        t.cd = t.def.cd;
        t.flashT = 0.1;
        const kind = t.def.proj;
        const dist = Math.abs(tgt.x - p.x);
        S.projs.push({
          team: sd.team, kind, sx: p.x, sy: p.y, tx: tgt.x, ty: GROUND - 30, target: tgt, t: 0,
          dur: Math.max(0.1, dist / (PROJ_SPEED[kind] || 400)), arc: kind === 'bullet' ? 0 : dist * (t.def.aoe ? 0.2 : 0.08),
          dmg: t.dmg, pierce: t.def.pierce || 0, aoe: t.def.aoe || 0, dot: t.def.dot ? t.dmg * 0.4 : 0, dotT: t.def.dot ? 4 : 0, stun: 0,
          x: p.x, y: p.y, px: p.x, py: p.y,
        });
        Sound.play(kind === 'bullet' ? 'shot' : 'bow');
      }
    }
  }

  function impact(p) {
    const foes = S.teams[1 - p.team];
    const foeBase = sideOf(1 - p.team).base;
    const hitUnit = (e, scale = 1) => {
      damage(e, p.dmg * scale, p.team, p.pierce);
      if (p.dot && !e.dead) e.dots.push({ dps: p.dot, t: p.dotT, team: p.team, kind: p.kind });
      if (p.stun && !e.dead) stun(e, p.stun);
    };
    if (p.aoe) {
      for (const e of foes) if (Math.abs(e.x - p.tx) < p.aoe) hitUnit(e);
      if (Math.abs(baseEdge(foeBase.team) - p.tx) < p.aoe + 10) damage(foeBase, p.dmg * 0.6, p.team);
      const fire = p.kind === 'fire';
      const hornets = p.kind === 'nest';
      S.fx.push({ type: hornets ? 'swarm' : 'boom', x: p.tx, y: GROUND - 8, r: p.aoe, t: 0, dur: hornets ? 1.4 : 0.6, fire });
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
    if (!tgt) { S.fx.push({ type: 'dust', x: p.tx, y: GROUND - 2, t: 0, dur: 0.4 }); return; }
    if (tgt.isBase) damage(tgt, p.dmg, p.team, p.pierce);
    else hitUnit(tgt);
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
    if (Math.random() < 0.3) {
      if (emptySlot) {
        const t = era.turrets[Math.random() < 0.5 ? 0 : 1];
        if (sd.gold > t.cost * 1.7) { buyTurret(sd, t); return; }
      } else if (b.slots < 3 && sd.gold > slotCost(sd) * 3) { buySlot(sd); return; }
      else if (!emptySlot) {
        const old = b.turrets.findIndex((t) => t && t.era < sd.era);
        if (old >= 0 && sd.gold > era.turrets[1].cost * 2) { b.turrets[old] = null; return; }
      }
    }

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
      sd.gold += INCOME * era.costMul * dt * mult;
      sd.abilityCd = Math.max(0, sd.abilityCd - dt);
      sd.base.flash = Math.max(0, sd.base.flash - dt);
      updateTraining(sd, dt);
      updateTurrets(sd, dt);
      if (sd.ai) aiThink(sd, dt);
    }
    for (const u of S.units) updateUnit(u, dt);
    S.units = S.units.filter((u) => !(u.dead && u.deathT > 1.6));
    updateProjs(dt);
    updateFx(dt);
  }

  function updateFx(dt) {
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
    Sound.play('boom');
    const game = S;
    if (S.mode === 'play') setTimeout(() => { if (S === game) showEnd(); }, 1400);
  }

  // ── Rendering ───────────────────────────────────────────────────────────
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, viewW = 0;

  function resize() {
    const r = cv.getBoundingClientRect();
    cssW = Math.max(1, r.width);
    cssH = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    scale = cssH / WORLD_H;
    if (cssW / scale > WORLD_W) scale = cssW / WORLD_W;
    viewW = cssW / scale;
  }

  const clampCam = () => {
    S.cam = Math.max(0, Math.min(WORLD_W - viewW, S.cam));
  };

  function line(c, x0, y0, x1, y1) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); c.fill(); }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); }
  function dome(c, col, X, Y, r = 6.6, cut = 0.2) { c.fillStyle = col; c.beginPath(); c.arc(X, Y, r, Math.PI + cut, -cut); c.closePath(); c.fill(); }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // Seeded value noise for terrain.
  const hillY = (x, seed, freq) => Math.sin(x * freq + seed) * 0.5 + Math.sin(x * freq * 2.3 + seed * 1.7) * 0.3 + Math.sin(x * freq * 5.1 + seed * 0.3) * 0.2;

  function drawBackground(era) {
    const E = ERAS[era];
    const c = ctx;
    const left = S.cam - 10, right = S.cam + viewW + 10;
    const g = c.createLinearGradient(0, 0, 0, GROUND);
    g.addColorStop(0, E.sky[0]);
    g.addColorStop(1, E.sky[1]);
    c.fillStyle = g;
    c.fillRect(left, 0, right - left, GROUND + 2);

    // Sun or moon, fixed to the view.
    const sx = S.cam + viewW * 0.78, sy = era === 4 ? 46 : 70;
    c.fillStyle = era === 4 ? 'rgba(235,240,245,.85)' : 'rgba(255,240,200,.7)';
    c.beginPath(); c.arc(sx, sy, era === 4 ? 14 : 24, 0, Math.PI * 2); c.fill();
    if (era === 4) {
      c.fillStyle = 'rgba(255,255,255,.6)';
      for (let i = 0; i < 40; i++) c.fillRect(left + ((i * 211) % 1000) / 1000 * (right - left), (i * 53) % 150, 1.2, 1.2);
    }
    // Clouds
    c.fillStyle = era === 4 ? 'rgba(120,140,160,.18)' : 'rgba(255,255,255,.28)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 330 + S.t * 6) % (WORLD_W + 400)) - 200;
      const px = cx * 0.7 + S.cam * 0.3;
      ell(c, px, 40 + (i % 3) * 22, 46, 9);
      ell(c, px + 26, 34 + (i % 3) * 22, 30, 8);
    }

    // Far hills with parallax.
    const layer = (par, y0, amp, freq, seed, col) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(left, GROUND);
      for (let x = left; x <= right; x += 8) {
        const wx = x - S.cam * par;
        c.lineTo(x, y0 - amp * hillY(wx, seed, freq));
      }
      c.lineTo(right, GROUND);
      c.closePath();
      c.fill();
    };
    layer(0.6, GROUND - 90, 26, 0.006, era * 3 + 1, E.far);
    drawLandmarks(era, 0.6);
    layer(0.35, GROUND - 40, 16, 0.011, era * 5 + 2, E.near);

    // Ground
    c.fillStyle = E.ground;
    c.fillRect(left, GROUND, right - left, WORLD_H - GROUND + 40);
    c.fillStyle = E.dirt;
    c.fillRect(left, GROUND, right - left, 3);
    for (let i = 0; i < 160; i++) {
      const x = (i * 97.3) % WORLD_W;
      const y = GROUND + 8 + ((i * 31) % 46);
      c.fillRect(x, y, 3 + (i % 3), 1.5);
    }
  }

  function drawLandmarks(era, par) {
    const c = ctx;
    const col = shade(ERAS[era].far, -0.12);
    c.fillStyle = col;
    const at = (wx) => wx + S.cam * par;
    const spots = [260, 760, 1220];
    for (let k = 0; k < spots.length; k++) {
      const x = at(spots[k]) - S.cam * 0;
      const y = GROUND - 92 - 26 * hillY(spots[k], era * 3 + 1, 0.006);
      c.save();
      c.translate(x, y + 4);
      switch (era) {
        case 0: // Greek temple
          poly(c, [[-34, -30], [0, -44], [34, -30]]);
          c.fillRect(-34, -30, 68, 4);
          for (let i = 0; i < 6; i++) c.fillRect(-31 + i * 12, -26, 5, 26);
          c.fillRect(-36, 0, 72, 4);
          break;
        case 1: // castle
          c.fillRect(-30, -34, 60, 34);
          c.fillRect(-38, -50, 14, 50); c.fillRect(24, -50, 14, 50);
          for (let i = 0; i < 5; i++) c.fillRect(-30 + i * 13, -40, 7, 6);
          poly(c, [[-40, -50], [-31, -64], [-22, -50]]); poly(c, [[22, -50], [31, -64], [40, -50]]);
          break;
        case 2: // stepped pyramid
          for (let i = 0; i < 5; i++) c.fillRect(-46 + i * 8, -i * 11 - 11, 92 - i * 16, 11);
          c.fillRect(-9, -70, 18, 15);
          poly(c, [[-11, -70], [0, -78], [11, -70]]);
          break;
        case 3: // windmill and church
          c.fillRect(-8, -40, 16, 40);
          c.save(); c.translate(0, -40); c.rotate(S.t * 0.6);
          for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.fillRect(-2, 0, 4, 26); }
          c.restore();
          c.fillRect(26, -26, 30, 26); c.fillRect(34, -46, 10, 20); poly(c, [[33, -46], [39, -58], [45, -46]]);
          break;
        case 4: // skyline
          for (let i = 0; i < 7; i++) {
            const h = 30 + ((i * 37) % 50);
            c.fillRect(-56 + i * 16, -h, 14, h);
          }
          c.fillStyle = 'rgba(255,220,140,.35)';
          for (let i = 0; i < 18; i++) c.fillRect(-54 + (i % 7) * 16 + 3, -18 - ((i * 7) % 30), 2, 2);
          break;
      }
      c.restore();
    }
  }

  function drawBase(sd) {
    const c = ctx;
    const b = sd.base;
    const era = sd.era;
    const E = ERAS[era];
    const dir = DIR[sd.team];
    c.save();
    c.translate(b.x, GROUND);
    if (b.flash > 0) c.filter = 'brightness(1.6)';
    const stone = era === 4 ? '#7d8288' : era === 3 ? '#8a6a52' : era === 2 ? '#a89a72' : era === 1 ? '#8c8f88' : '#c7b28a';
    const dark = shade(stone, -0.18);
    const lite = shade(stone, 0.1);
    c.fillStyle = stone;
    switch (era) {
      case 0: {
        c.fillRect(-44, -96, 88, 96);
        c.fillStyle = lite; c.fillRect(-48, -100, 96, 8);
        poly(c, [[-48, -100], [0, -126], [48, -100]]);
        c.fillStyle = dark;
        for (let i = 0; i < 5; i++) c.fillRect(-38 + i * 18, -90, 6, 90);
        c.fillStyle = '#2a2016'; c.fillRect(-12 + dir * 0, -34, 24, 34);
        break;
      }
      case 1: {
        c.fillRect(-44, -110, 88, 110);
        c.fillStyle = dark;
        for (let i = 0; i < 6; i++) c.fillRect(-44 + i * 16, -120, 10, 10);
        for (let y = -100; y < 0; y += 12) for (let x = -44 + ((y / 12) % 2 ? 0 : 8); x < 40; x += 16) c.fillRect(x, y, 14, 1);
        c.fillStyle = '#2a2016';
        c.beginPath(); c.moveTo(-13, 0); c.lineTo(-13, -26); c.arc(0, -26, 13, Math.PI, 0); c.lineTo(13, 0); c.fill();
        c.fillRect(-4, -78, 8, 16);
        break;
      }
      case 2: {
        for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? stone : lite; c.fillRect(-48 + i * 6, -i * 20 - 20, 96 - i * 12, 20); }
        c.fillStyle = '#a8322a'; c.fillRect(-16, -128, 32, 28);
        c.fillStyle = '#2f8a7c'; poly(c, [[-20, -128], [0, -142], [20, -128]]);
        c.fillStyle = dark; c.fillRect(-7, -100, 14, 100);
        break;
      }
      case 3: {
        poly(c, [[-48, 0], [-44, -104], [44, -104], [48, 0]]);
        c.fillStyle = dark;
        for (let i = 0; i < 5; i++) c.fillRect(-44 + i * 20, -114, 12, 10);
        for (let y = -96; y < 0; y += 9) c.fillRect(-46, y, 92, 1);
        c.fillStyle = '#2a2016';
        c.fillRect(-12, -30, 24, 30);
        c.beginPath(); c.arc(dir * 26, -60, 5, 0, Math.PI * 2); c.fill();
        break;
      }
      case 4: {
        c.fillRect(-46, -100, 92, 100);
        c.fillStyle = dark; c.fillRect(-46, -62, 92, 4); c.fillRect(-46, -30, 92, 4);
        c.fillStyle = '#1b2026'; c.fillRect(-30, -86, 60, 8); c.fillRect(-12, -24, 24, 24);
        c.fillStyle = '#9c9a7a';
        for (let i = 0; i < 6; i++) ell(c, -40 + i * 16 + dir * 4, -4, 9, 5);
        c.strokeStyle = '#3a3f46'; c.lineWidth = 2; line(c, -30 * dir, -100, -30 * dir, -136);
        c.fillStyle = TEAM_COL[sd.team]; c.beginPath(); c.arc(-30 * dir, -136, 2.5, 0, Math.PI * 2); c.fill();
        break;
      }
    }
    // Turret ledges
    for (let i = 0; i < b.slots; i++) {
      const p = turretPos(sd.team, i);
      c.fillStyle = '#3a2e22';
      c.fillRect(p.x - b.x - 12, p.y - GROUND + 6, 24, 4);
    }
    // Flag
    const fx = dir * -18;
    c.strokeStyle = '#2a2016'; c.lineWidth = 2;
    const top = era === 2 ? -142 : era === 0 ? -126 : -120;
    line(c, fx, top, fx, top - 30);
    c.fillStyle = TEAM_COL[sd.team];
    const wave = Math.sin(S.t * 4) * 3;
    poly(c, [[fx, top - 30], [fx + dir * 22, top - 26 + wave], [fx, top - 18]]);
    c.restore();

    for (let i = 0; i < 3; i++) if (b.turrets[i]) drawTurret(sd.team, i, b.turrets[i]);
  }

  function drawTurret(team, i, t) {
    const c = ctx;
    const p = turretPos(team, i);
    const dir = DIR[team];
    c.save();
    c.translate(p.x, p.y);
    c.scale(dir, 1);
    c.fillStyle = '#4a3a2a';
    c.fillRect(-9, -2, 18, 6);
    c.rotate(Math.max(-0.6, Math.min(1.1, t.angle)));
    const id = t.def.id;
    if (id === 'onager' || id === 'trebuchet' || id === 'hornets') {
      c.fillStyle = '#6a4a2a'; c.fillRect(-10, -6, 20, 5);
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2; line(c, -6, -4, 8 - t.cd * 2, -16);
      c.fillStyle = id === 'hornets' ? '#7a6a3a' : '#7a7a7a'; c.beginPath(); c.arc(8 - t.cd * 2, -17, 3, 0, Math.PI * 2); c.fill();
    } else if (id === 'cannon' || id === 'mortar') {
      c.fillStyle = '#2a2a2a'; c.fillRect(-4, -5, 22, 7);
      c.fillStyle = '#5a3a26'; c.beginPath(); c.arc(-2, 2, 4, 0, Math.PI * 2); c.fill();
    } else if (id === 'swivel' || id === 'm2') {
      c.fillStyle = '#2a2a2a'; c.fillRect(-4, -3, 22, 3.5); c.fillRect(-6, -5, 8, 7);
    } else {
      c.fillStyle = '#6a4a2a'; c.fillRect(-4, -3, 20, 3);
      c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(10, -1.5, 9, -1.3, 1.3); c.stroke();
    }
    if (t.flashT > 0) { c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(22, -1, 4, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  function drawHorse(c, col, walk) {
    const leg = (x0, ph) => {
      const a = Math.sin(walk + ph) * 0.5;
      line(c, x0, -18, x0 + Math.sin(a) * 9, -18 + Math.cos(a) * 17);
    };
    c.strokeStyle = shade(col, -0.2);
    c.lineWidth = 3;
    leg(-11, 0); leg(9, Math.PI);
    c.fillStyle = col;
    ell(c, 0, -24, 17, 8);
    poly(c, [[10, -28], [17, -42], [23, -40], [16, -22]]);
    ell(c, 22, -41, 6.5, 3.4, 0.45);
    c.strokeStyle = col;
    leg(-8, Math.PI); leg(12, 0);
    c.strokeStyle = shade(col, -0.35); c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-16, -27); c.quadraticCurveTo(-24, -22, -21, -12); c.stroke();
    c.lineWidth = 2; line(c, 12, -32, 17, -42);
  }

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
  function drawFigure(c, def, o) {
    const L = def.look;
    const walk = o.walk || 0;
    c.save();
    if (def.mounted) { drawHorse(c, L.mounted, walk); c.translate(-2, -13); }
    const a = def.mounted ? 0 : Math.sin(walk) * 0.55;

    if (L.cape) {
      c.fillStyle = L.cape;
      poly(c, [[-4, -35], [-13 + Math.sin(walk * 0.7) * 1.5, -13], [-2, -16]]);
    }
    if (L.duster) { c.fillStyle = L.duster; poly(c, [[-6, -34], [-9, -9], [6, -9], [6, -34]]); }

    // Legs
    c.lineCap = 'round';
    c.strokeStyle = L.legs; c.lineWidth = 4;
    if (def.mounted) {
      line(c, 0, -18, 7, -12); line(c, 7, -12, 5, -4);
    } else {
      const lx = Math.sin(a) * 9, rx = -Math.sin(a) * 9;
      line(c, 0, -18, rx, -1); line(c, 0, -18, lx, -1);
      c.fillStyle = '#2a2016';
      c.fillRect(lx - 1, -2.5, 5, 2.5); c.fillRect(rx - 1, -2.5, 5, 2.5);
    }

    // Torso
    c.fillStyle = L.coat || L.body;
    rr(c, -6, -36, 12, 19, 3);
    if (L.skirt || L.kilt) { c.fillStyle = L.kilt ? '#3a5a8a' : L.legs; poly(c, [[-6.5, -21], [6.5, -21], [8, -9], [-8, -9]]); }
    if (L.kilt) { c.strokeStyle = '#2f5a3a'; c.lineWidth = 1; line(c, -7, -15, 7, -15); line(c, 0, -21, 0, -9); }
    if (L.vest) { c.fillStyle = L.vest; rr(c, -6.5, -34, 13, 13, 2); }
    if (L.stripes) { c.strokeStyle = '#2a4a8a'; c.lineWidth = 1; for (let y = -35; y < -30; y += 2) line(c, -6, y, 6, y); }
    if (L.checker) { c.fillStyle = '#efe4cf'; for (let i = 0; i < 4; i++) c.fillRect(-5 + (i % 2) * 5, -33 + Math.floor(i / 2) * 5, 4, 4); }
    if (L.spots) { c.fillStyle = '#5a3a1a'; for (let i = 0; i < 6; i++) ell(c, -4 + (i * 3.3) % 9, -33 + ((i * 5.5) % 14), 1.1, 1.1); }
    if (L.cowhide) { c.fillStyle = '#2a2016'; ell(c, -2, -30, 2.4, 3); ell(c, 3, -24, 2, 2.4); }
    if (L.facing) { c.fillStyle = L.facing; c.fillRect(2, -35, 3, 15); }
    if (L.cross) { c.fillStyle = '#efe4cf'; c.fillRect(-1, -33, 2, 10); c.fillRect(-4, -30, 8, 2); }
    if (L.sash) { c.strokeStyle = L.sash; c.lineWidth = 2.5; line(c, -6, -35, 6, -22); }
    if (L.bandolier) { c.strokeStyle = '#6a4a2a'; c.lineWidth = 2.2; line(c, -6, -35, 6, -22); line(c, 6, -35, -6, -22); }
    if (L.tie) { c.fillStyle = L.tie; poly(c, [[0, -35], [2, -27], [0, -25], [-2, -27]]); }
    if (L.fur) { c.fillStyle = L.fur; c.fillRect(-6.5, -37, 13, 3); }
    if (L.neck) { c.fillStyle = L.neck; poly(c, [[-4, -36], [4, -36], [0, -31]]); }
    // Team band on the belt.
    c.fillStyle = o.teamCol;
    c.fillRect(-6, -20.5, 12, 2.6);

    // Head
    const HX = 1, HY = -42;
    if (L.longHair || L.whiteHair) { c.fillStyle = L.whiteHair ? '#e8e4dc' : '#1a1a1a'; rr(c, -6, -46, 6, 13, 2); }
    c.fillStyle = L.skin;
    c.beginPath(); c.arc(HX, HY, 6, 0, Math.PI * 2); c.fill();
    if (L.paint) { c.fillStyle = L.paint; c.fillRect(HX, HY - 2, 6, 2.5); }
    if (L.moko) { c.strokeStyle = '#2a2a3a'; c.lineWidth = 0.8; c.beginPath(); c.arc(HX + 3, HY + 1, 2.5, 0, Math.PI); c.stroke(); }
    if (L.beard) { c.fillStyle = L.beard; c.beginPath(); c.arc(HX + 1, HY + 2, 5, 0.1, Math.PI - 0.4); c.fill(); }
    if (L.mustache) { c.strokeStyle = '#2a1a1a'; c.lineWidth = 1.3; line(c, HX + 2, HY + 2.5, HX + 6, HY + 2.5); }
    if (L.glasses) { c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.8; c.beginPath(); c.arc(HX + 4, HY - 1, 1.6, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#1a1a1a';
    c.fillRect(HX + 3, HY - 1.5, 1.4, 1.4);
    drawHelm(c, L, HX, HY);

    // Shield on the near arm.
    const w = o.weapon;
    const k = w ? (w.kind || 'sword') : 'sword';
    const twoHand = k === 'bow' || k === 'rifle' || (k === 'spear' && !L.shield);
    if (L.shield && !twoHand) {
      c.fillStyle = L.shield;
      if (L.kite) poly(c, [[2, -36], [12, -34], [10, -20], [6, -12], [3, -20]]);
      else ell(c, 7, -27, 5, 9.5);
      c.strokeStyle = shade(L.shield, -0.3); c.lineWidth = 1;
      c.beginPath(); c.ellipse(7, -27, 5, 9.5, 0, 0, Math.PI * 2); if (!L.kite) c.stroke();
    }

    // Arm and weapon.
    const sw = o.swing || 0;
    let th;
    if (k === 'bow' || k === 'rifle' || k === 'pistol') th = -0.08;
    else if (sw > 0) th = -1.6 + (1 - sw) * 2.6;
    else th = k === 'spear' ? 0.35 : 0.9;
    const shx = 0, shy = -33;
    const hx = shx + Math.cos(th) * 10, hy = shy + Math.sin(th) * 10;
    c.strokeStyle = L.coat || L.body; c.lineWidth = 3.2;
    line(c, shx, shy, hx, hy);
    c.fillStyle = L.skin; c.beginPath(); c.arc(hx, hy, 1.8, 0, Math.PI * 2); c.fill();
    drawWeapon(c, k, hx, hy, th, sw, w);

    if (o.shield) {
      c.strokeStyle = 'rgba(240,220,150,.7)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, -26, 17, -1.2, 1.2); c.stroke();
    }
    c.restore();
  }

  function drawWeapon(c, k, hx, hy, th, sw, w) {
    const n = w ? w.name.toLowerCase() : '';
    const steel = '#d6dadd', wood = '#7a5230', dark = '#26272a';
    c.save();
    c.translate(hx, hy);
    c.lineCap = 'round';
    switch (k) {
      case 'sword': {
        c.rotate(th - 1.25);
        const len = /claymore|long sword|great|falcata|katana|macuahuitl/.test(n) ? 20 : 16;
        if (/macuahuitl/.test(n)) {
          c.strokeStyle = wood; c.lineWidth = 3; line(c, 0, 0, len, 0);
          c.fillStyle = '#1a1a1a'; for (let i = 5; i < len; i += 3.5) { c.fillRect(i, -2.6, 1.6, 1.4); c.fillRect(i, 1.2, 1.6, 1.4); }
        } else {
          c.strokeStyle = steel; c.lineWidth = 2.2; line(c, 2, 0, len, 0);
          c.strokeStyle = '#8a6a2a'; c.lineWidth = 2; line(c, 1.5, -3, 1.5, 3);
        }
        break;
      }
      case 'knife':
        c.rotate(th - 1.25);
        c.strokeStyle = steel; c.lineWidth = 2; line(c, 1, 0, 9, 0);
        break;
      case 'axe':
        c.rotate(th - 1.25);
        c.strokeStyle = wood; c.lineWidth = 2; line(c, -2, 0, 17, 0);
        c.fillStyle = steel; poly(c, [[13, 0], [17, -6], [19, -1], [18, 2]]);
        break;
      case 'club':
        c.rotate(th - 1.25);
        if (/staff/.test(n)) { c.strokeStyle = wood; c.lineWidth = 2; line(c, -8, 0, 20, 0); break; }
        if (/knuckles|krav/.test(n)) break;
        c.strokeStyle = wood; c.lineWidth = 2.4; line(c, 0, 0, 13, 0);
        c.fillStyle = /champi|morning|mace/.test(n) ? '#9a9da0' : /mere/.test(n) ? '#4f7a5a' : '#5a3a20';
        c.beginPath(); c.arc(15, 0, 3.6, 0, Math.PI * 2); c.fill();
        if (/champi|morning|mace/.test(n)) { c.strokeStyle = '#9a9da0'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const aa = i * Math.PI / 3; line(c, 15, 0, 15 + Math.cos(aa) * 6, Math.sin(aa) * 6); } }
        break;
      case 'spear': {
        c.rotate(th - 0.75 + (sw > 0 ? 0.3 : 0));
        const len = /sarissa|lance|kontos/.test(n) ? 34 : 26;
        c.strokeStyle = wood; c.lineWidth = 1.8; line(c, -12, 0, len, 0);
        if (/trident/.test(n)) { c.strokeStyle = steel; c.lineWidth = 1.2; line(c, len, -3, len + 5, -3); line(c, len, 0, len + 6, 0); line(c, len, 3, len + 5, 3); line(c, len, -3, len, 3); }
        else if (/halberd|bardiche|guan dao|naginata/.test(n)) { c.fillStyle = steel; poly(c, [[len - 6, 0], [len - 2, -6], [len + 4, -2], [len + 6, 0]]); }
        else if (/taiaha/.test(n)) { c.fillStyle = '#a8322a'; ell(c, len - 4, 0, 2, 3); }
        else { c.fillStyle = steel; poly(c, [[len, -2], [len + 6, 0], [len, 2]]); }
        break;
      }
      case 'throw':
        c.rotate(th - 1.0);
        if (/sling|huaraca/.test(n)) { c.strokeStyle = '#c9a26a'; c.lineWidth = 1; line(c, 0, 0, 6, 8 - sw * 8); c.fillStyle = '#8a8a80'; c.beginPath(); c.arc(6, 8 - sw * 8, 1.8, 0, Math.PI * 2); c.fill(); }
        else if (/atlatl/.test(n)) { c.strokeStyle = wood; c.lineWidth = 2; line(c, 0, 0, 10, 0); c.strokeStyle = '#c9a26a'; c.lineWidth = 1; line(c, -6, -1, 22, -1); }
        else if (/shuriken|chakram|kpinga/.test(n)) { c.fillStyle = steel; c.beginPath(); c.arc(3, 0, 2.6, 0, Math.PI * 2); c.fill(); }
        else { c.strokeStyle = wood; c.lineWidth = 1.6; line(c, -10, 0, 20, 0); c.fillStyle = steel; poly(c, [[20, -1.6], [25, 0], [20, 1.6]]); }
        break;
      case 'bow': {
        const cross = /crossbow|scorpio|gastraphetes/.test(n);
        if (cross) {
          c.strokeStyle = wood; c.lineWidth = 2.4; line(c, -4, 0, 12, 0);
          c.strokeStyle = '#5a3a20'; c.lineWidth = 1.6; c.beginPath(); c.arc(8, 0, 7, -1.3, 1.3); c.stroke();
        } else {
          const pull = sw > 0.6 ? 0 : 4 * (1 - sw);
          c.strokeStyle = wood; c.lineWidth = 1.8;
          c.beginPath(); c.arc(-1, 0, 12, -1.1, 1.1); c.stroke();
          c.strokeStyle = '#e8e0cc'; c.lineWidth = 0.7;
          const ex = -1 + Math.cos(1.1) * 12, ey = Math.sin(1.1) * 12;
          c.beginPath(); c.moveTo(ex, -ey); c.lineTo(ex - pull, 0); c.lineTo(ex, ey); c.stroke();
        }
        break;
      }
      case 'rifle': {
        const musket = /musket|arquebus|pishchal|brown bess|long rifle|charleville|hand cannon/.test(n);
        const len = musket ? 22 : /smg|thompson|uzi|mp5/.test(n) ? 13 : 17;
        c.rotate(-0.06);
        c.fillStyle = musket ? wood : dark; c.fillRect(-9, -1.6, 10, 3.6);
        c.fillStyle = dark; c.fillRect(-1, -1.6, len, 2.4);
        if (/thompson/.test(n)) { c.beginPath(); c.arc(4, 3, 3, 0, Math.PI * 2); c.fill(); }
        else if (!musket) c.fillRect(3, 0, 2.5, 5);
        if (sw > 0.75) { c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(len + 2, -0.5, 3, 0, Math.PI * 2); c.fill(); }
        break;
      }
      case 'pistol':
        c.fillStyle = dark; c.fillRect(0, -2, 9, 2.6); c.fillRect(0, -1, 2.5, 4.5);
        if (sw > 0.75) { c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(11, -1, 2.5, 0, Math.PI * 2); c.fill(); }
        break;
    }
    c.restore();
  }

  function drawUnit(u) {
    const c = ctx;
    const dir = DIR[u.team];
    c.save();
    c.translate(u.x, GROUND);
    let alpha = 1;
    if (u.dead) {
      const t = Math.min(1, u.deathT / 0.45);
      c.rotate(-dir * t * 1.45);
      alpha = u.deathT > 0.9 ? Math.max(0, 1 - (u.deathT - 0.9) / 0.7) : 1;
    }
    c.globalAlpha = alpha;
    const sc = u.def.hero ? 1.14 : u.def.role === 'heavy' ? 1.05 : 1;
    c.scale(dir * sc, sc);
    if (u.flash > 0) c.filter = 'brightness(2.2)';
    else if (u.dots.length) c.filter = 'sepia(.6) hue-rotate(50deg)';
    const sw = u.swingW;
    const showSwing = u.swing > 0 && sw && (!sw.fx || ((sw.fx === 'stun' || sw.fx === 'flurry') && !sw.proj));
    drawFigure(c, u.def, { walk: u.walk, swing: u.swing, weapon: showSwing ? sw : u.weapon, teamCol: TEAM_COL[u.team], shield: u.shieldT > 0 });
    c.filter = 'none';
    c.restore();
    if (u.dead) return;

    const top = GROUND - (u.def.mounted ? 70 : 58) * sc;
    if (u.hp < u.maxHp) {
      c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(u.x - 12, top, 24, 3.2);
      c.fillStyle = TEAM_COL[u.team]; c.fillRect(u.x - 12, top, 24 * Math.max(0, u.hp / u.maxHp), 3.2);
    }
    if (u.def.hero) {
      c.fillStyle = '#d9a944';
      star(c, u.x, top - 6, 3.4);
    }
    if (u.stunT > 0) {
      c.fillStyle = '#ffe08a';
      for (let i = 0; i < 3; i++) { const a = S.t * 6 + i * 2.1; c.fillRect(u.x + Math.cos(a) * 7 - 1, top - 3 + Math.sin(a) * 2, 2, 2); }
    }
    if (u.rallyT > 0) {
      c.strokeStyle = 'rgba(217,169,68,.6)'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(u.x, GROUND - 1, 11, 2.5, 0, 0, Math.PI * 2); c.stroke();
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

  function drawProj(p) {
    if (p.t < 0) return;
    const c = ctx;
    const ang = Math.atan2(p.y - p.py, p.x - p.px || 0.0001);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(ang);
    switch (p.kind) {
      case 'arrow': case 'dart': case 'bolt': case 'javelin': case 'stake': {
        const len = p.kind === 'javelin' ? 20 : p.kind === 'bolt' ? 9 : p.kind === 'stake' ? 10 : 13;
        c.strokeStyle = p.kind === 'javelin' || p.kind === 'stake' ? '#7a5230' : '#5a3a20'; c.lineWidth = p.kind === 'javelin' ? 1.8 : 1.2;
        line(c, -len, 0, 0, 0);
        c.fillStyle = '#c8ccd0'; poly(c, [[0, -1.6], [4, 0], [0, 1.6]]);
        break;
      }
      case 'bullet':
        c.strokeStyle = 'rgba(255,230,160,.9)'; c.lineWidth = 1.4; line(c, -9, 0, 0, 0);
        break;
      case 'stone': c.fillStyle = '#8a8478'; c.beginPath(); c.arc(0, 0, 2.6, 0, Math.PI * 2); c.fill(); break;
      case 'star':
        c.rotate(S.t * 20); c.fillStyle = '#c8ccd0'; star(c, 0, 0, 3.6);
        break;
      case 'rocket':
        c.fillStyle = '#4a4a3a'; c.fillRect(-7, -1.5, 9, 3);
        c.fillStyle = '#ffb84a'; ell(c, -9, 0, 3, 1.6);
        break;
      case 'bomb': case 'shell':
        c.fillStyle = '#1e1e1e'; c.beginPath(); c.arc(0, 0, p.kind === 'shell' ? 3.6 : 3, 0, Math.PI * 2); c.fill();
        if (p.kind === 'bomb') { c.fillStyle = '#ffb84a'; c.fillRect(-4, -0.6, 2, 1.2); }
        break;
      case 'fire':
        c.fillStyle = '#8a4a20'; c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,150,40,.85)'; ell(c, -4, 0, 5, 2.5);
        break;
      case 'nest': c.fillStyle = '#9a8a5a'; ell(c, 0, 0, 4, 3.4); break;
      case 'net': case 'rope': case 'bola':
        c.strokeStyle = '#c9b48a'; c.lineWidth = 1;
        c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.stroke();
        if (p.kind === 'net') { line(c, -5, 0, 5, 0); line(c, 0, -5, 0, 5); }
        break;
      case 'flash': c.fillStyle = '#3a3f46'; c.fillRect(-2, -2, 4, 4); break;
    }
    c.restore();
  }

  function drawFx(f) {
    const c = ctx;
    const k = f.t / f.dur;
    switch (f.type) {
      case 'boom': {
        const r = f.r * (0.4 + k * 0.8);
        c.fillStyle = f.fire ? `rgba(255,${120 + 80 * (1 - k)},40,${0.7 * (1 - k)})` : `rgba(255,${170 + 60 * (1 - k)},90,${0.75 * (1 - k)})`;
        c.beginPath(); c.arc(f.x, f.y, r * 0.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = `rgba(60,50,40,${0.45 * (1 - k)})`;
        c.beginPath(); c.arc(f.x, f.y - 10 - k * 20, r * 0.5, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'swarm':
        c.fillStyle = 'rgba(40,30,10,.8)';
        for (let i = 0; i < 14; i++) {
          const a = i * 2.4 + f.t * 9;
          c.fillRect(f.x + Math.cos(a) * f.r * 0.6 * Math.sin(i + f.t * 3), f.y - 16 + Math.sin(a * 1.3) * 12, 2, 1.5);
        }
        break;
      case 'dust':
        c.fillStyle = `rgba(160,140,110,${0.5 * (1 - k)})`;
        c.beginPath(); c.arc(f.x, f.y, 4 + k * 10, 0, Math.PI * 2); c.fill();
        break;
      case 'muzzle':
        c.fillStyle = `rgba(255,210,120,${1 - k})`;
        c.beginPath(); c.arc(f.x, f.y, 3, 0, Math.PI * 2); c.fill();
        break;
      case 'ring':
        c.strokeStyle = f.col; c.globalAlpha = 1 - k; c.lineWidth = 2;
        c.beginPath(); c.ellipse(f.x, GROUND - 2, f.r * (0.3 + 0.7 * k), 8 * (0.3 + 0.7 * k), 0, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
        break;
      case 'flash':
        c.fillStyle = `rgba(255,255,240,${0.9 * (1 - k)})`;
        c.beginPath(); c.arc(f.x, f.y, 30 * (0.5 + k), 0, Math.PI * 2); c.fill();
        break;
      case 'jet': {
        const dir = DIR[f.team];
        const x = dir > 0 ? S.cam - 60 + k * (viewW + 120) : S.cam + viewW + 60 - k * (viewW + 120);
        c.save(); c.translate(x, 40); c.scale(dir, 1);
        c.fillStyle = '#2a3038';
        poly(c, [[-22, 0], [16, -2], [24, 1], [16, 3], [-22, 3]]);
        poly(c, [[-4, 1], [-14, 12], [-8, 12], [6, 1]]);
        poly(c, [[-20, 0], [-26, -8], [-22, -8], [-14, 0]]);
        c.restore();
        break;
      }
    }
  }

  function drawOverlay() {
    // Screen space: base health and minimap.
    const c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 10;
    const bw = Math.min(220, cssW * 0.32);
    for (let t = 0; t < 2; t++) {
      const b = S.sides[t].base;
      const x = t === 0 ? pad : cssW - pad - bw;
      c.fillStyle = 'rgba(15,11,8,.7)'; c.fillRect(x, pad, bw, 22);
      c.fillStyle = TEAM_COL[t]; c.fillRect(x + 3, pad + 15, (bw - 6) * Math.max(0, b.hp / b.maxHp), 4);
      c.fillStyle = '#efe4cf';
      c.font = '600 11px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif';
      c.textAlign = t === 0 ? 'left' : 'right';
      const label = S.mode === 'attract' ? (t === 0 ? 'Left army' : 'Right army') : (t === 0 ? 'Your stronghold' : 'Enemy stronghold');
      const hpText = `${Math.max(0, Math.ceil(b.hp))}`;
      let text = `${label} · ${ERAS[S.sides[t].era].name}`;
      if (c.measureText(text).width > bw - 48) text = label;
      if (c.measureText(text).width > bw - 48) text = S.mode === 'attract' ? (t === 0 ? 'Left' : 'Right') : (t === 0 ? 'You' : 'Enemy');
      c.fillText(text, t === 0 ? x + 4 : x + bw - 4, pad + 11);
      c.font = '500 10px "IBM Plex Mono", monospace';
      c.textAlign = t === 0 ? 'right' : 'left';
      c.fillStyle = '#b3a385';
      c.fillText(hpText, t === 0 ? x + bw - 4 : x + 4, pad + 11);
    }
    // Minimap
    let mw = Math.min(260, cssW - 2 * bw - 4 * pad);
    let my = pad + 4;
    if (mw < 120) { mw = Math.min(260, cssW - 2 * pad); my = pad + 28; }
    {
      const mx = (cssW - mw) / 2, mh = 12;
      c.fillStyle = 'rgba(15,11,8,.7)'; c.fillRect(mx, my, mw, mh);
      const k = mw / WORLD_W;
      for (const u of S.units) {
        if (u.dead) continue;
        c.fillStyle = TEAM_COL[u.team];
        c.fillRect(mx + u.x * k - 1, my + 3, 2, mh - 6);
      }
      c.strokeStyle = '#efe4cf'; c.lineWidth = 1;
      c.strokeRect(mx + S.cam * k + 0.5, my + 0.5, viewW * k - 1, mh - 1);
      S.mini = { x: mx, y: my, w: mw, h: mh };
    }
  }

  function render() {
    if (!S) return;
    if (cv.width !== Math.round(cssW * dpr) || !cssW) resize();
    if (S.mode === 'attract') {
      const fronts = S.units.filter((u) => !u.dead).map((u) => u.x);
      const mid = fronts.length ? (Math.min(...fronts) + Math.max(...fronts)) / 2 : WORLD_W / 2;
      S.cam += (mid - viewW / 2 - S.cam) * 0.02;
    }
    clampCam();
    const c = ctx;
    c.setTransform(dpr * scale, 0, 0, dpr * scale, -S.cam * dpr * scale, 0);
    drawBackground(S.sides[0].era);
    drawBase(S.sides[0]);
    drawBase(S.sides[1]);
    const dead = S.units.filter((u) => u.dead), alive = S.units.filter((u) => !u.dead);
    for (const u of dead) drawUnit(u);
    alive.sort((a, b) => (a.def.mounted ? 0 : 1) - (b.def.mounted ? 0 : 1));
    for (const u of alive) drawUnit(u);
    for (const p of S.projs) drawProj(p);
    for (const f of S.fx) drawFx(f);
    c.font = '600 11px "IBM Plex Mono", monospace';
    c.textAlign = 'center';
    for (const x of S.texts) { c.fillStyle = x.col; c.globalAlpha = 1 - x.t / 1.1; c.fillText(x.text, x.x, x.y); }
    c.globalAlpha = 1;
    drawOverlay();
  }

  // ── Portraits ───────────────────────────────────────────────────────────
  function drawPortrait(canvas, def, team = 0) {
    const r = Math.min(2, window.devicePixelRatio || 1);
    const size = canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || 58;
    canvas.width = size * r;
    canvas.height = size * r;
    const c = canvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    const k = (size / (def.mounted ? 78 : 62)) * r;
    c.setTransform(k, 0, 0, k, canvas.width / 2 - (def.mounted ? 2 : 2) * k, canvas.height - 3 * r);
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

  function powerBar(p, special) {
    let s = '<span class="pw" aria-label="Power ' + p + ' of 10">';
    for (let i = 1; i <= 10; i++) s += `<i class="${i <= p ? (special && p >= 9 ? 'on hot' : 'on') : ''}"></i>`;
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

  function sheetHTML(def, full) {
    const isAdded = def.show.startsWith('Added');
    let h = `<div class="wname">${esc(def.name)}</div>
      <div class="wsub">${esc(def.roleInfo.label)} · ${esc(def.origin)}</div>
      <span class="record${isAdded ? ' added' : ''}">${esc(def.show)}</span>
      <div class="statrow"><div><span>HP</span>${def.hp}</div><div><span>Armor</span>${Math.round(def.armor * 100)}%</div><div><span>Speed</span>${Math.round(def.speed)}</div><div><span>Cost</span>${def.cost}</div></div>`;
    if (full !== false) {
      h += '<div class="weps">';
      for (const w of def.weapons) {
        h += `<div class="wep"><div class="slot">${SLOT_LABEL[w.slot]}</div><div class="n">${esc(w.name)}</div>${powerBar(w.power, w.slot === 'special')}<div class="d">${esc(weaponDetail(w))}</div></div>`;
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
        card.innerHTML = `<canvas width="58" height="58"></canvas><span class="nm">${esc(def.name)}</span><span class="meta">${def.cost}</span><span class="role">${def.hero ? '★ Hero' : def.roleInfo.label}</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}`;
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
    } else {
      const era = ERAS[sd.era];
      era.turrets.forEach((t) => {
        const card = el('div', 'card turret');
        card.tabIndex = 0; card.setAttribute('role', 'button');
        const dmg = Math.round(t.power * 3.2 * era.dmgMul);
        card.innerHTML = `<span class="nm">${esc(t.name)}</span><span class="meta">${t.cost}</span><span class="role">${dmg} dmg every ${t.cd} s · range ${t.r}${t.aoe ? ' · blast' : ''}${t.dot ? ' · stings' : ''}</span>`;
        const go = () => { const err = buyTurret(sd, t); if (err) toast(err); else Sound.play('ui'); refreshHud(true); };
        card.addEventListener('click', go);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        card.dataset.cost = t.cost;
        box.appendChild(card);
      });
      const slot = el('div', 'card turret');
      slot.tabIndex = 0; slot.setAttribute('role', 'button'); slot.id = 'slotCard';
      const goSlot = () => { const err = buySlot(sd); if (err) toast(err); else Sound.play('ui'); buildCards(); refreshHud(true); };
      slot.addEventListener('click', goSlot);
      slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goSlot(); } });
      box.appendChild(slot);
      const sell = el('div', 'card turret');
      sell.tabIndex = 0; sell.setAttribute('role', 'button');
      sell.innerHTML = `<span class="nm">Sell a turret</span><span class="meta">+50%</span><span class="role">Removes the top turret and refunds half its cost</span>`;
      const goSell = () => { const err = sellTurret(sd); if (err) toast(err); else Sound.play('coin'); refreshHud(true); };
      sell.addEventListener('click', goSell);
      sell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goSell(); } });
      box.appendChild(sell);
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
    $('eraSpan').textContent = `Era ${sd.era + 1} of 5 · ${era.span}`;
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
    $('btnSpeed').textContent = `${S.speed}×`;

    const heroBusy = heroActive(sd);
    for (const card of document.querySelectorAll('#cards .card[data-id]')) {
      const def = DEF_BY_ID[card.dataset.id];
      card.classList.toggle('off', sd.gold < def.cost || sd.queue.length >= MAX_QUEUE || (def.hero && heroBusy));
    }
    for (const card of document.querySelectorAll('#cards .card[data-cost]')) card.classList.toggle('off', sd.gold < +card.dataset.cost);
    const slot = $('slotCard');
    if (slot) {
      if (sd.base.slots >= 3) slot.innerHTML = '<span class="nm">Turret slots</span><span class="meta">3 / 3</span><span class="role">Every slot is built</span>';
      else slot.innerHTML = `<span class="nm">Add turret slot</span><span class="meta">${slotCost(sd)}</span><span class="role">Slots: ${sd.base.slots} / 3 · turrets: ${sd.base.turrets.filter(Boolean).length}</span>`;
      slot.classList.toggle('off', sd.base.slots >= 3 || sd.gold < slotCost(sd));
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
    body.innerHTML = `<p class="eranote"><b>${esc(E.name)}</b> · ${esc(E.span)}. Unlocks at ${E.xp} experience. Stronghold: ${E.baseHp} HP. Power bars rate each weapon from 1 to 10 and set its damage in the game.</p>`;
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
      weps.innerHTML = def.weapons.map((w) => `<div class="wep"><div class="slot">${SLOT_LABEL[w.slot]}</div><div class="n">${esc(w.name)}</div>${powerBar(w.power, w.slot === 'special')}<div class="d">${esc(weaponDetail(w))}</div></div>`).join('');
      entry.appendChild(weps);
      grid.appendChild(entry);
      requestAnimationFrame(() => drawPortrait(cnv, def));
    }
    body.appendChild(grid);
    const arm = el('div', 'armory');
    arm.innerHTML = E.turrets.map((t) => `<div><b>${esc(t.name)}</b><br>Turret · ${t.cost} gold · ${Math.round(t.power * 3.2 * E.dmgMul)} dmg every ${t.cd} s · range ${t.r}${t.aoe ? ' · blast' : ''}</div>`).join('') +
      `<div><b>${esc(E.ability.name)}</b><br>Era attack · ${esc(E.ability.desc)} Recharges in ${E.ability.cd} s.</div>`;
    body.appendChild(arm);
    body.appendChild(el('p', 'note', 'Matchups come from Spike TV’s Deadliest Warrior (2009–2011). A win or loss is shown only where the episode result was confirmed against published episode guides. Loadouts follow the show where sources confirm them; the rest use each warrior’s historically documented weapons. Warriors marked “Added” never appeared on the show. Power ratings are game balance numbers based on each weapon’s reputation, not the show’s simulated kill counts. Episodes featuring terrorist groups, death squads and the Nazi SS are left out.'));
    if (focusId) {
      const t = $('cx-' + focusId);
      if (t) { t.classList.add('flash'); requestAnimationFrame(() => t.scrollIntoView({ block: 'center' })); }
    }
  }

  function showEnd() {
    const win = S.winner === 0;
    $('endTitle').textContent = win ? 'Victory' : 'Defeat';
    $('endTitle').className = 'result ' + (win ? 'win' : 'loss');
    const p = S.sides[0];
    $('endText').textContent = win
      ? `The enemy stronghold falls in the ${ERAS[S.sides[1].era].name}. Your warriors held the field.`
      : `Your stronghold falls in the ${ERAS[p.era].name}. Regroup, evolve sooner, and build turrets before the next wave.`;
    const m = Math.floor(S.t / 60), s = Math.floor(S.t % 60);
    $('endStats').innerHTML = [
      ['Time', `${m}:${String(s).padStart(2, '0')}`], ['Era reached', `${p.era + 1} of 5`], ['Enemies slain', p.kills],
      ['Warriors trained', p.trained], ['Warriors lost', p.lost], ['Difficulty', DIFF[difficulty].label],
    ].map(([k, v]) => `<div><span class="lbl">${k}</span><b>${v}</b></div>`).join('');
    $('end').hidden = false;
  }

  function startGame() {
    Sound.init();
    $('start').hidden = true;
    $('end').hidden = true;
    newGame('play');
    resize();
    S.cam = 0;
    tab = 'warriors';
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    buildCards();
    showBanner(ERAS[0].name, ERAS[0].span);
  }

  function toMenu() {
    $('end').hidden = true;
    $('start').hidden = false;
    newGame('attract');
    buildCards();
    refreshHud(true);
  }

  // ── Input ───────────────────────────────────────────────────────────────
  $('btnStart').addEventListener('click', startGame);
  $('btnAgain').addEventListener('click', startGame);
  $('btnMenu').addEventListener('click', toMenu);
  $('btnCodex').addEventListener('click', () => openCodex());
  $('btnCodex2').addEventListener('click', () => openCodex(0));
  $('codexClose').addEventListener('click', closeCodex);
  $('codex').addEventListener('click', (e) => { if (e.target.id === 'codex') closeCodex(); });
  $('btnEvolve').addEventListener('click', () => { const err = evolve(S.sides[0]); if (err) toast(err); refreshHud(true); });
  $('btnAbility').addEventListener('click', () => { const err = useAbility(S.sides[0]); if (err) toast(err); refreshHud(true); });
  $('btnPause').addEventListener('click', () => { if (S.mode === 'play') { S.paused = !S.paused; refreshHud(true); } });
  $('btnSpeed').addEventListener('click', () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 3 : 1; refreshHud(true); });
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
    if (!S || S.mode !== 'play' || S.over || !$('codex').hidden) return;
    const sd = S.sides[0];
    if (/^[1-9]$/.test(e.key)) {
      const def = BY_ERA[sd.era][+e.key - 1];
      if (def) { const err = recruit(sd, def); if (err) toast(err); else Sound.play('ui'); refreshHud(true); }
    } else if (e.key === 'q' || e.key === 'Q') { const err = useAbility(sd); if (err) toast(err); }
    else if (e.key === 'e' || e.key === 'E') { const err = evolve(sd); if (err) toast(err); }
    else if (e.key === 'p' || e.key === 'P') { S.paused = !S.paused; refreshHud(true); }
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
  const shown = DEFS.filter((d) => !d.show.startsWith('Added')).length;
  $('lede').textContent = `Command ${total} warriors across five eras: ${shown} from Deadliest Warrior, plus the Aztec, Maya and Inca armies and the soldiers of history's great commanders. Each warrior picks the right weapon for the range, from the show's short, mid, long and special slots. Earn gold and experience from every kill, evolve your stronghold, and tear down the enemy's.`;

  newGame('attract');
  resize();
  refreshHud(true);

  let last = performance.now();
  function frame(now) {
    const raw = Math.min(0.05, (now - last) / 1000);
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
    get state() { return S; }, DEFS, BY_ERA, ERAS, recruit, evolve, useAbility, buyTurret, buySlot, update, newGame, startGame,
    setDifficulty(d) { difficulty = d; },
  };
})();
