// Cosmetic choices shared by the browser and authoritative multiplayer server.
export const CHARACTERS = Object.freeze([
  {id:'black-man',name:'Black Man',column:0,row:0},
  {id:'down-syndrome',name:'Down Syndrome',column:1,row:0},
  {id:'indian',name:'Indian',column:2,row:0},
  {id:'jew',name:'Jew',column:3,row:0},
  {id:'gay',name:'Gay',column:0,row:1},
  {id:'straight-white-man',name:'Straight White Man',column:1,row:1},
  {id:'nazi',name:'Nazi',column:2,row:1},
  {id:'monkey',name:'Monkey',column:3,row:1},
].map(character=>Object.freeze(character)));
export const DEFAULT_CHARACTER = 'black-man';
export function validCharacter(id){return CHARACTERS.some(character=>character.id===id);}
export function characterFor(id){return CHARACTERS.find(character=>character.id===id)||CHARACTERS[0];}
