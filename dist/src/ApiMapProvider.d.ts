import { Api } from "api-core";
export declare class ApiMapProvider {
    levelLimit: number;
    apis: Api[];
    constructor(apis?: Api[]);
    map: () => {
        version: string;
        routes: string[];
    }[];
}
