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
