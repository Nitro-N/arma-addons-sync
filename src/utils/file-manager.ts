import * as fs from "fs-extra";
import * as path from "path";
import { IFile } from "../models/sync-file";
import { Stats } from "fs-extra";

export default class FileManager {
    public static removeEmptyDirs(folderPath: string): void {
        const isDir = fs.statSync(folderPath).isDirectory();
        if (!isDir) {
            return;
        }
        let files = fs.readdirSync(folderPath);
        if (files.length > 0) {
            files.forEach((file) => FileManager.removeEmptyDirs(path.join(folderPath, file)));
            files = fs.readdirSync(folderPath);
        }

        if (!files.length) {
            fs.rmdirSync(folderPath);
            return;
        }
    }

    public static validateFileCache(cache: IFile, stats: Stats): boolean {
        return cache && cache.date === stats.mtimeMs && cache.size === stats.size;
    }
}
