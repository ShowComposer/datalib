// import dependencies
import * as net from "net";
import * as readline from "readline";

const sendTypes = ["INIT", "INIT_REUSE", "PING", "SET", "DEL", "SUB", "UNSUB", "DUMP"];
const responseTypes = ["INIT_ACK", "PONG", "SET_RES", "DEL_RES", "SUB_RES", "UNSUB_RES", "DUMP_RES"];

export class Datalib {
  private socket: net.Socket;
  private inputReader: readline.Interface;
  private reqId = 0;
  private reqWait = 0;
  private reqArray = {};

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

  public handleLine(c) {
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
      }
    }
    // Else: drop
  }
  // Build pkg res
  public sendRes(id = 0, type = "PONG", payload = "") {
    this.socket.write(id + " " + type + " " + payload + "\r\n");
  }
  public end() {
    this.socket.end();
  }
}
