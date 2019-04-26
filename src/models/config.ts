import { isFunction } from "util";
import * as os from "os";
import * as path from "path";

const  packageConfig = require("../../package.json");

export interface IRepositoryConfig {
    url: string;
    targetDir: string;
}

export default class Config {
    public static sZipBinPath?: string;
    public static useMd5Cache?: boolean;
    public static ignorePathCase?: boolean = true;
    public static rescanInterval?: number = 5;
    public static tempFolderPath?: string = path.join(os.tmpdir(), packageConfig.name);
    public static repositories?: IRepositoryConfig[];

    public static set(data: Config) {
        for (const fieldName in data) {
            const field = (data as any)[fieldName];
            if (isFunction(field)) {
                continue;
            }
            (Config as any)[fieldName] = field;
        }
    }

    public static toString(): string {
        const result = {};
        for (const fieldName in Config) {
            const field = (Config as any)[fieldName];
            if (isFunction(field)) {
                continue;
            }
            (result as any)[fieldName] = field;
        }
        return JSON.stringify(result, null, 2).toString();
    }

    private constructor() {
    }
}
