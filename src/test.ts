import { Datalib } from "./datalib";

const data = new Datalib();

data.set("test", 123);
data.dump("system");
data.subscribe("system").on("data", () => {
  console.log(data.data.system);
});


// data.end();
