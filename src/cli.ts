import * as fs from "fs";
import * as path from "path";
import ArmaAddonsSync from ".";
import Config from "./models/config";

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "config.json")).toString());
Config.set(config);

console.log("CONFIG");
console.log(Config.toString());

const syncer = new ArmaAddonsSync();

const loop = () => {
    syncer.sync()
        .then(() => setTimeout(loop, 1000 * 60 * Config.rescanInterval));
};

loop();
