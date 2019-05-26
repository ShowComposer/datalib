// import dependencies
import { Logging } from "@hibas123/nodelogging";
import * as EventEmitter from "events";
import merge = require("merge-deep");
import * as net from "net";
import * as readline from "readline";
import set = require("set-value");

const sendTypes = ["INIT", "INIT_REUSE", "PING", "SET", "ASSIGN", "DEL", "SUB", "UNSUB", "DUMP", "SMSG"];
const responseTypes = ["INIT_ACK", "PONG", "SET_RES", "ASSIGN_RES", "DEL_RES", "SUB_RES", "UNSUB_RES", "DUMP_RES"];
const dataTypes = ["STATIC", "LIVE", "TICK", "LINK"];

export class Datalib {
  public data = {};
  private socket: net.Socket;
  private inputReader: readline.Interface;
  private reqId = 0;
  private reqWait = 0;
  private reqArray = {};
  private subArray = {};

  constructor(host = "127.0.0.1", port = 6789) {
    this.socket = net.createConnection(port, host, () => {
      Logging.log("Client connected to " + host + ":" + port);
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
      Logging.log("disconnected");
    });
  }
  // Build pkg
  public send(type = "PING", payload = "", cb = (res: any) => undefined) {
    this.reqId++;
    this.socket.write(this.reqId + " " + type + " " + payload + "\r\n");
    this.reqArray[this.reqId] = cb;
  }
  public set(key = "", value?: any, sType = "LIVE", cb?) {
    let payload = sType + " " + key;
    if (value) {
      payload += "=" + value;
    }
    if (cb) {
      payload += " 1";
      this.send("SET", payload, cb);
    } else {
      this.send("SET", payload);
    }
    set(this.data, key, value || true);
  }
  public assign(key = "", value = {}, sType = "LIVE", cb?) {
    let payload = sType + " " + key;
    if (value) {
      payload += " " + this.POJOtoBase64(value);
    }
    if (cb) {
      payload += "1";
      this.send("ASSIGN", payload, cb);
    } else {
      this.send("ASSIGN", payload);
    }
    // Set changes local
    const deepAssObject = {};
    set(deepAssObject, key, value);
    this.data = merge(this.data, deepAssObject);
  }
  public subscribe(key = ".") {
    const ee = new EventEmitter();
    this.send("SUB", key, (res) => {
      if (res.length < 2) {
        // TODO: Throw Error;
      }
      this.subArray[res[2]] = ee;
    });
    return ee;
  }
  public dump(key, cb) {
    this.send("DUMP", key, (res) => {
      if (res[2]) {
        const o = this.base64toPOJO(res[2]);
        set(this.data,key,o);
        cb(o);
      } else {
        Logging.error("DUMP: Invalid response");
      }
    });
  }
  public end() {
    this.socket.end();
  }

  private handleLine(c) {
    const m = c.toString("utf8").split(" ");
    // Check if message has enough params
    if (m.length < 2) {
      return;
    }
    // Check if reqId is okay
    const id = parseInt(m[0], 10);
    if (isNaN(id)) {
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
        case "SET":
          let res = false;
          if (m[4] === "1") { res = true; }
          // Ignore data types for the client
          // m[3] is necessary as it contains data
          if (!m[3]) {
            if (res) {
              this.sendRes(id, "SET_RES", "E NO_DATA");
            }
            // Logging.warning("SET_RES " + id + " E NO_DATA");
            return;
          }
          // Execute Set command and return/log response.
          const p = m[3].split("=");
          const key = p[0];
          const value = p[1] || true;
          set(this.data, key, value);
          if (res) {
            this.sendRes(id, "SET_RES", "0");
          }
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
    if (m < 6) {
      return;
    }
    const subId = m[2];
    if (!this.subArray[subId]) {
      return;
    }
    const ee = this.subArray[subId];
    switch (m[3]) {
      case "SET":
        const payload = m[5].split("=");
        let d = true;
        if (payload.length > 1) {
          d = payload[1];
        }
        set(this.data, payload[0], d);
        // Emit data event with key and data value
        ee.emit("data", payload[0], d);
        break;
      case "ASSIGN":
        if (m < 7) {
          Logging.debug("Invalid SMSG ASSIGN");
          return;
        }
        const key = m[5];
        const value = this.base64toPOJO(m[6]);
        // Set changes local
        const deepAssObject = {};
        set(deepAssObject, key, value);
        this.data = merge(this.data, deepAssObject);
        ee.emit("data", key, value);
        break;
    }

  }
  private base64toPOJO(encoded) {
    const buff = Buffer.from(encoded, "base64");
    const text = buff.toString("ascii");
    return JSON.parse(text);
  }
  private POJOtoBase64(obj) {
    const buff = Buffer.from(JSON.stringify(obj), "ascii");
    const b64 = buff.toString("base64");
    return b64;
  }
}
