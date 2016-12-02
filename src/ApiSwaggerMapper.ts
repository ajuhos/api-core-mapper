import {
    Api, ApiEdgeDefinition, ApiEdgeMethod, ApiEdgeRelation, ApiEdgeMethodScope,
    OneToOneRelation
} from "api-core";

export class ApiSwaggerMapper {

    levelLimit: number = 2;
    extendedTags: boolean = true;
    private api: Api;

    constructor(api: Api) {
        this.api = api
    }

    private static provideOperation(target: any,
                                    path: string,
                                    tag: string,
                                    name: string,
                                    description: string,
                                    parameterName: string) {
        if(parameterName) {
            target[name] = {
                summary: description,
                description,
                tags: [ tag ],
                parameters: [
                    {
                        name: parameterName,
                        "in": "path",
                        required: true
                    }
                ],
                responses: {
                    "200": {
                        description: "The requested entry"
                    }
                }
            };

            if(name == "get") {
                target[name].responses["404"] = {
                    description: "Not Found"
                }
            }
        }
        else {
            target[name] = {
                summary: description,
                description,
                tags: [ tag ],
                responses: {
                    "200": {
                        description: "The requested entry"
                    }
                }
            }
        }

        if(name == "post") {
            target[name].responses = {
                "201": {
                    description: "Created"
                }
            }
        }
    }

    private static providePath(target: any,
                               tag: string,
                               path: string,
                               operations: { name: string, description: string, parameter: string }[]) {
        target[path] = {};
        operations.forEach((operation: { name: string, description: string, parameter: string }) =>
            ApiSwaggerMapper.provideOperation(target[path], path, tag,
                operation.name, operation.description, operation.parameter))
    }

    private static generateAllOperations(idParam: string = "") {
        const extra = idParam ? " by id" : "";
        let output = [
            { name: "get", description: idParam ? "Get a single entry" : "Get a list of entries", parameter: idParam },
            { name: "put", description: "Replace an existing entry" + extra, parameter: idParam },
            { name: "patch", description: "Modify an existing entry" + extra, parameter: idParam },
            { name: "delete", description: "Delete an existing entry" + extra, parameter: idParam },
        ];
        if(!idParam) {
            output.push({ name: "post", description: "Create a new entry", parameter: idParam });
        }
        return output
    }

    private static generateGetOperation(idParam: string = "") {
        return [
            { name: "get", description: idParam ? "Get a single entry" : "Get a list of entries", parameter: idParam }
        ]
    }

    private provideRoutesSingular = (target: any, tag: string, edge: ApiEdgeDefinition, prefix = "", level = 1) => {
        if(level > this.levelLimit) return [];

        ApiSwaggerMapper.providePath(target, tag, `${prefix}`, ApiSwaggerMapper.generateAllOperations());

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Collection) {
                    //TODO: Handle acceptedTypes
                    ApiSwaggerMapper.providePath(target, tag, `${prefix}/${method.name}`,
                        ApiSwaggerMapper.generateGetOperation())
                }
            });

        edge.relations
            .filter((relation: ApiEdgeRelation) => relation.from == edge)
            .forEach((relation: ApiEdgeRelation) => {
                if(relation instanceof OneToOneRelation) {
                    this.provideRoutesSingular(target,
                        this.extendedTags ? `${tag}/${relation.name}` : tag,
                        relation.to,
                        `${prefix}/${relation.name}`,
                        level + 1)
                }
                else {
                    this.provideRoutes(target,
                        this.extendedTags ? `${tag}/${relation.name}` : tag,
                        relation.to,
                        `${prefix}/${relation.name}`,
                        level + 1)
                }
            })
    };

    private provideRoutes = (target: any, tag: string, edge: ApiEdgeDefinition, prefix = "", level = 1) => {
        if(level > this.levelLimit) return [];

        ApiSwaggerMapper.providePath(target, tag, `${prefix}`, ApiSwaggerMapper.generateAllOperations());
        ApiSwaggerMapper.providePath(target, tag,
            `${prefix}/{${edge.idField}}`, ApiSwaggerMapper.generateAllOperations(edge.idField));

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Collection || method.scope == ApiEdgeMethodScope.Edge) {
                    //TODO: Handle acceptedTypes
                    ApiSwaggerMapper.providePath(target, tag, `${prefix}/${method.name}`,
                        ApiSwaggerMapper.generateGetOperation())
                }

                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Edge) {
                    //TODO: Handle acceptedTypes
                    ApiSwaggerMapper.providePath(target, tag, `${prefix}/{${edge.idField}}/${method.name}`,
                        ApiSwaggerMapper.generateGetOperation(edge.idField))
                }
            });

        edge.relations
            .filter((relation: ApiEdgeRelation) => relation.from == edge)
            .forEach((relation: ApiEdgeRelation) => {
                if(relation instanceof OneToOneRelation) {
                    this.provideRoutesSingular(target,
                        this.extendedTags ? `${tag}/${relation.name}` : tag,
                        relation.to,
                        `${prefix}/{${edge.idField}}/${relation.name}`,
                        level + 1)
                }
                else {
                    this.provideRoutes(target,
                        this.extendedTags ? `${tag}/${relation.name}` : tag,
                        relation.to,
                        `${prefix}/{${edge.idField}}/${relation.name}`,
                        level + 1)
                }
            })
    };

    private mapEdge = (target: any, edge: ApiEdgeDefinition) => {
        this.provideRoutes(target, edge.pluralName, edge, `/${edge.pluralName}`)
    };

/*    private mapDefinition = (edge: ApiEdgeDefinition) => {
        //TODO
    };*/

    private mapEdges = () => {
        let output: any = {};
        this.api.edges.forEach((edge: ApiEdgeDefinition) => this.mapEdge(output, edge));
        return output
    };

    private mapDefinitions = () => {
        return {}
    };

    map = () => {
        return {
            swagger: "2.0",
            info: {
                title: "API",
                version: this.api.version
            },
            consumes: [
                "application/json"
            ],
            produces: [
                "application/json"
            ],
            paths: this.mapEdges(),
            definitions: this.mapDefinitions()
        }
    }

}
