import { Api } from "api-core";
export declare class ApiSwaggerProvider {
    levelLimit: number;
    extendedTags: boolean;
    apis: Api[];
    constructor(apis?: Api[]);
    map: () => {
        swagger: string;
        info: {
            title: string;
            version: string;
        };
        consumes: string[];
        produces: string[];
        paths: any;
        definitions: {};
    }[];
}
