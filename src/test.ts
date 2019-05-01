import { Datalib } from "./datalib";

const data = new Datalib();

data.set("test", 123);
data.subscribe("system").on("data", () => {
  console.log(data.data);
});

// data.end();
