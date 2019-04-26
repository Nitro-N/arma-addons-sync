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

    public static mergePathWithExists(pathString: string): string {
        const tempParts: string[] = [];
        let existPath = true;
        return pathString
            .split(path.sep)
            .map((part, i) => {
                if (!existPath) {
                    return part;
                }
                if (part === "") {
                    tempParts.push(part);
                    return part;
                }
                const newPath = tempParts.concat([part]).join(path.sep);
                const currentPath = tempParts.join(path.sep);

                if (fs.existsSync(newPath)) {
                    return part;
                } else if (fs.existsSync(currentPath)) {
                    const exist = fs.readdirSync(currentPath).find((name) => name.toLowerCase() === part.toLowerCase());
                    if (exist) {
                        return exist;
                    } else {
                        existPath = false;
                        return part;
                    }
                } else {
                    existPath = false;
                    return part;
                }
            })
            .join(path.sep);
    }
}
