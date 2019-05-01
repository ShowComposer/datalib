import { Datalib } from "./datalib";

const data = new Datalib();
data.set('test',123,'STATIC',(c)=>{
  console.log("Test successfull set");
  console.log(c);
});
data.subscribe('system').on('data', () => {
  console.log(data.data);
});

// data.end();
