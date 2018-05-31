import * as child_process from "child_process";
import * as path from "path";
import Config from "../models/config";

export default class Archivator {
    public static unpack(filePath: string, targetDir: string, ...restArgs: string[]): Promise<string>  {
        return new Promise((resolve, reject) => {
            const sZipBin = Config.sZipBinPath ? path.join(Config.sZipBinPath, "7z") : "7z";
            const args = ["e", filePath, "-y"];
            if (targetDir) {
                args.push(`-o${targetDir}`);
            }
            args.push(...restArgs);
            const childProcess = child_process
                .execFile(sZipBin, args, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(stdout);
                    }
                });
            childProcess.stderr.once("data", reject);
        });
    }
}
