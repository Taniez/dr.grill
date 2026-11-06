// Alerts are scoped to authenticated order responses from this customer's history.
export function createQueueAlerts(){
 let context,enabled=false;const notified=new Set();
 function chime(){if(context?.state!=='running')return;[660,880,1046].forEach((frequency,i)=>{const oscillator=context.createOscillator(),gain=context.createGain(),at=context.currentTime+i*.23;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.16,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.35);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at);oscillator.stop(at+.36);});}
 return {
  async toggle(){if(enabled){enabled=false;navigator.vibrate?.(0);return false;}const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');context??=new Audio();await context.resume();enabled=true;chime();return true;},
  check(order){if(!enabled||context?.state!=='running'||order.status!=='ready'||notified.has(order.id))return;chime();navigator.vibrate?.([250,120,250,120,400]);notified.add(order.id);const state=document.querySelector('#alert-state');if(state)state.textContent=`อาหารพร้อมเสิร์ฟแล้ว! ใบสั่ง #${order.id.slice(0,8)}`;},
  close(){enabled=false;context?.close().catch(()=>{});}
 };
}
