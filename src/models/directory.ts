import Repository from "./repository";
import SyncFile, { IFile } from "./sync-file";
import * as os from "os";
import * as fs from "fs-extra";
import HashGenerator from "../utils/hash-generator";
import * as klaw from "klaw";
import { Item } from "klaw";
import * as path from "path";
import ErrnoException = NodeJS.ErrnoException;
import { EventEmitter } from "events";
import Config from "./config";
import FileManager from "../utils/file-manager";

export default class Directory extends EventEmitter {
    public path: string;
    private cacheFilePath: string;
    private tempDirPath: string;
    private remoteFiles: Map<string, SyncFile> = new Map();
    private localFiles: Map<string, SyncFile> = new Map();
    private md5Cache: Map<string, IFile> = new Map();

    constructor(public repository: Repository, public name: string) {
        super();
        this.path = path.join(repository.targetDirPath, name);
        this.tempDirPath = path.join(Config.tempFolderPath, HashGenerator.generate(this.path));
        this.cacheFilePath = path.join(this.tempDirPath, "cache.json");
        fs.ensureDirSync(this.tempDirPath);
        if (Config.useMd5Cache) {
            this.readMd5Cache();
        }
    }

    public reset(): void {
        this.remoteFiles = new Map();
        this.localFiles = new Map();
    }

    public remove(): any {
        fs.remove(this.path);
    }

    public hasRemoteFiles(): boolean {
        return this.remoteFiles.size > 0;
    }

    public writeMd5Cache(): void {
        const data: any = {};
        this.localFiles.forEach((syncFile, key) => {
            const value = data[key] = {
                date: syncFile.date,
                md5: syncFile.md5,
                size: syncFile.size,
            };
            this.md5Cache.set(key, value);
        });
        fs.writeFileSync(this.cacheFilePath, JSON.stringify(data));
    }

    public readMd5Cache(): any {
        try {
            const content = fs.readFileSync(this.cacheFilePath).toString();
            const data = JSON.parse(content);
            for (const filePath in data) {
                this.md5Cache.set(filePath, data[filePath]);
            }
        } catch (error) {
            // skip
        }
    }

    public scan(): Promise<Map<string, SyncFile>> {
        return new Promise((resolve, reject) => {
            this.localFiles = new Map();
            klaw(this.path)
                .on("data", (item: Item) => {
                    if (item.stats.isFile()) {
                        const filePath = path.relative(this.path, item.path);
                        const fileCache = Config.useMd5Cache ? this.md5Cache.get(filePath) : null;
                        let md5 = null;
                        if (FileManager.validateFileCache(fileCache, item.stats)) {
                            md5 = fileCache.md5;
                        } else {
                            this.md5Cache.delete(filePath);
                        }
                        const file = new SyncFile(this, filePath, md5, item.stats.size, item.stats.mtimeMs, null, null);
                        this.localFiles.set(filePath, file);
                    }
                })
                .on("end", () => {
                    resolve(this.localFiles);
                })
                .on("error", (err: ErrnoException) => {
                    if (err.code !== "ENOENT") {
                        console.error(err.message);
                        reject(err);
                    } else {
                        resolve(this.localFiles);
                    }
                });
        });
    }

    public addRemoteFile(file: SyncFile) {
        this.remoteFiles.set(file.path, file);
    }

    public checkoutFile(file: SyncFile): Promise<void> {
        this.emit("file-checkout", file);
        return file.checkout().then(() => {
            this.localFiles.set(file.path, new SyncFile(this, file.path, file.md5, null, null, null, null));
            this.emit("file-checkouted", file);
        });
    }

    public deleteFile(file: SyncFile): Promise<void> {
        this.emit("delete", file);
        this.localFiles.delete(file.path);
        return file.delete();
    }

    public sync(): Promise<any[]> {
        const remoteFiles: Map<string, SyncFile> = new Map([...this.remoteFiles.entries()].sort());
        const localFiles: Map<string, SyncFile> = new Map([...this.localFiles.entries()].sort());
        const promises: Array<Promise<any>> = [];
        const localFilesIterator = localFiles.entries();
        const remoteFilesIterator = remoteFiles.entries();
        let localFilesIteratorResult: IteratorResult<[string, SyncFile]> = localFilesIterator.next();
        let remoteFilesIteratorResult: IteratorResult<[string, SyncFile]> = remoteFilesIterator.next();
        while (!(remoteFilesIteratorResult.done && localFilesIteratorResult.done)) {
            const remoteEntry = remoteFilesIteratorResult.value;
            const localEntry = localFilesIteratorResult.value;
            if (localFilesIteratorResult.done || remoteEntry && localEntry && remoteEntry[0] < localEntry[0]) {
                console.log("NEW", path.join(this.name, remoteEntry[0]));
                promises.push(this.checkoutFile(remoteEntry[1]));
                remoteFilesIteratorResult = remoteFilesIterator.next();
            } else if (remoteFilesIteratorResult.done || remoteEntry && localEntry && remoteEntry[0] > localEntry[0]) {
                console.log("DEL", path.join(this.name, localEntry[0]));
                promises.push(this.deleteFile(localEntry[1]));
                localFilesIteratorResult = localFilesIterator.next();
            } else if (localEntry[0] === remoteEntry[0]) {
                promises.push(localEntry[1].equals(remoteEntry[1])
                    .then((equals: boolean) => {
                        if (equals) {
                            // console.log("OK", path.join(this.name, localEntry[0]));
                        } else {
                            console.log("UPDATE", path.join(this.name, localEntry[0]));
                            return this.checkoutFile(remoteEntry[1]);
                        }
                    }));

                localFilesIteratorResult = localFilesIterator.next();
                remoteFilesIteratorResult = remoteFilesIterator.next();
            } else {
                console.error("UNKNOWN",
                    path.join(this.name, localEntry[0]), "vs", path.join(this.name, remoteEntry[0]));
            }
        }

        return Promise.
            all(promises)
            .then((results) => {
                this.writeMd5Cache();
                FileManager.removeEmptyDirs(this.path);
                return results;
            });
    }
}
