import Directory from "./directory";
import * as pathUtil from "path";
import * as fs from "fs";
import HashGenerator from "../utils/hash-generator";
import Downloader from "../utils/downloader";
import Archivator from "../utils/archivator";
import ErrnoException = NodeJS.ErrnoException;

export default class SyncFile {
    public deleted: boolean = false;

    constructor(private directory: Directory,
                public path: string, private md5Private: string, public size: number, public url: string) {
        this.md5 = md5Private;
    }

    public equals(file: SyncFile): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Promise.all([this.getMd5Async(), file.getMd5Async()])
                .then((md5s: string[]) => {
                    resolve(md5s[0] === md5s[1]);
                })
                .catch(reject);
        });
    }

    public isLocal(): boolean {
        return !this.url;
    }

    set md5(md5: string) {
        this.md5Private = md5 && md5.toLowerCase() || md5;
    }

    get md5() {
        return this.md5Private;
    }

    public getMd5Async(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.md5Private && this.isLocal()) {
                HashGenerator
                    .generateForFile(this.absolutePath)
                    .then((md5) => {
                        this.md5 = md5;
                        resolve(this.md5);
                    }, reject);
            } else {
                resolve(this.md5);
            }
        });
    }

    get absolutePath(): string {
        return pathUtil.join(this.directory.path, this.path);
    }

    get relativePath(): string {
        return pathUtil.join(this.directory.name, this.path);
    }

    public checkout(): Promise<void> {
        const repository = this.directory.repository;
        const tempDir = pathUtil.join(repository.tempDirPath, this.directory.name, pathUtil.dirname(this.path));
        return new Promise((resolve, reject) => {
            Downloader.download([repository.rootUrl, this.url].join("/"), tempDir)
                .then((downloadedFilePath) => {
                    console.log("DOWNLOADED", this.relativePath);
                    return Archivator.unpack(downloadedFilePath, pathUtil.dirname(this.absolutePath))
                        .then(() => {
                            console.log("EXTRACTED", this.relativePath);
                            return downloadedFilePath;
                        }, reject);
                })
                .then((downloadedFilePath) => fs.unlink(downloadedFilePath, (err: ErrnoException) => {
                    err ? reject(err) : resolve();
                }))
                .then(() => {
                    this.md5 = null;
                    return this.getMd5Async();
                });
        });

    }

    public delete(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.deleted = true;
            fs.unlink(this.absolutePath, (err: ErrnoException) => {
                err ? reject(err) : resolve();
            });
        });
    }
}
