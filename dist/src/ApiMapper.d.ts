import { Api } from "api-core";
export declare class ApiMapper {
    levelLimit: number;
    private api;
    constructor(api: Api);
    private printRoutesSingular;
    private printRoutes;
    private mapEdge;
    map: () => string[];
}
