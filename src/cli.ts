import * as fs from 'fs';
import * as path from 'path';
import ArmaAddonsSync from '.';
import Config from './models/config';
import Archivator from './utils/archivator';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json')).toString());
Config.set(config);

console.log('CONFIG');
console.log(config);

const syncer = new ArmaAddonsSync();

const loop = ()=>{
    syncer.sync()
    .then(()=>setTimeout(loop, 1000 * 60 * 0.5))
}

loop();
