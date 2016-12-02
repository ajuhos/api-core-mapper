import {Api} from "api-core";
import {ApiSwaggerMapper} from "./ApiSwaggerMapper";

export class ApiSwaggerProvider {

    levelLimit: number = 2;
    extendedTags: boolean = true;
    apis: Api[] = [];

    constructor(apis: Api[] = []) {
        this.apis = apis
    }

    map = () => {
        return this.apis.map((api: Api) => {
            const mapper = new ApiSwaggerMapper(api);
            mapper.levelLimit = this.levelLimit;
            mapper.extendedTags = this.extendedTags;
            return mapper.map()
        })
    }

}
