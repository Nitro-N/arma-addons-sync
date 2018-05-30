import Repository from './models/repository';
import Config, { IRepositoryConfig } from './models/config';

export default class ArmaAddonsSync {

    private repositories: Repository[];

    constructor() {
        this.repositories = Config.repositories.map((repositoryConfig: IRepositoryConfig) => {
            return new Repository(repositoryConfig);
        });
    }

    sync(): Promise<void> {
        console.log('STARTING');
        console.time('FINISHED');
        const promises: Promise<void>[] = this.repositories
            .map((repository: Repository) => repository.sync());
        return Promise.all(promises)
            .then(() => console.timeEnd('FINISHED'))
            .catch(console.error);
    }
}