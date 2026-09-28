const fs=require('fs');
const path=require('path');
const file=path.resolve('./data/settings.json');
let data={};
try { data=JSON.parse(fs.readFileSync(file,'utf8')); } catch {}
function save(){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(data,null,2)); }
module.exports={
  get:(k,d)=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:d,
  set:(k,v)=>{data[k]=v;save();},
  all:()=>({...data})
};
