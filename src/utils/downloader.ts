import * as path from "path";
import * as url from "url";
import * as fs from "fs-extra";
import Host from "./downloader.host";

export default class Downloader {
    public static readonly maxConnectionsCount = 10;
    public static readonly maxNumOfAttempts = 3;

    public static download(fileUrl: string, dir: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            fs.ensureDirSync(dir);
            const parsedUrl = url.parse(fileUrl);
            const urlKey = parsedUrl.href.replace(parsedUrl.path, "");
            const filename = fileUrl.split("/").pop();
            const filePath = path.join(dir, filename);

            let host = Downloader.hosts.get(urlKey);

            if (!host) {
                host = new Host(urlKey);
                Downloader.hosts.set(urlKey, host);
            }
            host.getFile(parsedUrl.path, filePath, resolve, reject);
        });
    }

    private static hosts: Map<string, Host> = new Map();
}

// export class Downloader2 {
//     public static events = new EventEmitter();

//     public static changeConnectionsCount(key: string, diff: number) {
//         const newCount = Downloader.connectionsCount.get(key) + diff;
//         Downloader.connectionsCount.set(key, newCount);
//         console.log("CONNECTIONS", key, newCount);
//     }

//     public static download(fileUrl: string, dir: string): Promise<any> {
//         return new Promise<any>((resolve, reject) => {
//             fs.ensureDirSync(dir);
//             const options: FtpClient.Options = {};
//             const parsedUrl = url.parse(fileUrl);
//             const isFtp = parsedUrl.protocol === "ftp:";
//             if (parsedUrl.auth) {
//                 const auth = parsedUrl.auth.split(":");
//                 options.user = auth[0];
//                 if (auth.length > 1) {
//                     options.password = auth[1];
//                 }
//             }
//             const urlKey = parsedUrl.href.replace(parsedUrl.path, "");
//             const filename = fileUrl.split("/").pop();
//             const filePath = path.join(dir, filename);
//             const fileStream = fs.createWriteStream(filePath);
//             const callback = (err: any, rs: stream.Readable) => {
//                 if (err) {
//                     reject(err);
//                     Downloader.events.emit(Events.DownloadEnd, urlKey);
//                 } else {
//                     rs
//                         .pipe(fileStream)
//                         .on("close", () => {
//                             resolve(filePath);
//                             Downloader.events.emit(Events.DownloadEnd, urlKey);
//                         });
//                 }
//             };

//             let added = false;

//             const check = (key: string) => {
//                 if (key !== urlKey) {
//                     return;
//                 }
//                 let connectionsCount = Downloader.connectionsCount.get(urlKey);
//                 if (connectionsCount === undefined) {
//                     Downloader.connectionsCount.set(urlKey, 0);
//                     connectionsCount = 0;
//                 }
//                 if (connectionsCount < Downloader.maxConnectionsCount) {
//                     if (isFtp) {
//                         Downloader.getFtp(urlKey, parsedUrl, options, callback, added);
//                     } else {
//                         Downloader.events.emit(Events.DownloadStart, urlKey);
//                         getUri(urlKey, fileUrl, options, callback);
//                     }
//                     added = true;
//                 }
//             };

//             check(urlKey);
//         })
//             .catch((e) => {
//                 console.error(e);
//                 return e;
//             });
//     }

//     private static readonly retryTimeout = 5000;
//     private static connectionsCount = new Map<string, number>();
//     private static ftpClients = new Map<string, IFtpClientData>();

//     private static getFtp(urlKey: string, fileUrl: url.UrlWithStringQuery,
//                           options: FtpClient.Options, callback: (err: any, rs: stream.Readable) => void,
//                           added: boolean) {
//         let client = Downloader.ftpClients.get(urlKey);

//         if (!client) {
//             client = {
//                 connected: false,
//                 connecting: false,
//                 instance: new FtpClient(),
//                 queue: [],
//             };

//             Downloader.ftpClients.set(urlKey, client);

//             client.instance.on("ready", () => {
//                 client.connected = true;
//                 client.connecting = false;
//                 Downloader.executeFtpItem(client, urlKey);
//             });
//             client.instance.on("close", () => {
//                 client.connected = false;
//             });
//         }
//         if (!added) {
//             client.queue.push(() => client.instance.get(fileUrl.path, callback));
//         }

//         if (!client.connecting) {
//             if (!client.connected) {
//                 options.host = fileUrl.hostname;
//                 options.port = +fileUrl.port;
//                 options.keepalive = 60000;
//                 client.instance.connect(options);
//                 client.connecting = true;
//             } else {
//                 Downloader.executeFtpItem(client, urlKey);
//             }
//         }
//     }

//     private static executeFtpItem(client: IFtpClientData, urlKey: string) {
//         while (client.queue.length && Downloader.connectionsCount.get(urlKey) < Downloader.maxConnectionsCount) {
//             Downloader.events.emit(Events.DownloadStart, urlKey);
//             client.queue.pop()();
//         }
//     }
// }

// Downloader.events.setMaxListeners(1000000000000000);

// Downloader.events.on(Events.DownloadEnd, (key) => {
//     Downloader.changeConnectionsCount(key, -1);
// });

// Downloader.events.on(Events.DownloadStart, (key) => {
//     Downloader.changeConnectionsCount(key, +1);
// });
