import {Api} from "api-core";
import {ApiMapper} from "./ApiMapper";

export class ApiMapProvider {

    levelLimit: number = 2;
    apis: Api[] = [];

    constructor(apis: Api[] = []) {
        this.apis = apis
    }

    map = () => {
        return this.apis.map((api: Api) => {
            const mapper = new ApiMapper(api);
            mapper.levelLimit = this.levelLimit;
            return {
                version: api.version,
                routes: mapper.map()
            }
        })
    }

}
