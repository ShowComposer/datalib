// import dependencies
import * as net from "net";
import * as readline from "readline";
import * as EventEmitter from "events";
import set = require("set-value");


const sendTypes = ["INIT", "INIT_REUSE", "PING", "SET", "DEL", "SUB", "UNSUB", "DUMP", "SMSG"];
const responseTypes = ["INIT_ACK", "PONG", "SET_RES", "DEL_RES", "SUB_RES", "UNSUB_RES", "DUMP_RES"];
const dataTypes = ["STATIC", "LIVE", "TICK", "LINK"];

export class Datalib {
  private socket: net.Socket;
  private inputReader: readline.Interface;
  private reqId = 0;
  private reqWait = 0;
  private reqArray = {};
  private subArray = {};
  public data = {};

  constructor(host = "127.0.0.1", port = 6789) {
    this.socket = net.createConnection(port, host, () => {
      console.log("Client connected to " + host + ":" + port);
    });

    // Read line from Socket
    // Prepare Input processing
    this.inputReader = readline.createInterface({
      input: this.socket,
    });

    this.inputReader.on("line", (l) => {
      this.handleLine(l);
    });

    this.socket.setNoDelay();
    // Handle closing
    this.socket.on("close", () => {
      console.log("disconnected");
    });
  }

  private handleLine(c) {
    const m = c.toString("utf8").split(" ");
    // Check if message has enough params
    if (m.length < 2) {
      return;
    }
    // Check if reqId is okay
    const type = parseInt(m[0], 10);
    if (isNaN(type)) {
      return;
    }
    if (!m[2]) {
      m[2] = "";
    }
    // Determine if it's new req or response
    if (responseTypes.includes(m[1])) {
      // It's a response
      // Check if id exists and handle
      if (this.reqArray[m[0]]) {
        this.reqArray[m[0]](m);
        delete this.reqArray[m[0]];
        // here comes response dispatching
      }
    }

    // Message is a request, handle/dispatch
    if (sendTypes.includes(m[1])) {
      switch (m[1]) {
        case "PING":
          this.sendRes(m[0]);
          break;
        case "SMSG":
          this.handleSMSG(m);
          break;
      }
    }
    // Else: drop
  }
  // Build pkg res
  private sendRes(id = 0, type = "PONG", payload = "") {
    this.socket.write(id + " " + type + " " + payload + "\r\n");
  }
  // Handle messages for subscriptions
  private handleSMSG(m) {
    if(m<6) {
      return;
    }
    const subId=m[2];
    if(!this.subArray[subId]) {
      return;
    }
    const ee=this.subArray[subId];
    switch(m[3]) {
      case 'SET':
        ee.emit('data');
        const payload = m[5].split('=');
        if(payload.length>1) {
          set(this.data, payload[0], payload[1]);
        } else {
          set(this.data, payload[0], true);
        }
      break;
    }

  }
  // Build pkg
  public send(type = "PING", payload = "", cb = (res: any) => undefined) {
    this.reqId++;
    this.socket.write(this.reqId + " " + type + " " + payload + "\r\n");
    this.reqArray[this.reqId] = cb;
  }
  public set(key = '', value?: any, s_type='LIVE', cb?) {
    let payload = s_type+" "+key;
    if(value) {
      payload +="="+value;
    }
    if(cb) {
      payload +=" 1";
      this.send("SET",payload,cb);
    }
    this.send("SET",payload);
  }
  public subscribe(key=".") {
    const ee = new EventEmitter();
    this.send("SUB",key,(res) => {
      if(res.length<2) {
        // TODO: Throw Error;
      }
      this.subArray[res[2]]=ee;
    });
    return ee;
  }
  public end() {
    this.socket.end();
  }
}
