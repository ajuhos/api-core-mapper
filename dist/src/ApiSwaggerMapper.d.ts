import { Api } from "api-core";
export declare class ApiSwaggerMapper {
    levelLimit: number;
    extendedTags: boolean;
    private api;
    constructor(api: Api);
    private static provideOperation(target, path, tag, name, description, parameterName);
    private static providePath(target, tag, path, operations);
    private static generateAllOperations(idParam?);
    private static generateGetOperation(idParam?);
    private provideRoutesSingular;
    private provideRoutes;
    private mapEdge;
    private mapEdges;
    private mapDefinitions;
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
    };
}
