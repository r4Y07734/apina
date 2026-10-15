import {ARENA} from './maps.js';
export const VIEW={width:960,height:640};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function createCamera(){
 return {x:0,y:0,initialized:false};
}
export function followCamera(camera,target,dt=1/60){
 const x=clamp(target.x-VIEW.width/2,0,Math.max(0,ARENA.width-VIEW.width));
 const y=clamp(target.y-VIEW.height/2,0,Math.max(0,ARENA.height-VIEW.height));
 // Spawn/teleport jumps snap immediately; ordinary movement eases into the frame.
 const snap=!camera.initialized||Math.hypot(camera.x-x,camera.y-y)>VIEW.height*.75;
 const amount=snap?1:1-Math.exp(-12*Math.max(0,dt));
 camera.x=clamp(camera.x+(x-camera.x)*amount,0,Math.max(0,ARENA.width-VIEW.width));
 camera.y=clamp(camera.y+(y-camera.y)*amount,0,Math.max(0,ARENA.height-VIEW.height));
 camera.initialized=true;
 return camera;
}
export function screenToWorld(camera,x,y){return {x:x+camera.x,y:y+camera.y};}
