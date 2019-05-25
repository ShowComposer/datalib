import { Datalib } from "./datalib";

import { Logging } from "@hibas123/nodelogging";

const data = new Datalib();

data.set("test", 123);
data.dump("system");
data.subscribe("system").on("data", () => {
  Logging.log(data.data);
});

// data.end();
