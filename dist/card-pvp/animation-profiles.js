// Presentation stays separate from the editable card catalog and game rules.
// Stable slot IDs select a scene; effects always determine its actual targets.
const profile = (scene, duration, color) => Object.freeze({ scene, duration, color });

export const CARD_ANIMATIONS = Object.freeze({
  'card-01': profile('transfer', 1200, '#ffd16a'),
  'card-02': profile('scam', 1350, '#ffbd73'),
  'card-03': profile('charge', 1100, '#72d9ff'),
  'card-04': profile('missile', 1450, '#ff976b'),
  'card-05': profile('mushrooms', 1500, '#ba9af4'),
  'card-06': profile('splash', 1150, '#77d8ef'),
  'card-07': profile('collapse', 1200, '#b6a5d8'),
  'card-08': profile('nuclear', 1650, '#dbe88a'),
  'card-09': profile('balance', 1300, '#8cddd1'),
  'card-10': profile('slash', 950, '#ff8b87'),
  'card-11': profile('poison', 1400, '#a5dc72'),
  'card-12': profile('missile', 1450, '#ffaf74'),
  'card-13': profile('bomb', 1550, '#ff9863'),
  'card-14': profile('drink', 1500, '#77d6ff'),
  'card-15': profile('sniper', 1250, '#ff8577'),
  'card-16': profile('apple', 1350, '#ffd569'),
  'card-17': profile('charity', 1400, '#ffa2bd'),
  'card-18': profile('circuitry', 1250, '#83d9ff'),
  'card-19': profile('reactor', 1650, '#b8e782'),
  'card-20': profile('battery', 1350, '#85e1d0'),
  'card-21': profile('music', 1400, '#c6a0ff'),
  'card-22': profile('sand', 1250, '#e8c695'),
  'card-23': profile('car', 1450, '#ffb178'),
  'card-24': profile('vitality', 1350, '#8ae5bd'),
  'card-25': profile('projectile', 1150, '#a6bcff'),
  'card-26': profile('transfer', 1200, '#f3cf77'),
  'card-27': profile('drain', 1200, '#9eb0cc'),
  'card-28': profile('fracture', 1100, '#ff9cad'),
  'card-29': profile('charge', 1150, '#84dffa'),
  'card-30': profile('traffic', 1450, '#ffbc77'),
  'card-31': profile('atom', 1450, '#bedb83'),
  'card-32': profile('cannon', 1400, '#a7bed3'),
  'card-33': profile('numbers', 1200, '#c6b5f2'),
  'card-34': profile('balloon', 1450, '#f3a7c9'),
  'card-35': profile('meal', 1350, '#edc790'),
  'card-36': profile('money', 1300, '#9bddbc'),
  'card-37': profile('storm', 1650, '#9acbea'),
  'card-38': profile('equalize', 1350, '#b9badf'),
  'card-39': profile('profit', 1400, '#f1d080'),
  'card-40': profile('investment', 1400, '#8fddb3'),
  'card-41': profile('toxin', 1400, '#b0de87'),
  'card-42': profile('gust', 1250, '#b5ddec'),
  'card-43': profile('gift', 1400, '#c7a5ed'),
  'card-44': profile('jackpot', 1600, '#ffda78'),
  'card-45': profile('barrel', 1450, '#d6ae7c'),
  'card-46': profile('plague', 1500, '#a4d37e'),
  'card-47': profile('contamination', 1550, '#c3da83'),
  'card-48': profile('alchemy', 1400, '#bd9ced'),
  'card-49': profile('sonic', 1150, '#a4d9f1'),
  'card-50': profile('dance', 1600, '#d4a9ff'),
  'card-51': profile('coinflip', 1450, '#f1d080'),
  'card-52': profile('paperplane', 1450, '#9acbea'),
  'card-53': profile('depletion', 1450, '#9eb0cc'),
  'card-54': profile('precision', 1450, '#ffac91'),
  'card-55': profile('blessing', 1450, '#f3de98'),
  'card-56': profile('computer', 1450, '#83d9ff'),
  'card-57': profile('bad-aim', 1450, '#ffaf74'),
  'card-58': profile('stew', 1450, '#a8cf86'),
  'card-59': profile('anthem', 1450, '#c6a0ff'),
  'card-60': profile('impact', 1450, '#ffac91'),
  'card-61': profile('illness', 1450, '#a4d37e'),
  'card-62': profile('donation', 1450, '#c7a5ed'),
  'card-63': profile('sacrifice', 1450, '#ff9cad'),
  'card-64': profile('wedding', 1450, '#f3d080'),
  'card-65': profile('snack', 1450, '#e8c695'),
  'card-66': profile('feast', 1450, '#edc790'),
  'card-67': profile('curry', 1450, '#d6ae7c'),
  'card-68': profile('droplet', 1450, '#77d8ef'),
  'card-69': profile('curse', 1450, '#a4d37e'),
  'card-70': profile('breakup', 1450, '#ff9cad'),
  'card-71': profile('surprise', 1450, '#ffda78'),
  'card-72': profile('roulette', 1450, '#ff9863'),
  'card-73': profile('pressure', 1450, '#ffac91'),
  'card-74': profile('snake', 1450, '#a5dc72'),
  'card-75': profile('mystery-shot', 1450, '#b0de87'),
});

const FALLBACKS = Object.freeze({
  poison: profile('poison', 1400, '#a5dc72'),
  steal: profile('transfer', 1200, '#ffd16a'),
  heal: profile('vitality', 1350, '#8ae5bd'),
  energy: profile('charge', 1100, '#72d9ff'),
  drain: profile('drain', 1200, '#9eb0cc'),
  damage: profile('projectile', 1150, '#ff976b'),
  neutral: profile('balance', 1200, '#a9b9d4'),
});

/** New/custom IDs still receive an animation, without interpreting their text. */
export function animationFor(card) {
  if (card && Object.hasOwn(CARD_ANIMATIONS, card.id)) return CARD_ANIMATIONS[card.id];
  const effects = Array.isArray(card?.effects) ? card.effects : [];
  for (const type of ['poison', 'steal', 'heal', 'energy', 'damage']) {
    const effect = effects.find(item => item?.type === type);
    if (effect) return type === 'energy' && Number(effect.amount) < 0 ? FALLBACKS.drain : FALLBACKS[type];
  }
  return FALLBACKS.neutral;
}

/**
 * Actor IDs are the authoritative match IDs (0/1), independent of screen side.
 * A steal target is the energy source. Its animation travels from that player
 * to the other player, including when a card gives away the caster's energy.
 */
export function resolveAnimationTargets(card, actor) {
  if (actor !== 0 && actor !== 1) return [];
  const effects = Array.isArray(card?.effects) ? card.effects : [];
  const targets = new Set();
  for (const effect of effects) {
    if (effect?.target === 'self') targets.add(actor);
    else if (effect?.target === 'opponent') targets.add(1 - actor);
  }
  return [...targets];
}
