import crypto = require('crypto');

export default class HashGenerator {
    static generate(data: string | Buffer | DataView): string {
        const hash = crypto.createHash('md5');
        hash.update(data);
        return hash.digest('hex');
    }
}