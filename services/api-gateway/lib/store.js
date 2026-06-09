import fs from "node:fs";
import path from "node:path";
import { createDefaultState } from "./defaultState.js";
import { clone } from "./helpers.js";

export function createStore(filePath) {
  const dirPath = path.dirname(filePath);

  function ensure() {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(createDefaultState(), null, 2));
    }
  }

  function read() {
    ensure();
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  function write(nextState) {
    ensure();
    fs.writeFileSync(filePath, JSON.stringify(nextState, null, 2));
    return nextState;
  }

  return {
    read: () => clone(read()),
    write,
    update(mutator) {
      const nextState = mutator(clone(read()));
      write(nextState);
      return clone(nextState);
    },
    reset() {
      const nextState = createDefaultState();
      write(nextState);
      return clone(nextState);
    },
  };
}
