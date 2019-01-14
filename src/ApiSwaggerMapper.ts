import {
    Api, ApiEdgeDefinition, ApiEdgeMethod, ApiEdgeRelation, ApiEdgeMethodScope,
    OneToOneRelation, ApiEdgeSchema, Mixed, SubSchema, SchemaReference, JSONDate
} from "api-core";
const URL = require('url');

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
                                    parameterName: string,
                                    referenceName: string,
                                    { name: edgeName, pluralName }: ApiEdgeDefinition) {
        const parameters = [];

        if(parameterName) {
            parameters.push({
                name: parameterName,
                "in": "path",
                required: true,
                type: 'string' //TODO: Handle id type
            })
        }

        if(referenceName) {
            parameters.push({
                "in": "body",
                name: "body",
                description: `The input ${edgeName} object`,
                required: true,
                schema: {
                    "$ref": `#/definitions/${referenceName}`
                }
            })
        }

        target[name] = {
            summary: description,
            description,
            tags: [ tag ],
            parameters,
            consumes: [
                "application/json"
            ],
            produces: [
                "application/json"
            ],
            responses: {
                "200": {
                    description: `The requested ${edgeName}`
                }
            }
        };

        if(name == "get") {
            target[name].responses["404"] = {
                description: "Not Found"
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
                               operations: { name: string, description: string, parameter: string, ref?: string }[],
                               edge: ApiEdgeDefinition) {
        target[path] = {};
        operations.forEach(operation =>
            ApiSwaggerMapper.provideOperation(target[path], path, tag,
                operation.name, operation.description, operation.parameter, operation.ref || '', edge))
    }

    private static generateAllOperations({ name, pluralName }: ApiEdgeDefinition, idParam: string = "") {
        const extra = idParam ? " by id" : "";
        let output = [
            { name: "get", description: idParam ? (`Get a single ${name}` + extra) : `Get a list of ${pluralName}`, parameter: idParam },
            { name: "put", description: `Replace an existing ${name}` + extra, parameter: idParam, ref: name },
            { name: "patch", description: `Modify an existing ${name}` + extra, parameter: idParam, ref: name }, //TODO: Better typing for body
            { name: "delete", description: `Delete an existing ${name}` + extra, parameter: idParam },
        ];
        if(!idParam) {
            output.push({ name: "post", description: `Create a new ${name}`, parameter: idParam, ref: name });
        }
        return output
    }

    private static generateGetOperation({ name, pluralName }: ApiEdgeDefinition, idParam: string = "") {
        return [
            {
                name: "get",
                description: idParam ? `Get a single ${name}` : `Get a list of ${pluralName}`,
                parameter: idParam
            }
        ]
    }

    private provideRoutesSingular = (target: any, tag: string, edge: ApiEdgeDefinition, prefix = "", level = 1) => {
        if(level > this.levelLimit) return [];

        ApiSwaggerMapper.providePath(target, tag, `${prefix}`, ApiSwaggerMapper.generateAllOperations(edge), edge);

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Collection) {
                    //TODO: Handle acceptedTypes
                    ApiSwaggerMapper.providePath(target, tag, `${prefix}/${method.name}`,
                        ApiSwaggerMapper.generateGetOperation(edge), edge)
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

        ApiSwaggerMapper.providePath(target, tag, `${prefix}`, ApiSwaggerMapper.generateAllOperations(edge), edge);
        ApiSwaggerMapper.providePath(target, tag,
            `${prefix}/{${edge.idField}}`, ApiSwaggerMapper.generateAllOperations(edge, edge.idField), edge);

        edge.methods.forEach(
            (method: ApiEdgeMethod) => {
                if(method.scope == ApiEdgeMethodScope.Collection || method.scope == ApiEdgeMethodScope.Edge) {
                    //TODO: Handle acceptedTypes
                    ApiSwaggerMapper.providePath(target, tag, `${prefix}/${method.name}`,
                        ApiSwaggerMapper.generateGetOperation(edge), edge)
                }

                if(method.scope == ApiEdgeMethodScope.Entry || method.scope == ApiEdgeMethodScope.Edge) {
                    //TODO: Handle acceptedTypes
                    ApiSwaggerMapper.providePath(target, tag, `${prefix}/{${edge.idField}}/${method.name}`,
                        ApiSwaggerMapper.generateGetOperation(edge, edge.idField), edge)
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

    private mapSchemaFieldType(type: any): any {
        switch(type) {
            case Number:
                return 'number';
            case String:
                return 'string';
            case JSONDate:
            case SchemaReference:
                return { type: 'string' };
            case Boolean:
                return 'boolean';
            case Mixed:
            case Object:
                return 'object';
            default:
                if(Array.isArray(type)) {
                    return this.mapArrayField(type)
                }
                else if(type && typeof type == "object") {
                    return this.mapObjectField(type)
                }
        }
    }

    private mapSchemaField(field: any) {
        if(Array.isArray(field)) {
            return this.mapSchemaFieldType(field)
        }
        else if(typeof field == "object") {
            if(field.type) {
                if(typeof field.type === "object") {
                    return this.mapSchemaFieldType(field.type)
                }
                else {
                    return {
                        type: this.mapSchemaFieldType(field.type)
                    }
                }
            }
            else if(field instanceof SubSchema) {
                return this.mapObjectField(field.original)
            }
            else {
                return this.mapSchemaFieldType(field)
            }
        }
        else {
            return {
                type: this.mapSchemaFieldType(field)
            }
        }
    }

    private mapObjectField(field: any) {
        const keys = Object.keys(field);

        const properties: { [key: string]: any } = {};
        keys.forEach(key => properties[key] = this.mapSchemaField(field[key]));

        return {
            type: 'object',
            required: keys.filter(key => field[key].required),
            properties
        }
    }

    private mapArrayField(field: any[]) {
        return {
            type: 'array',
            items: this.mapSchemaField(field[0])
        }
    }

    private mapSchema(target: any, name: string, { originalSchema }: ApiEdgeSchema) {
        target[name] = this.mapObjectField(originalSchema)
    }

    private mapSchemas = () => {
        let output: any = {};
        this.api.edges
            .filter(e => e.schema)
            .forEach(({ name, schema }: ApiEdgeDefinition) => this.mapSchema(output, name, schema));
        return output
    };

    mapV2 = () => {
        const info = this.api.info || {
            title: "API",
        };

        const api: { [key: string]: any } = {
            swagger: "2.0",
            info: {
                ...info,
                version: this.api.version
            },
            consumes: [
                "application/json"
            ],
            produces: [
                "application/json"
            ],
            paths: this.mapEdges(),
            definitions: this.mapSchemas()
        };

        if(this.api.url) {
            const parsedURL = URL.parse(this.api.url);
            api.host = parsedURL.host;
            api.basePath = parsedURL.pathname
        }

        return api
    };

    mapV3 = () => {
        const info = this.api.info || {
            title: "API",
        };

        const api: { [key: string]: any } = {
            openapi: "3.0",
            info: {
                ...info,
                version: this.api.version
            },
            paths: this.mapEdges(),
            components: {
                schemas: this.mapSchemas()
            }
        };

        if(this.api.url) {
            api.servers = [
                { url: this.api.url }
            ]
        }

        return api
    }

}
