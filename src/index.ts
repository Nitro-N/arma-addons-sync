import Repository from "./models/repository";
import Config, { IRepositoryConfig } from "./models/config";

export default class ArmaAddonsSync {

    private repositories: Repository[];

    constructor() {
        this.repositories = Config.repositories.map((repositoryConfig: IRepositoryConfig) => {
            return new Repository(repositoryConfig);
        });
    }

    public sync(): Promise<any> {
        console.time("FINISHED ALL");
        const promises: Array<Promise<any>> = this.repositories
            .map((repository: Repository) => {
                console.log("STARTING " + repository.configUrl);
                const finishedKey = "FINISHED " + repository.configUrl;
                console.time(finishedKey);
                const finish = () => console.timeEnd(finishedKey);
                return repository.sync().then(() => finish(), () => { finish(); console.log("Finished with error!"); });
            });
        return Promise.all(promises)
            .catch(console.error)
            .then(() => console.timeEnd("FINISHED ALL"));
    }
}
