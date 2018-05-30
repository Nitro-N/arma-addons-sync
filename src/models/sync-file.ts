import Directory from './directory';
import * as path from 'path';
import * as fs from 'fs';
import HashGenerator from '../utils/hash-generator';
import Downloader from '../utils/downloader';
import Archivator from '../utils/archivator';
import ErrnoException = NodeJS.ErrnoException;

export default class SyncFile {
    deleted: boolean = false;
    
    constructor(private directory: Directory,
        public path: string, private _md5: string, public size: number, public url: string) {
        this.md5 = _md5;
    }

    equals(file: SyncFile): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Promise.all([this.getMd5Async(), file.getMd5Async()])
                .then((md5s: string[]) => {
                    resolve(md5s[0] === md5s[1]);
                })
                .catch(reject);
        });
    }

    isLocal(): boolean {
        return !this.url;
    }

    set md5(md5: string) {
        this._md5 = md5 && md5.toLowerCase();
    }

    get md5() {
        if (!this._md5 && this.isLocal()) {
            this.md5 = HashGenerator.generate(fs.readFileSync(this.absolutePath));
        }
        return this._md5;
    }

    getMd5Async(): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this._md5 && this.isLocal()) {
                fs.readFile(this.absolutePath, (err: ErrnoException, data: Buffer) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.md5 = HashGenerator.generate(data);
                        resolve(this._md5);
                    }
                })
            } else {
                resolve(this._md5);
            }
        });
    }

    get absolutePath(): string {
        return path.join(this.directory.path, this.path);
    }

    get relativePath(): string {
        return path.join(this.directory.name, this.path);
    }

    checkout(): Promise<void> {
        const repository = this.directory.repository;
        const tempDir = path.join(repository.tempDir, this.directory.name, path.dirname(this.path));
        return new Promise((resolve, reject) => {
            Downloader.download([repository.rootUrl, this.url].join('/'), tempDir)
                .then(downloadedFilePath => {
                    console.log('DOWNLOADED', this.relativePath);
                    return Archivator.unpack(downloadedFilePath, path.dirname(this.absolutePath))
                        .then(() => {
                            console.log('EXTRACTED', this.relativePath);
                            return downloadedFilePath;
                        }, reject);
                })
                .then(downloadedFilePath => fs.unlink(downloadedFilePath, (err: ErrnoException) => {
                    err ? reject(err) : resolve();
                }));
        })

    }

    delete(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.deleted = true;
            fs.unlink(this.absolutePath, (err: ErrnoException) => {
                err ? reject(err) : resolve();
            });
        })
    }
}
