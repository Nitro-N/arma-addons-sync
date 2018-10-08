import * as fs from "fs-extra";
import * as stream from "stream";
import * as url from "url";
import Downloader from "./downloader";
import FtpClient from "../types/ftp-client";

const getUri = require("get-uri");

interface IFileQueueData {
    urlPath: string;
    filePath: string;
    onSuccessCallback: (filePath: string) => void;
    onErrorCallback: (e: Error) => void;
    numOfAttempts: number;
}

interface IDownloadResult {
    err: any;
    rs: stream.Readable;
}

export default class Host {
    private parsedUrl: url.UrlWithStringQuery;
    private queue: IFileQueueData[] = [];
    private isFtp: boolean = false;
    private connectionsCount: number = 0;
    private login: string;
    private password: string;
    private ftpClient: FtpClient;
    private connecting: boolean = false;

    constructor(private urlString: string) {
        const parsedUrl = this.parsedUrl = url.parse(urlString);
        this.isFtp = parsedUrl.protocol === "ftp:";
        if (this.isFtp) {
            this.ftpClient = new FtpClient();
        }
        if (parsedUrl.auth) {
            const auth = parsedUrl.auth.split(":");
            this.login = auth[0];
            if (auth.length > 1) {
                this.password = auth[1];
            }
        }
    }

    public getFile(urlPath: string, filePath: string,
                   onSuccessCallback: (filePath: string) => void, onErrorCallback: (e: Error) => void) {
        this.queue.push({ filePath, onErrorCallback, onSuccessCallback, urlPath, numOfAttempts: 0 });
        this.processQueue();
    }

    private processQueue(): any {
        if (this.queue.length && this.connectionsCount < Downloader.maxConnectionsCount) {
            const data = this.queue.shift();
            data.numOfAttempts++;
            this.connectionsCount++;
            console.log("CONNECTIONS", this.parsedUrl.host, this.connectionsCount);
            this.download(data)
                .then((result: IDownloadResult) => {
                    this.connectionsCount--;
                    console.log("CONNECTIONS", this.parsedUrl.host, this.connectionsCount);
                    this.callback(data, result);
                });
        }
    }

    private download(data: IFileQueueData): Promise<IDownloadResult> {
        return new Promise((resolve, reject) => {
            if (this.isFtp) {
                const client = this.ftpClient;
                if (!this.connecting) {
                    if (!client.connected) {
                        client.once("ready", () => {
                            this.connecting = false;
                            client.get(data.urlPath, (err: any, rs: stream.Readable) => {
                                resolve({ err, rs });
                            });
                        });
                        client.connect({
                            host: this.parsedUrl.hostname,
                            keepalive: 60000,
                            password: this.password,
                            port: +this.parsedUrl.port,
                            user: this.login,
                        });
                        client.once("error", (e) => resolve({ err: e, rs: null }));
                        this.connecting = true;
                    } else {
                        client.get(data.urlPath, (err: any, rs: stream.Readable) => {
                            resolve({ err, rs });
                        });
                    }
                }
            } else {
                getUri(`${this.urlString}/${data.urlPath}`,
                    { login: this.login, password: this.password },
                    (err: any, rs: stream.Readable) => {
                        resolve({ err, rs });
                    });
            }
        });
    }

    private callback(data: IFileQueueData, result: IDownloadResult) {
        if (result.err) {
            data.onErrorCallback(result.err);
            if (data.numOfAttempts < Downloader.maxNumOfAttempts) {
                this.queue.push(data);
            }
            this.processQueue();
        } else {
            const fileStream = fs.createWriteStream(data.filePath);
            fileStream.on("error", (e) => data.onErrorCallback(e));
            result.rs
                .pipe(fileStream)
                .on("close", () => {
                    data.onSuccessCallback(data.filePath);
                    this.processQueue();
                });
        }
    }
}
