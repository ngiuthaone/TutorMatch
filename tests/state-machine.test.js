const fs = require("fs");
const path = require("path");
const vm = require("vm");

const appJs = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
let storage = {};
const context = {
  console,
  alert: (message) => {
    throw new Error(message);
  },
  location: { hash: "#/" },
  window: {
    addEventListener() {}
  },
  document: {
    getElementById() {
      return { innerHTML: "" };
    },
    addEventListener() {}
  },
  localStorage: {
    getItem(key) {
      return storage[key] || null;
    },
    setItem(key, value) {
      storage[key] = value;
    }
  },
  structuredClone: (value) => JSON.parse(JSON.stringify(value)),
  URLSearchParams
};

vm.createContext(context);
vm.runInContext(appJs, context);

const data = context.window.tutormatchStateMachine.getState();
data.cases.push({
  id: "c_sibling",
  requestId: "r_seed",
  tutorId: "u_tutor_pending",
  status: "negotiating",
  cancelledReason: "",
  cancelledBy: "",
  createdAt: new Date().toISOString()
});

context.window.tutormatchStateMachine.setCaseStatus("c_seed", "paid");
const after = JSON.parse(storage.tutormatch_mvp_v2);
const paidCase = after.cases.find((item) => item.id === "c_seed");
const sibling = after.cases.find((item) => item.id === "c_sibling");
const request = after.requests.find((item) => item.id === "r_seed");

if (paidCase.status !== "paid") throw new Error("Paid case should remain paid until the user starts active learning.");
if (sibling.status !== "cancelled") throw new Error("Sibling cases should be cancelled after payment.");
if (sibling.cancelledBy !== "system") throw new Error("Sibling cancellation should be attributed to system.");
if (!sibling.cancelledReason) throw new Error("Sibling cancellation needs a reason.");
if (request.status !== "closed") throw new Error("Request should close after payment.");
if (context.window.tutormatchStateMachine.connectionFee({ fee: 300000, lessonsCount: 3 }) !== 500000) throw new Error("Connection fee should respect the configured cap.");
if (context.window.tutormatchStateMachine.connectionFee({ fee: 180000, lessonsCount: 1 }) !== 180000) throw new Error("Connection fee should use one lesson when only one lesson is agreed.");

console.log("State machine tests passed");
