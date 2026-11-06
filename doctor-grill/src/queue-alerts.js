export function createQueueAlerts(){
 let context,enabled=false,closed=false;const notified=new Set(),previous=new Map(),pending=new Set();
 const message=text=>{const el=document.querySelector('#alert-state');if(el)el.textContent=text;};
 function vibrate(){try{return typeof navigator.vibrate==='function'&&navigator.vibrate([300,150,300,150,600]);}catch{return false;}}
 function chime(){if(context?.state!=='running')return false;[660,880,1046,660,880,1046].forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.28;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.24,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.4);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.42);});return true;}
 async function resume(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;context??=new Audio();if(context.state!=='running')await Promise.race([context.resume(),new Promise(resolve=>setTimeout(resolve,1000))]);return context.state==='running';}catch{return false;}}
 async function test(){const vibration=vibrate();await resume();const sound=chime();message(`ทดสอบแล้ว: ${sound?'ส่งเสียงแล้ว (ตรวจระดับเสียงเครื่องด้วย)':'เสียงยังถูกบล็อก ลองกดทดสอบอีกครั้ง'} · ${vibration?'ส่งคำสั่งสั่นแล้ว':'อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับหรือไม่อนุญาตให้สั่น'}`);return {sound,vibration};}
 return {
  async toggle(){enabled=!enabled;if(enabled)await test();else{navigator.vibrate?.(0);message('ปิดเสียงและการสั่นแล้ว ยังแสดงสถานะอาหารบนหน้าจอ');}return enabled;},
  test,
  async check(order){
   const before=previous.get(order.id);previous.set(order.id,order.status);
   if(order.status!=='ready'&&!(order.status==='completed'&&['new','cooking','ready'].includes(before)))return;
   message(`อาหารพร้อมเสิร์ฟแล้ว! ใบสั่ง #${order.id.slice(0,8)}${enabled?'':' · กดเปิดเสียงและการสั่นเพื่อรับแจ้งเตือน'}`);
   if(!enabled||closed||notified.has(order.id)||pending.has(order.id))return;
   pending.add(order.id);try{const vibration=vibrate();await resume();if(closed||!enabled)return;const sound=chime();if(sound||vibration)notified.add(order.id);else message('อาหารพร้อมเสิร์ฟแล้ว! เสียงถูกพักไว้ กรุณากดทดสอบเสียง / สั่น');}finally{pending.delete(order.id);}
  },
  close(){closed=true;enabled=false;context?.close().catch(()=>{});}
 };
}
