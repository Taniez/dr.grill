import test from 'node:test';
import assert from 'node:assert/strict';
import {createQueueAlerts} from '../src/queue-alerts.js';
test('Queue vibration works without audio; ready alerts deduplicate and completed polling gap is detected',async()=>{
 const saved={window:Object.getOwnPropertyDescriptor(globalThis,'window'),navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),document:Object.getOwnPropertyDescriptor(globalThis,'document')};
 let pulses=0;const state={textContent:''};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{}});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:()=>{pulses++;return true;}}});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>state}});
 try{const alerts=createQueueAlerts();await alerts.toggle();assert.equal(pulses,1);await alerts.check({id:'one',status:'ready'});assert.equal(pulses,2);await alerts.check({id:'one',status:'ready'});assert.equal(pulses,2);await alerts.check({id:'two',status:'cooking'});await alerts.check({id:'two',status:'completed'});assert.equal(pulses,3);await alerts.check({id:'old',status:'completed'});assert.equal(pulses,3);alerts.close();}finally{for(const key of Object.keys(saved)){if(saved[key])Object.defineProperty(globalThis,key,saved[key]);else delete globalThis[key];}}
});
