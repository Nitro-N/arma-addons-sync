import { isFunction } from "util";

export interface IRepositoryConfig {
    url: string;
    targetDir: string;
}

export default class Config {
    static sZipBinPath?: string;
    static useMd5Cache?: boolean;
    static repositories?: Array<IRepositoryConfig>;
    
    private constructor() { 
    }

    static set(data: Config) {
        for (const fieldName in data) {
            const field = (<any>data)[fieldName];    
            if (isFunction(field)) continue;
            (<any>Config)[fieldName] = field;
        }
    }
}