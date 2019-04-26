import * as path from "path";
import Downloader from "../utils/downloader";
import Archivator from "../utils/archivator";
import * as os from "os";
import HashGenerator from "../utils/hash-generator";
import * as fs from "fs";
import Directory from "./directory";
import SyncFile from "./sync-file";
import Converter from "../utils/converter";
import Config, { IRepositoryConfig } from "./config";

const XmlParser = require("xml-node").XmlParser;

export default class Repository {
    public configUrl: string;
    public targetDirPath: string;
    public tempDirPath: string;
    public rootUrl: string;
    private checkoutSize: number = 0;
    private checkoutedSize: number = 0;
    private directories: Map<string, Directory> = new Map();

    constructor(config: IRepositoryConfig) {
        this.configUrl = config.url;
        this.targetDirPath = config.targetDir;
        this.tempDirPath = path.join(Config.tempFolderPath, HashGenerator.generate(this.configUrl));
        this.rootUrl = this.configUrl.slice(0, this.configUrl.lastIndexOf("/"));
    }

    public sync(): Promise<void> {
        this.directories.forEach((directory) => directory.reset());
        return this.downloadConfigFile(this.configUrl)
            .then((configFilePath) => this.unpackConfigFile(configFilePath))
            .then((metaFilesDirPath) => this.parseMetaData(metaFilesDirPath))
            .then((directories: Map<string, Directory>) => this.syncDirectories(directories));
    }

    private downloadConfigFile(url: string): Promise<string> {
        return Downloader.download(url, this.tempDirPath);
    }

    private unpackConfigFile(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const metaFileName = "Addons.xml";
            Archivator.unpack(filePath, this.tempDirPath, path.join(path.basename(filePath, ".7z"), metaFileName))
                .then(() => {
                    resolve(path.join(this.tempDirPath, metaFileName));
                }, reject);
        });
    }

    private parseMetaData(filePath: string) {
        return new Promise((resolve, reject) => {
            XmlParser.toNode(fs.readFileSync(filePath).toString(), (err: any, node: any) => {
                if (err) {
                    console.error(err);
                    reject(err);
                } else {
                    node.getDescendants("Addons")
                        .forEach((file: any) => {
                            const directoryName = file.getChild("Path").toString().split("\\")[0];
                            let directory: Directory = this.directories.get(directoryName);
                            if (!directory) {
                                directory = new Directory(this, directoryName);
                                directory.on("file-checkout", this.onFileCheckout.bind(this));
                                directory.on("file-checkouted", this.onFileCheckouted.bind(this));
                                this.directories.set(directoryName, directory);
                            }
                            directory.addRemoteFile(new SyncFile(
                                directory,
                                path.join(
                                    ...file.getChild("Url").toString()
                                        .replace(".7z", "").split("/")
                                        .slice(1),
                                ),
                                file.getChild("Md5").toString(),
                                null,
                                null,
                                +file.getChild("Size").toString(),
                                file.getChild("Url").toString(),
                            ));
                        });
                    resolve(this.directories);
                }
            });
        });
    }

    private syncDirectories(directories: Map<string, Directory>): Promise<any> {
        const promises: Array<Promise<any>> = [];
        this.checkoutSize = 0;
        this.checkoutedSize = 0;
        directories.forEach((directory) => {
            if (directory.hasRemoteFiles()) {
                promises.push(directory.scan().then(() => directory.sync()));
            } else {
                console.log("DEL DIRECTORY", `${directory.path}`);
                directory.remove();
            }
        });
        return Promise.all(promises);
    }

    private onFileCheckout(syncFile: SyncFile) {
        this.checkoutSize += syncFile.archiveSize;
        this.logProgress();
    }

    private onFileCheckouted(syncFile: SyncFile) {
        this.checkoutedSize += syncFile.archiveSize;
        this.logProgress();
    }

    private logProgress() {
        const checkoutedSizeFormated = Converter.formatBytes(this.checkoutedSize, 2);
        const checkoutSizeFormated = Converter.formatBytes(this.checkoutSize, 2);
        const percentages = ((this.checkoutedSize / this.checkoutSize) * 100).toFixed(2);
        console.log("CHECKOUT PROGRESS", `${checkoutedSizeFormated}/${checkoutSizeFormated} ${percentages}%`);
    }
}
