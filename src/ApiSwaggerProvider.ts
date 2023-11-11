import {Api} from "api-core";
import {SecurityProvider} from "./SecurityProvider";
import {ApiSwaggerMapper} from "./ApiSwaggerMapper";

export class ApiSwaggerProvider {

    levelLimit: number = 2;
    extendedTags: boolean = true;
    apis: Api[] = [];

    constructor(apis: Api[] = []) {
        this.apis = apis
    }

    mapV2 = () => {
        return Promise.all(this.apis.map((api: Api) => {
            const mapper = new ApiSwaggerMapper(api);
            mapper.levelLimit = this.levelLimit;
            mapper.extendedTags = this.extendedTags;
            return mapper.mapV2()
        }))
    };

    mapV3 = (securityProvider?: SecurityProvider) => {
        return Promise.all(this.apis.map((api: Api) => {
            const mapper = new ApiSwaggerMapper(api, securityProvider);
            mapper.levelLimit = this.levelLimit;
            mapper.extendedTags = this.extendedTags;
            return mapper.mapV3()
        }))
    }

}

