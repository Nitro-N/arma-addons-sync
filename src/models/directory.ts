import Repository from './repository';
import SyncFile from './sync-file';
import * as fs from 'fs';
import * as os from 'os';
import HashGenerator from '../utils/hash-generator';
import * as klaw from 'klaw';
import { Item } from 'klaw';
import * as path from 'path';
import ErrnoException = NodeJS.ErrnoException;
import { EventEmitter } from 'events';
import Config from './config';
import * as makeDir from 'make-dir';

export default class Directory extends EventEmitter {
    private cacheFilePath: string;
    private tempDirPath: string;
    private remoteFiles: Map<string, SyncFile> = new Map();
    private localFiles: Map<string, SyncFile> = new Map();
    private md5Cache: Map<string, string> = new Map();
    public path: string;
    
    constructor(public repository: Repository, public name: string) {
        super();
        this.path = path.join(repository.targetDir, name);
        this.tempDirPath = path.join(os.tmpdir(), HashGenerator.generate(name));
        this.cacheFilePath = path.join(this.tempDirPath, 'cache.json');
        makeDir.sync(this.tempDirPath);
        if (Config.useMd5Cache) {
            this.readMd5Cache()
        }
    }
    
    writeMd5Cache(): void {
        const data: any = {}; 
        this.localFiles.forEach((syncFile, key)=>{
            if (!syncFile.deleted) {
                data[key] = syncFile.md5;
            }
        });
        fs.writeFileSync(this.cacheFilePath, JSON.stringify(data));
    }

    readMd5Cache(): any {
        try {
            const content = fs.readFileSync(this.cacheFilePath).toString();
            const data = JSON.parse(content);
            for (const path in data) {
                this.md5Cache.set(path, data[path]);
            }
        } catch (error) {
        }
    }
    
    scan(): Promise<Map<string, SyncFile>> {
        return new Promise((resolve, reject) => {
            this.localFiles = new Map();
            klaw(this.path)
                .on('data', (item: Item) => {
                    if (item.stats.isFile()) {
                        const filePath = path.relative(this.path, item.path);
                        const md5 = this.md5Cache.get(filePath);
                        this.localFiles.set(filePath, new SyncFile(this, filePath, md5 || null, item.stats.size, null))
                    }
                })
                .on('end', () => {
                    resolve(this.localFiles);
                })
                .on('error', (err: ErrnoException) => {
                    if (err.code !== 'ENOENT') {
                        console.error(err.message);
                        reject(err);
                    } else {
                        resolve(this.localFiles);
                    }
                })
        })
    }

    addRemoteFile(file: SyncFile) {
        this.remoteFiles.set(file.path, file);
    }

    checkoutFile(file: SyncFile): Promise<void> {
        this.emit('file-checkout', file);
        return file.checkout().then(() => {
            this.emit('file-checkouted', file);
        });
    }

    deleteFile(file: SyncFile): Promise<void> {
        this.emit('delete', file);
        return file.delete();
    }

    sync(): Promise<any[]> {
        const remoteFiles: Map<string, SyncFile> = new Map([...this.remoteFiles.entries()].sort());
        const localFiles: Map<string, SyncFile> = new Map([...this.localFiles.entries()].sort());
        const promises: Promise<any>[] = [];
        let localFilesIterator = localFiles.entries();
        let remoteFilesIterator = remoteFiles.entries();
        let localFilesIteratorResult: IteratorResult<[string, SyncFile]> = localFilesIterator.next();
        let remoteFilesIteratorResult: IteratorResult<[string, SyncFile]> = remoteFilesIterator.next();
        while (!(remoteFilesIteratorResult.done && localFilesIteratorResult.done)) {
            const remoteEntry = remoteFilesIteratorResult.value;
            const localEntry = localFilesIteratorResult.value;
            if (localFilesIteratorResult.done || remoteEntry && localEntry && remoteEntry[0] < localEntry[0]) {
                console.log('NEW', path.join(this.name, remoteEntry[0]));
                promises.push(this.checkoutFile(remoteEntry[1]));
                remoteFilesIteratorResult = remoteFilesIterator.next();
            } else if (remoteFilesIteratorResult.done || remoteEntry && localEntry && remoteEntry[0] > localEntry[0]) {
                console.log('DEL', path.join(this.name, localEntry[0]));
                promises.push(this.deleteFile(localEntry[1]));
                localFilesIteratorResult = localFilesIterator.next();
            } else if (localEntry[0] === remoteEntry[0]) {
                promises.push(localEntry[1].equals(remoteEntry[1])
                    .then((equals: boolean) => {
                        if (equals) {
                            // console.log('OK', path.join(this.name, localEntry[0]));
                        } else {
                            console.log('UPDATE', path.join(this.name, localEntry[0]));
                            return this.checkoutFile(remoteEntry[1]);
                        }
                    }));

                localFilesIteratorResult = localFilesIterator.next();
                remoteFilesIteratorResult = remoteFilesIterator.next();
            } else {
                console.error('UNKNOWN', path.join(this.name, localEntry[0]), 'vs', path.join(this.name, remoteEntry[0]));
            }
        }

        return Promise.
            all(promises)
            .then((results) => {
                this.writeMd5Cache();
                return results
            });
    }
}