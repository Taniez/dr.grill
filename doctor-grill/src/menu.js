export const categories={rice:'เมนูราดข้าว',side:'เมนูกับข้าว',snack:'ของทานเล่น',extra:'เมนูเพิ่มเติม'};
const meats=['คอหมู','สามชั้น','สันคอ','ไก่','โคขุน'];
export const menu=[];
for(const [i,meat] of meats.entries()){
 const names=[i===0?`${meat}ย่างราดข้าว น้ำจิ้มแจ่ว`:`${meat}ย่างน้ำจิ้มแจ่วราดข้าว`,`ยำ${meat}ย่างราดข้าว`,`น้ำตก${meat}ย่างราดข้าว`];
 names.forEach((name,j)=>menu.push({id:`rice-${i}-${j}`,name,category:'rice',price:i===4?70:60,special:i===4?80:70,unit:'จาน',meat}));
 [ `${meat}ย่างราดน้ำจิ้มแจ่ว`,`ยำ${meat}ย่าง`,`น้ำตก${meat}ย่าง`].forEach((name,j)=>menu.push({id:`side-${i}-${j}`,name,category:'side',price:i===4?120:100,unit:'ที่',meat}));
}
['ไข่เจียว','ไข่ดาว','เพิ่มกับข้าว','เพิ่มข้าว'].forEach((name,i)=>menu.push({id:`extra-${i}`,name,category:'extra',price:i===2?15:10,unit:'ที่'}));
['ลูกชิ้นหมู','ลูกชิ้นไก่','ลูกชิ้นกุ้ง','ลูกชิ้นปลา','ลูกชิ้นปลาหมึก','ปูอัด','เต้าหู้หมู','ฮอทดอกแดง','ฮอทดอกหนังกรอบ','เนื้อโคขุน'].forEach((name,i)=>menu.push({id:`snack-${i}`,name,category:'snack',price:i===9?20:10,unit:'ไม้'}));
export function priceOrder(input,catalog=menu){
 if(!input||!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw Error('กรุณาเลือกอาหาร 1–100 รายการ');
 const table=String(input.table||'').trim(),name=String(input.name||'').trim(),phone=String(input.phone||'').trim(),note=String(input.note||'').trim();
 if(table.length>20||name.length>80||note.length>500||(!table&&!name))throw Error('กรุณาระบุโต๊ะหรือชื่อผู้สั่ง');
 if(phone&&!/^0\d{8,9}$/.test(phone))throw Error('เบอร์โทรไม่ถูกต้อง');
 const items=input.items.map(x=>{if(!x||typeof x!=='object')throw Error('รายการอาหารไม่ถูกต้อง');const m=catalog.find(m=>m.id===x.id);if(!m||m.archived||m.available===false||!Number.isInteger(x.qty)||x.qty<1||x.qty>99||!['normal','special'].includes(x.size)||x.size==='special'&&!m.special)throw Error('รายการอาหารไม่ถูกต้อง');return {id:m.id,name:m.name,unit:m.unit,size:x.size,qty:x.qty,price:x.size==='special'?m.special:m.price};});
 return {table,name,phone,note,items,total:items.reduce((n,x)=>n+x.qty*x.price,0)};
}

const images={
 'rice-4-0':'beef-grilled-rice','rice-4-1':'beef-salad-rice','rice-4-2':'beef-waterfall-rice',
 'side-0-1':'pork-neck-salad','side-0-2':'pork-neck-waterfall',
 'side-1-0':'belly-grilled','side-1-1':'belly-salad','side-1-2':'belly-waterfall',
 'side-2-0':'pork-collar-grilled','side-3-0':'chicken-grilled',
 'side-4-1':'beef-salad','side-4-2':'beef-waterfall','snack-9':'beef-skewers'
};
for(const item of menu)if(images[item.id])item.image=`/images/${images[item.id]}.webp`;


