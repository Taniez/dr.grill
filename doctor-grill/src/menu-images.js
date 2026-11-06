// Defaults cover existing databases without overwriting staff-uploaded image paths.
const dishes=[['pork-collar-grilled','pork-neck-salad','pork-neck-waterfall'],['belly-grilled','belly-salad','belly-waterfall'],['pork-collar-grilled','pork-neck-salad-alt','pork-neck-waterfall'],['chicken-grilled','chicken-grilled','chicken-grilled'],['beef-grilled-rice','beef-salad','beef-waterfall']];
export const menuImages={};
for(let meat=0;meat<5;meat++)for(let dish=0;dish<3;dish++)for(const category of ['rice','side'])menuImages[`${category}-${meat}-${dish}`]=dishes[meat][dish];
Object.assign(menuImages,{'rice-4-0':'beef-grilled-rice','rice-4-1':'beef-salad-rice','rice-4-2':'beef-waterfall-rice','rice-0-1':'pork-neck-salad-alt','extra-0':'stock-omelette','extra-1':'stock-egg','extra-2':'pork-collar-grilled','extra-3':'stock-rice'});
for(let i=0;i<10;i++)menuImages['snack-'+i]=i===9?'beef-skewers':i===5?'stock-crab':i===3?'stock-fish':'stock-balls';
export function withMenuImage(item){return {...item,image:item.image|| (menuImages[item.id]?`/images/${menuImages[item.id]}.webp`:undefined)};}
