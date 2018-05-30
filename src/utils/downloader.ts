import * as fs from 'fs';
import * as path from 'path';
import * as makeDir from 'make-dir';
import * as stream from 'stream';
import * as url from 'url';

const getUri = require('get-uri');

export default class Downloader {
    static readonly maxConnectionsCount = 10;
    static readonly retryTimeout = 5000;
    static connectionsCount = new Map<string, number>();

    static download(fileUrl: string, dir: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            try {
                fs.accessSync(dir, fs.constants.F_OK);
            } catch (err) {
                makeDir.sync(dir);
            }
            const options: any = {};
            const parsedUrl = url.parse(fileUrl);
            if (parsedUrl.auth) {
                const auth = parsedUrl.auth.split(':');
                options.user = auth[0];
                if (auth.length > 1) {
                    options.password = auth[1];
                }
            }
            const urlKey = parsedUrl.href.replace(parsedUrl.path, '');
            const filename = fileUrl.split('/').pop();
            const filePath = path.join(dir, filename);
            const fileStream = fs.createWriteStream(filePath);
            const send = function () {
                let connectionsCount = Downloader.connectionsCount.get(urlKey);
                if (connectionsCount === undefined) {
                    Downloader.connectionsCount.set(urlKey, 0);
                    connectionsCount = 0;
                }
                if (connectionsCount === (parsedUrl.protocol === 'ftp:' ? 1 : Downloader.maxConnectionsCount)) {
                    setTimeout(send, Downloader.retryTimeout);
                    return
                }
                Downloader.changeConnectionsCount(urlKey, +1);

                getUri(fileUrl, options, function (err: any, rs: stream.Readable) {
                    if (err) {
                        reject(err);
                        Downloader.changeConnectionsCount(urlKey, -1);
                    } else {
                        rs
                            .pipe(fileStream)
                            .on('close', () => {
                                resolve(filePath);
                                Downloader.changeConnectionsCount(urlKey, -1);
                            });
                    }
                });
            };
            send();
        })
    }

    static changeConnectionsCount(key: string, diff: number) {
        const newCount = Downloader.connectionsCount.get(key) + diff;
        Downloader.connectionsCount.set(key, newCount);
        console.log('CONNECTIONS', key, newCount);
    }
}