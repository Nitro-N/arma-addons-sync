import Directory from "./directory";
import * as pathUtil from "path";
import * as fs from "fs-extra";
import HashGenerator from "../utils/hash-generator";
import Downloader from "../utils/downloader";
import Archivator from "../utils/archivator";
import ErrnoException = NodeJS.ErrnoException;
import { stringify } from "querystring";

export interface IFile {
    md5: string;
    size: number;
    date: number;
}

export default class SyncFile implements IFile {
    constructor(private directory: Directory,
                public path: string, private md5Private: string, public size: number,
                public date: number, public archiveSize: number, public url: string) {
        this.md5 = md5Private;
    }

    public equals(file: SyncFile): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Promise.all([this.getMd5(), file.getMd5()])
                .then((md5s: string[]) => {
                    const t = this;
                    resolve(md5s[0] === md5s[1]);
                })
                .catch(reject);
        });
    }

    public isLocal(): boolean {
        return !this.url;
    }

    public set md5(md5: string) {
        this.md5Private = md5 && md5.toLowerCase() || md5;
    }

    public get md5() {
        return this.md5Private;
    }

    public getMd5(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.md5 && this.isLocal()) {
                this.computeLocalFileMd5()
                    .then((md5) => {
                        this.md5 = md5;
                        resolve(this.md5);
                    }, reject);
            } else {
                resolve(this.md5);
            }
        });
    }

    public computeLocalFileMd5(): Promise<string> {
        return new Promise((resolve, reject) => {
            HashGenerator
                .generateForFile(this.absolutePath)
                .then(resolve, reject);
        });
    }

    public readStats(): void {
        if (fs.pathExistsSync(this.absolutePath)) {
            const stats = fs.statSync(this.absolutePath);
            this.date = stats.mtimeMs;
            this.size = stats.size;
        }
    }

    public validate(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.computeLocalFileMd5()
                .then((localFileMd5) => {
                    resolve(localFileMd5 === this.md5);
                }, reject);
        });
    }

    public get absolutePath(): string {
        return pathUtil.join(this.directory.path, this.path);
    }

    public get relativePath(): string {
        return pathUtil.join(this.directory.name, this.path);
    }

    public checkout(): Promise<void> {
        const repository = this.directory.repository;
        const tempDir = pathUtil.join(repository.tempDirPath, this.directory.name, pathUtil.dirname(this.path));
        return new Promise((resolve, reject) => {
            Downloader.download(`${repository.rootUrl}/${this.url}`, tempDir)
                .then((downloadedFilePath) => {
                    console.log("DOWNLOADED", this.relativePath);
                    return Archivator.unpack(downloadedFilePath, pathUtil.dirname(this.absolutePath))
                        .then(() => {
                            console.log("EXTRACTED", this.relativePath);
                            return downloadedFilePath;
                        });
                })
                .then((downloadedFilePath) => fs.unlink(downloadedFilePath, (err: ErrnoException) => {
                    if (err) {
                        reject(err);
                    }
                }))
                .then(() => this.readStats())
                .then(() => this.validate())
                .then((valid) => {
                    if (!valid) {
                        reject(new Error("Checkouted file md5 doesn't match meta data value"));
                    } else {
                        resolve();
                    }
                });
        });
    }

    public delete(): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.unlink(this.absolutePath, (err: ErrnoException) => {
                err ? reject(err) : resolve();
            });
        });
    }
}
