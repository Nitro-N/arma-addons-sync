import * as crypto from "crypto";
import * as fs from "fs";

export default class HashGenerator {

    public static generate(data: string | Buffer | DataView): string {
        const hash = crypto.createHash("md5");
        hash.update(data);
        return hash.digest("hex");
    }

    public static generateForFile(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash("md5");
            const stream = fs.createReadStream(path);

            stream.on("data", (data) => {
                hash.update(data, "utf8");
            });

            stream.on("end", () => {
                resolve(hash.digest("hex"));
            });
        });
    }
}
